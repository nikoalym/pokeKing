pokeKing App

An express.js app with a MongoDB backend that finds the next pokeKing.

The project intentionally keeps things simple: one server file and one HTML page.

To run:

1. `git clone https://github.com/nick-aly/pokeKing.git`
2. `cd ./pokeKing`
3. `npm install`
4. Set `MONGODB_URL` to your MongoDB connection string if you do not want to use the local default (`mongodb://127.0.0.1:27017/pokeking`)
5. `npm start`

Optional environment variables:

- `PORT` to change the server port (defaults to `3000`)
- `RESET_DB=true` to clear cached pokemon data before startup
