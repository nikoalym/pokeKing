const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

//my mongo atlas url
const url =
  "mongodb+srv://root:toor@devcluster.solsp.mongodb.net/dev?retryWrites=true&w=majority";
//express port
const port = 3000;
const app = express();
//Pokemon summary model
const PokemonSummarySchema = new mongoose.Schema({
  name: String,
  url: String,
});
const PokemonSummaryModel = mongoose.model("pokemon", PokemonSummarySchema);

const PokemonProfileSchema = new mongoose.Schema({
  id: Number,
  name: String,
  url: String,
  height: Number,
  weight: Number,
  base_experience: Number,
  sprites: {},
  stats: [],
});
const PokemonProfileModel = mongoose.model(
  "pokemon_profile",
  PokemonProfileSchema
);

//Schedule axios reeuests globaly.. the only way i found to debounce them between forEach loopessssssssssss
function scheduleRequests(axiosInstance, intervalMs) {
  let lastInvocationTime = undefined;

  const scheduler = (config) => {
    const now = Date.now();
    if (lastInvocationTime) {
      lastInvocationTime += intervalMs;
      const waitPeriodForThisRequest = lastInvocationTime - now;
      if (waitPeriodForThisRequest > 0) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(config), waitPeriodForThisRequest);
        });
      }
    }

    lastInvocationTime = now;
    return config;
  };

  axiosInstance.interceptors.request.use(scheduler);
}

scheduleRequests(axios, 1000);

mongoose
  .connect(url, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then(async () => {
    //reset the db. Uncoment to persist
    PokemonProfileModel.collection.drop()
    PokemonSummaryModel.collection.drop()
    
    //get initial data
    var pokemonSums = await initDb();

    //pass the array and search through it for big pokemons
    searchBigPokemon(
      pokemonSums.map((pokeSum) => pokeSum.url)
    );

    //send a sigle html page back..
    app.get("/", function (req, res) {
      res.sendFile(path.join(__dirname + "/index.html"));
    });

    //return pokemons in db by page
    // id is for paging
    app.get("/pokemons/:id", async function (req, res) {
      var page = req.params.id; //index
      var limit = 10; // how many entries the response will have
      var skip = limit * page; //offset
      var count = await PokemonProfileModel.countDocuments();
      var pokemons = await PokemonProfileModel.find(
        {},
        {},
        { skip: skip, limit: limit }
      ).sort("-weight");
      var pages = Math.ceil(count / limit); //number of pages
      res.send({
        pokemons: pokemons,
        paginator: { pages: pages, skip: skip, page: page, limit: limit },
      });
    });
    
    //return the pokeKing
    app.get("/king", async function (req, res) {
      pokemons = await PokemonProfileModel.find(
        {},
        { name: 1, "stats.base_stat": 1, id: 1 }
      );
      hihi = pokemons.map((pokemon, index) => {
        let base_stats = pokemon.stats.map((data) => data.base_stat);
        let sum_stat = base_stats.reduce((a, b) => a + b, 0);
        return { name: pokemons[index].name, sum: sum_stat };
      });
      pipi = hihi.reduce((a, b) => {
        return a.sum > b.sum ? a : b;
      });
      king = await PokemonProfileModel.findOne({ name: pipi.name });
      res.send(king);
    });

    //start the server
    app.listen(port, () =>
      console.log(`PokeKing search started at port ${port}!`)
    );
  });


  //check if we have anything in db..
// else itterate the api to fill it.
async function initDb() {
  return PokemonSummaryModel.find().then((pokemon) => {
    console.log("Welcome to the pokeking search zone...");
    if (pokemon.length) {
      console.log(pokemon.length, "Pokemons are here!");
      return pokemon;
    } else {
      console.log("No Pokemon found, adding some...");
      //recursive function to itterate through the api
      return searchAllPokemon().then((apiPokeSums) =>
        PokemonSummaryModel.insertMany(apiPokeSums).then(
          console.log("Pokemons appeared!!")
        )
      );
    }
  });
}

//fetch pokemon summaries from API. return the array
async function searchAllPokemon(
  url = "https://pokeapi.co/api/v2/pokemon",
  pokemons = []
) {
  return axios
    .get(url)
    .then((res) => res.data)
    .catch((error) => console.log("axios error", error))
    .then((data) => {
      while (data.next) {
        pokemons = pokemons.concat(data.results);
        return searchAllPokemon(data.next, pokemons);
      }
      return pokemons;
    });
}

//Itterate through summaries and fetch individual pokemon data. Store it if its big.
//return the super array. Had some problem sending 900 gets in loop
async function searchBigPokemon(pokemonSummaries, pokemons = []) {
  while (pokemonSummaries.length) {
    let next = pokemonSummaries.shift();
    pokemons.push(
      axios.get(next).then((resp) => {
        if (resp.data.height > 20 && resp.data.sprites.front_default) {
          console.log("Found", resp.data.name, "in the api. Checking pokedex..");

          PokemonProfileModel.findOne({ name: resp.data.name }).then((data) => {
            if (data) {
              console.log("Its already in my pokedex");
              return data;
            } else {
              console.log("First time engaging... adding to pokedex.");
              PokemonProfileModel.create(resp.data).then((data) => {
                console.log("Done!");
                return data;
              });
            }
          });
        }
        return searchBigPokemon(pokemonSummaries, pokemons);
      })
    );
  }
  return Promise.all(pokemons);
}
