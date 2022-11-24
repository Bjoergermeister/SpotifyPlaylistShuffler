const { SpotifyAPI } = require("./SpotifyAPI");
const { Client } = require("./Spotify");
const redis = require("redis");

const {
  generateRandomString,
  shufflePlaylist,
  nullOrUndefined,
  getEnvOrDie,
  parseBoolean,
} = require("./Helper");

// Setup redis
let redisClient = null;

(async () => {
  const redisConfig = {
    socket: {
      host: getEnvOrDie("REDIS_HOST"),
      port: parseInt(getEnvOrDie("REDIS_PORT")),
      password: getEnvOrDie("REDIS_PASSWORD"),
    },
  };
  redisClient = redis.createClient(redisConfig);
  redisClient.on("error", (error) => console.error(`Error: ${error}`));
  await redisClient.connect();
})();

// Constants
const CLIENT_ID = getEnvOrDie("CLIENT_ID");
const CLIENT_SECRET = getEnvOrDie("CLIENT_SECRET");
const STATE_KEY = getEnvOrDie("STATE_KEY");
const REDIRECT_URI = getEnvOrDie("REDIRECT_URI");
const HIDE_WARNING_COOKIE = "hide_warning";

//Authorization variables
const client = new Client(CLIENT_ID, CLIENT_SECRET);

function login(request, response) {
  //Preparing authorization
  const state = generateRandomString(16);
  response.cookie(STATE_KEY, state);

  const authorizationUrl = SpotifyAPI.getAuthorizationURL(client, state);
  response.redirect(authorizationUrl);
}

function logout(request, response) {
  request.session.destroy();
  response.redirect("/");
}

async function authorization(request, response, next) {
  var code = request.query.code || null;
  var state = request.query.state || null;
  var storedState = request.cookies ? request.cookies[STATE_KEY] : null;

  if (state === null || storedState !== state) {
    response.redirect("error");
    return;
  }

  response.clearCookie(STATE_KEY);

  const tokenResponse = await SpotifyAPI.receiveToken(client, code, REDIRECT_URI);
  if (tokenResponse.success === false) {
    next(tokenResponse.error);
    return;
  }

  // Get user data
  const userResponse = await SpotifyAPI.getUserData(tokenResponse.result.accessToken);
  if (userResponse.success === false) {
    console.log("[SpotifyAPI] Getting user data failed");
    response.redirect("/");
    return;
  }

  // Save data in session
  request.session.authorization = tokenResponse.result;
  request.session.user = userResponse.result;

  response.redirect("/home");
}

async function home(request, response, next) {
  response.locals.path = "home";

  if (!request.session.authorization) {
    console.log("[SESSION] Invalid session, redirecting to login page");
    response.redirect("/");
    return;
  }

  const user = request.session.user;
  const accessToken = request.session.authorization.accessToken;

  request.session.playlist = null;

  //Get user's playlists
  const playlistsResponse = await SpotifyAPI.getPlaylists(accessToken, user.id);
  if (playlistsResponse.success === false) {
    next(playlistsResponse.error);
    return;
  }

  const playlists = playlistsResponse.result;
  request.session.playlists = playlists;

  //Render page
  response.render("home", { user, playlists });
}

async function playlist(request, response, next) {
  response.locals.path = "playlist";

  // Get playlist ID from url, return to home if its missing
  const playlistId = request.params.playlistid;
  if (nullOrUndefined(playlistId)) {
    response.redirect("/");
    return;
  }

  if (!request.session.authorization) {
    console.log(`[/playlist/${playlistId}] Invalid session, redirecting to login page`);
    response.redirect("/");
    return;
  }

  const { authorization, user, playlists } = request.session;
  const accessToken = authorization.accessToken;

  let playlist = await redisClient.get(playlistId);
  if (!playlist) {
    // If playlist is not cached, get from API
    const playlistResponse = await SpotifyAPI.getPlaylist(accessToken, playlistId);
    if (playlistResponse.success === false) {
      response.redirect("/");
      return;
    }

    playlist = playlistResponse.result;

    // Get tracks in playlist
    const tracksResponse = await SpotifyAPI.getPlaylistTracks(accessToken, playlist);
    if (tracksResponse.success == false) {
      next(tracksResponse.error);
      return;
    }

    // Save playlist in cache
    await redisClient.set(playlistId, JSON.stringify(playlist));
  } else {
    playlist = JSON.parse(playlist);
  }

  // Save playlist in session
  request.session.playlist = playlist;

  // build context
  const hideWarning = parseBoolean(request.cookies[HIDE_WARNING_COOKIE]) || false;
  const context = { user, playlist, playlists, playlistId, hideWarning };

  response.render("playlist", context);
}

async function shuffle(request, response, next) {
  // Check session
  if (!request.session.authorization) {
    response.redirect("/");
    return;
  }

  // Check if the user disabled the warning and set a cookie accordingly
  const hideWarning = parseBoolean(request.query[HIDE_WARNING_COOKIE]) || false;
  if (hideWarning) {
    response.cookie(HIDE_WARNING_COOKIE, true);
  }

  const playlist = request.session.playlist;
  const accessToken = request.session.authorization.accessToken;

  if (playlist.tracks.length === 0) {
    return;
  }

  //Delete tracks in playlist, shuffle and re-add tracks
  shufflePlaylist(playlist.tracks);
  await SpotifyAPI.clearPlaylist(accessToken, playlist);
  await SpotifyAPI.addTracksToPlaylist(accessToken, playlist);

  playlist.image = await SpotifyAPI.getPlaylistImage(accessToken, playlist);

  // Update cache
  await redisClient.set(playlist.id, JSON.stringify(playlist));

  response.json({ tracks: playlist.tracks, url: playlist.image });
  return;
}

function error(request, response) {
  const status = request.query.status || 500;
  const message = request.query.message || "Unknown error";
  return response.render("error", { status, message, css: ["error.css"] });
}

module.exports.login = login;
module.exports.logout = logout;
module.exports.authorization = authorization;
module.exports.home = home;
module.exports.playlist = playlist;
module.exports.shuffle = shuffle;
module.exports.error = error;
