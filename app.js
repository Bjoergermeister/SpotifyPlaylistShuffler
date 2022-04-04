require("dotenv").config();

const express = require("express");
const session = require("express-session")
const bodyparser = require("body-parser");
const cors = require("cors");
const cookie_parser = require("cookie-parser");
const handlebars = require("express-handlebars");
const path = require("path");

const { SpotifyAPI } = require("./JS/SpotifyAPI");
const { Client } = require("./JS/Spotify");
const { nullOrUndefined, generateRandomString } = require("./JS/Helper");

const oneDay = 1000 * 60 * 60 * 24;
const sessionSettings = {
  secret: process.env.SESSION_SECRET,
  saveUninitialized: true,
  cookie: { maxAge: oneDay },
  resave: false
};


//Authorization variables
const client = new Client(process.env.CLIENT_ID, process.env.CLIENT_SECRET);

const stateKey = "spotify_auth_state";

//Setup express
const app = express();
app.engine("handlebars", handlebars({defaultLayout: "default", layoutsDir: path.join(__dirname, "/Views/Layouts")}));
app.set("views", path.join(__dirname, "Views"));
app.set("view engine", "handlebars");
app
  .use(express.static("public"))
  .use(cors())
  .use(session(sessionSettings))
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

    req.session.id = result.session.id;
    req.session.accessToken = result.session.authorization.accessToken;
    req.session.refreshToken = result.session.authorization.refreshToken;
    req.session.tokenTimestamp = result.session.authorization.tokenTimestamp;

    res.redirect("/playlists");
});

app.get("/playlists", async (req, res) => {
  if (req.session.id === false){
    res.redirect("/");
    return;
  }

  //Get user data
  const userdata = await SpotifyAPI.getUserData(req.session.accessToken);
  if (userdata.success === false) {
    res.redirect("/");
    return;
  }

  //Get user's playlists
  const playlists = await SpotifyAPI.getPlaylists(req.session.accessToken, userdata.data.id);
  if (playlists.success === false) {
    res.redirect("/");
    return;
  }

  //Render page
  res.render("playlists", { user: userdata.data, playlists: playlists.data });
});

app.get("/playlist/:playlistid", async function(req, res) {
  if (req.session.id === false){
    res.redirect("/");
    return;
  }
  //Get playlist id from url
  const playlistid = req.params.playlistid;
  if (nullOrUndefined(playlistid)) {
    res.redirect("/");
    return;
  }

  //Get user data
  const userdata = await SpotifyAPI.getUserData(req.session.accessToken);
  if (userdata.success === false) {
    res.redirect("/");
    return;
  }

  let response = null;

  response = await SpotifyAPI.getPlaylist(req.session.accessToken, playlistid);
  if (response.success == false){
    res.redirect("/");
    return;
  }

  const currentPlaylist = response.data;
  req.session.currentPlaylist = currentPlaylist;
  
  //Get playlist
  response = await SpotifyAPI.getTracksFromPlaylist(req.session.accessToken, playlistid, currentPlaylist);
  if (response.success == false) {
    res.redirect("/");
    return;
  }

  res.render("playlist", { user: userdata.data, playlist: currentPlaylist });
});

app.get("/shuffle/:playlistid", async function(req, res){
  //Get playlist id from url
  const playlistid = req.params.playlistid;

  //Check session
  if (req.session.id === false){
    res.redirect("/");
    return;
  }

  //Delete tracks in playlist, shuffle and re-add tracks
  const currentPlaylist = req.session.currentPlaylist;
  if (currentPlaylist){
    SpotifyAPI.clearPlaylist(req.session.accessToken, playlistid, currentPlaylist.tracks);
    shufflePlaylist(currentPlaylist.tracks);
    SpotifyAPI.addTracksToPlaylist(req.session.accessToken, playlistid, currentPlaylist.tracks);
    res.json(currentPlaylist.tracks);
    return;
  }

  res.redirect("/error");
});

app.get("/error", function(req, res){
    res.render("error");
});

app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}`);
});

/*Helper functions*/
function shufflePlaylist(tracks) {
  var j, x, i;
  for (i = tracks.length - 1; i > 0; i--) {
    do {
      j = Math.floor(Math.random() * (i + 1));
    }while(i === j)
    x = tracks[i];
    tracks[i] = tracks[j];
    tracks[j] = x;
  }
}