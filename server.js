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

    //send a sigle html page back..
    app.get("/", function (req, res) {
      res.sendFile(path.join(__dirname + "/index.html"));
    });

    //start the server
    app.listen(port, () =>
      console.log(`PokeKing search started at port ${port}!`)
    );
  });

