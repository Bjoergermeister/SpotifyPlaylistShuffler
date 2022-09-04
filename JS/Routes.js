const { SpotifyAPI } = require("./SpotifyAPI");
const { Client } = require("./Spotify");

const {
  generateRandomString,
  shufflePlaylist,
  nullOrUndefined,
  getEnvOrDie,
} = require("./Helper");

//Authorization variables
const client = new Client(getEnvOrDie("CLIENT_ID"), getEnvOrDie("CLIENT_SECRET"));

const stateKey = getEnvOrDie("STATE_KEY");

function login(request, response) {
  //Preparing authorization
  const state = generateRandomString(16);
  response.cookie(stateKey, state);

  response.redirect(SpotifyAPI.getAuthorizationURL(client, state));
}

function logout(request, response) {
  request.session.destroy();
  response.redirect("/");
}

async function authorization(request, response) {
  var code = request.query.code || null;
  var state = request.query.state || null;
  var storedState = request.cookies ? request.cookies[stateKey] : null;

  if (state === null || storedState !== state) {
    response.redirect("error");
    return;
  }

  response.clearCookie(stateKey);

  const redirectURI = getEnvOrDie("REDIRECT_URI");
  const tokenResponse = await SpotifyAPI.receiveToken(client, code, redirectURI);
  if (tokenResponse.success === false) {
    console.log("[SpotifyAPI] Receiving token failed");
    response.redirect("/");
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

async function home(request, response) {
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
    console.log("[SpotifyAPI] Getting playlist failed");
    response.redirect("/");
    return;
  }

  const playlists = playlistsResponse.result;
  request.session.playlists = playlists;

  //Render page
  response.render("home", { user, playlists });
}

async function playlist(request, response) {
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

  // Get playlist
  const playlistResponse = await SpotifyAPI.getPlaylist(accessToken, playlistId);
  if (playlistResponse.success === false) {
    response.redirect("/");
    return;
  }

  const playlist = playlistResponse.result;
  request.session.playlist = playlist;

  // Get tracks in playlist
  const tracksResponse = await SpotifyAPI.getPlaylistTracks(accessToken, playlist);
  if (tracksResponse.success == false) {
    response.redirect("/");
    return;
  }

  const context = { user, playlist, playlists, playlistId };
  response.render("playlist", context);
}

async function shuffle(request, response) {
  // Check session
  if (!request.session.authorization) {
    request.redirect("/");
    return;
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

  response.json(playlist.tracks);
  return;
}

module.exports.login = login;
module.exports.logout = logout;
module.exports.authorization = authorization;
module.exports.home = home;
module.exports.playlist = playlist;
module.exports.shuffle = shuffle;
