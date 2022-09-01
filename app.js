require("dotenv").config();

const express = require("express");
const express_session = require("express-session");
const bodyparser = require("body-parser");
const cors = require("cors");
const cookie_parser = require("cookie-parser");
const handlebars = require("express-handlebars");
const path = require("path");

const { SpotifyAPI } = require("./JS/SpotifyAPI");
const { Client } = require("./JS/Spotify");
const { nullOrUndefined, generateRandomString } = require("./JS/Helper");
const {
  increment,
  isSelectedPlaylist,
  getColorForPlaylist,
} = require("./JS/Helper");

const oneDay = 1000 * 60 * 60 * 24;
const sessionSettings = {
  secret: process.env.SESSION_SECRET,
  saveUninitialized: true,
  cookie: { maxAge: oneDay },
  resave: false,
};

//Authorization variables
const client = new Client(process.env.CLIENT_ID, process.env.CLIENT_SECRET);

const stateKey = "spotify_auth_state";

//Setup handlebars helper
const helpers = {
  increment: increment,
  isSelectedPlaylist: isSelectedPlaylist,
  getColorForPlaylist: getColorForPlaylist,
};

//Setup express
const app = express();
app.engine(
  "handlebars",
  handlebars({
    helpers: helpers,
    defaultLayout: "default",
    layoutsDir: path.join(__dirname, "/Views/Layouts"),
  })
);
app.set("views", path.join(__dirname, "Views"));
app.set("view engine", "handlebars");
app
  .use(express.static("public"))
  .use(cors())
  .use(express_session(sessionSettings))
  .use(cookie_parser())
  .use(bodyparser.json());

app.get("/", (_, response) => {
  response.render("index");
});

/** Login **/
app.get("/login", (_, response) => {
  //Preparing authorization
  const state = generateRandomString(16);
  response.cookie(stateKey, state);

  response.redirect(SpotifyAPI.getAuthorizationURL(client, process, state));
});

app.get("/logout", (request, response) => {
  request.session.destroy();
  response.redirect("/");
});

app.get("/authorization", async (request, response) => {
  var code = request.query.code || null;
  var state = request.query.state || null;
  var storedState = request.cookies ? request.cookies[stateKey] : null;

  if (state === null || storedState !== state) {
    response.redirect("error");
    return;
  }

  response.clearCookie(stateKey);
  const [token_success, authorization] = await SpotifyAPI.receiveToken(
    client,
    code,
    process.env.REDIRECT_URI
  );
  if (token_success === false) {
    console.log("[SpotifyAPI] Receiving tokens failed");
    response.redirect("/");
    return;
  }

  // Get user data
  const [user_success, user] = await SpotifyAPI.getUserData(
    authorization.accessToken
  );
  if (user_success === false) {
    console.log("[SpotifyAPI] Getting user data failed");
    response.redirect("/");
    return;
  }

  // Save data in session
  request.session.authorization = authorization;
  request.session.user = user;

  response.redirect("/home");
});

app.get("/home", async (request, response) => {
  if (!request.session.authorization) {
    console.log("[SESSION] Invalid session, redirecting to login page");
    response.redirect("/");
    return;
  }

  const { authorization, user } = request.session;
  request.session.playlist = null;

  //Get user's playlists
  const [success, playlists] = await SpotifyAPI.getPlaylists(
    authorization.accessToken,
    user.id
  );
  if (success === false) {
    console.log("[SpotifyAPI] Getting playlist failed");
    response.redirect("/");
    return;
  }

  request.session.playlists = playlists;

  //Render page
  response.render("home", { user: user, playlists: playlists });
});

app.get("/playlist/:playlistid", async (request, response) => {
  if (!request.session.authorization) {
    console.log("[SESSION] Invalid session, redirecting to login page");
    response.redirect("/");
    return;
  }

  // Get playlist id from url
  const playlistID = request.params.playlistid;
  if (nullOrUndefined(playlistID)) {
    response.redirect("/");
    return;
  }

  const { authorization, user, playlists } = request.session;

  // Get playlist
  const [playlist_success, playlist] = await SpotifyAPI.getPlaylist(
    authorization.accessToken,
    playlistID
  );
  if (playlist_success == false) {
    response.redirect("/");
    return;
  }

  request.session.playlist = playlist;

  // Get tracks in playlist
  const track_success = await SpotifyAPI.getTracksFromPlaylist(
    authorization.accessToken,
    playlistID,
    playlist
  );
  if (track_success == false) {
    response.redirect("/");
    return;
  }

  response.render("playlist", { user, playlist, playlists, playlistID });
});

app.get("/shuffle/:playlistid", async (request, response) => {
  const playlistID = request.params.playlistid;

  // Check session
  if (!request.session.authorization) {
    request.redirect("/");
    return;
  }

  //Delete tracks in playlist, shuffle and re-add tracks
  const tracks = request.session.playlist.tracks;
  if (tracks.length > 0) {
    shufflePlaylist(tracks);
    await SpotifyAPI.clearPlaylist(
      request.session.authorization.accessToken,
      playlistID,
      tracks
    );
    await SpotifyAPI.addTracksToPlaylist(
      request.session.authorization.accessToken,
      playlistID,
      tracks
    );
    response.json(tracks);
    return;
  }

  response.redirect("/error");
});

app.get("/error", (_, response) => {
  response.render("error");
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
    } while (i === j);
    x = tracks[i];
    tracks[i] = tracks[j];
    tracks[j] = x;
  }
}
