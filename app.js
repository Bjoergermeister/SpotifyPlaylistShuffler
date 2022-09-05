require("dotenv").config();

const express = require("express");
const express_session = require("express-session");
const bodyparser = require("body-parser");
const cors = require("cors");
const cookie_parser = require("cookie-parser");
const handlebars = require("express-handlebars");
const path = require("path");

const { increment, getColorForPlaylist, getEnvOrDie, condition } = require("./JS/Helper");
const { login, logout, authorization, home, playlist, shuffle } = require("./JS/Routes");

const oneDay = 1000 * 60 * 60 * 24;
const sessionSettings = {
  secret: getEnvOrDie("SESSION_SECRET"),
  saveUninitialized: true,
  cookie: { maxAge: oneDay },
  resave: false,
};

// Setup handlebars
const helpers = {
  increment: increment,
  getColorForPlaylist: getColorForPlaylist,
  condition: condition,
};

const handlebarsConfig = {
  helpers,
  defaultLayout: "default",
  layoutsDir: path.join(__dirname, "/Views/Layouts"),
  partialsDir: path.join(__dirname, "/Views/Partials"),
};

// Setup express
const app = express();
app.engine("handlebars", handlebars(handlebarsConfig));
app.set("views", path.join(__dirname, "Views"));
app.set("view engine", "handlebars");
app
  .use(express.static("public"))
  .use(cors())
  .use(express_session(sessionSettings))
  .use(cookie_parser())
  .use(bodyparser.json());

// Routes
app.get("/", (_, response) => response.render("index"));
app.get("/login", login);
app.get("/logout", logout);
app.get("/authorization", authorization);
app.get("/home", home);
app.get("/playlist/:playlistid", playlist);
app.get("/shuffle/:playlistid", shuffle);
app.get("/error", (_, response) => response.render("error"));

const port = getEnvOrDie("PORT");
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
