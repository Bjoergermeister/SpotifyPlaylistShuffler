require("dotenv").config();

const express = require("express");
const bodyparser = require("body-parser");
const cors = require("cors");
const cookie_parser = require("cookie-parser");
const handlebars = require("express-handlebars");
const path = require("path");

const { SpotifyAPI } = require("./JS/SpotifyAPI");
const { Client } = require("./JS/Spotify");
const { Session } = require("./JS/Session");
const { nullOrUndefined, generateRandomString } = require("./JS/Helper");

const app = express();

//Authorization variables
const client = new Client(process.env.CLIENT_ID, process.env.CLIENT_SECRET);
const sessions = new Map();

var stateKey = "spotify_auth_state";

//Setup express
app.engine("handlebars", handlebars({defaultLayout: "default", layoutsDir: path.join(__dirname, "/Views/Layouts")}));
app.set("views", path.join(__dirname, "Views"));
app.set("view engine", "handlebars");
app
  .use(express.static("public"))
  .use(cors())
  .use(cookie_parser())
  .use(bodyparser.json());

app.get("/", (req, res) => {
  res.render("index");
});

/** Login **/
app.get("/login", (req, res) => {
    
  //Preparing authorization
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  res.redirect(SpotifyAPI.getAuthorizationURL(client, process, state));
});

app.get("/authorization", async (req, res) => {
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || storedState !== state) {
        response.redirect("error");
        return;
    }
  
    res.clearCookie(stateKey);
    const result = await SpotifyAPI.receiveToken(client, code, process.env.REDIRECT_URI);

    if (result.success === false) {
        res.redirect("/");
        return;
    }

    const {cookie, session} = result;
    sessions.set(session.id, session);
    res.cookie(cookie.name, cookie.sessionID, {maxAge: cookie.maxAge, httpOnly: cookie.httpOnly});
    res.redirect("/playlists");
});

app.get("/playlists", async (req, res) => {
  const session = Session.getFromRequest(req, sessions);
  if (session == null) {
    res.redirect("/");
    return;
  }

  session.refreshIfExpired(client);

  //Get user data
  const userdata = await SpotifyAPI.getUserData(session.authorization.accessToken);
  if (userdata.success === false) {
    res.redirect("/");
    return;
  }

  //Get user's playlists
  const playlists = await SpotifyAPI.getPlaylists(session.authorization.accessToken, userdata.data.id);
  if (playlists.success === false) {
    res.redirect("/");
    return;
  }

  //Render page
  res.render("playlists", {user: userdata.data, playlists: playlists.data});
});

app.get("/playlist/:playlistid", async function(req, res) {
  //Get playlist id from url
  const playlistid = req.params.playlistid;
  if (nullOrUndefined(playlistid)) {
    res.redirect("/");
    return;
  }

  //Get session
  const session = Session.getFromRequest(req, sessions);
  if (nullOrUndefined(session)) {
    res.redirect("/");
    return;
  }

  await session.refreshIfExpired(client);
  let response = null;

  response = await SpotifyAPI.getPlaylist(session.authorization.accessToken, playlistid);
  if (response.success == false){
    res.redirect("/");
    return;
  }

  session.currentPlaylist = response.data;
  
  //Get playlist
  response = await SpotifyAPI.getTracksFromPlaylist(session.authorization.accessToken, playlistid, session.currentPlaylist);
  if (response.success == false) {
    res.redirect("/");
    return;
  }

  res.render("playlist", session.currentPlaylist);
});

app.get("/shuffle/:playlistid", async function(req, res){
  //Get playlist id from url
  const playlistid = req.params.playlistid;

  //Get session
  const session = Session.getFromRequest(req, sessions);
  if (nullOrUndefined(session)) {
    res.redirect("/");
    return;
  }

  await session.refreshIfExpired();

  const accessToken = session.authorization.accessToken;
  const currentPlaylist = session.currentPlaylist;

  //Delete tracks in playlist, shuffle and re-add tracks
  SpotifyAPI.clearPlaylist(accessToken, playlistid, currentPlaylist)
  shufflePlaylist(currentPlaylist);
  SpotifyAPI.addTracksToPlaylist(accessToken, playlistid, currentPlaylist);

  res.json(currentPlaylist);
});

app.get("error", function(req, res){
    res.render("error");
});

app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}`);
});

/*Helper functions*/
function shufflePlaylist(playlist) {
  var j, x, i;
  for (i = playlist.length - 1; i > 0; i--) {
    do {
      j = Math.floor(Math.random() * (i + 1));
    }while(i === j)
    x = playlist[i];
    playlist[i] = playlist[j];
    playlist[j] = x;
  }
  return playlist;
}