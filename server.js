const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

//my mongo atlas url
const url =
  "mongodb+srv://root:toor@devcluster.solsp.mongodb.net/dev?retryWrites=true&w=majority";
//express port
const port = 3000;

//Pokemon summary model
const PokemonSummarySchema = new mongoose.Schema({
  name: String,
  url: String,
});
const PokemonSummaryModel = mongoose.model("pokemon", PokemonSummarySchema);

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
    //get initial data
    var pokemonSums = await initDb();

    //send a sigle html page back..
    app.get("/", function (req, res) {
      res.sendFile(path.join(__dirname + "/index.html"));
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
