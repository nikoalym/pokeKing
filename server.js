const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

const url = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/pokeking";
//express port
const port = process.env.PORT || 3000;
const shouldResetDb = process.env.RESET_DB === "true";
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

function getPokemonStatTotal(stats = []) {
  return stats.reduce((sum, stat) => sum + stat.base_stat, 0);
}

mongoose
  .connect(url, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then(async () => {
    if (shouldResetDb) {
      await Promise.all([
        PokemonProfileModel.deleteMany({}),
        PokemonSummaryModel.deleteMany({}),
      ]);
    }

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
      try {
        var page = Number.parseInt(req.params.id, 10); //index
        var limit = 10; // how many entries the response will have

        if (Number.isNaN(page) || page < 0) {
          return res.status(400).send({ error: "Invalid page number." });
        }

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
      } catch (error) {
        console.log("Failed to load pokemons.", error);
        res.status(500).send({ error: "Failed to load pokemons." });
      }
    });

    //return the pokeKing
    app.get("/king", async function (req, res) {
      try {
        const pokemons = await PokemonProfileModel.find(
          {},
          { name: 1, "stats.base_stat": 1, id: 1 }
        );

        if (!pokemons.length) {
          return res.status(404).send({ error: "No pokemons found." });
        }

        const kingSummary = pokemons
          .map((pokemon) => ({
            name: pokemon.name,
            sum: getPokemonStatTotal(pokemon.stats),
          }))
          .reduce((bestPokemon, currentPokemon) => {
            return bestPokemon.sum > currentPokemon.sum
              ? bestPokemon
              : currentPokemon;
          });

        const king = await PokemonProfileModel.findOne({ name: kingSummary.name });
        res.send(king);
      } catch (error) {
        console.log("Failed to load king.", error);
        res.status(500).send({ error: "Failed to load king." });
      }
    });

    //start the server
    app.listen(port, () =>
      console.log(`PokeKing search started at port ${port}!`)
    );
  })
  .catch((error) => {
    console.log("Failed to start PokeKing.", error);
    process.exit(1);
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
      return searchAllPokemon().then((apiPokeSums) => {
        console.log("Pokemons appeared!!");
        return PokemonSummaryModel.insertMany(apiPokeSums);
      });
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
      const nextPokemons = pokemons.concat(data.results);

      if (data.next) {
        return searchAllPokemon(data.next, nextPokemons);
      }

      return nextPokemons;
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
