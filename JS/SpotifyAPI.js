const fetch = require("node-fetch");
const { User, Authorization, Playlist } = require("./Spotify");
const { getEnvOrDie } = require("./Helper");

const BASE_URL = "https://api.spotify.com/v1";

const TRACKS_PER_REQUEST = 100;

class ApiResponse {
  constructor(success, error, result) {
    this.success = success;
    this.error = error;
    this.result = result;
  }
}

class SpotifyAPI {
  static getAuthorizationURL(client, state) {
    const baseAuthorizationURL = "https://accounts.spotify.com/authorize?";

    const params = new URLSearchParams();
    params.append("response_type", "code");
    params.append("client_id", client.id);
    params.append("scope", getEnvOrDie("SCOPE"));
    params.append("redirect_uri", getEnvOrDie("REDIRECT_URI"));
    params.append("state", state);

    return baseAuthorizationURL + params.toString();
  }

  static async receiveToken(client, code, redirectURI) {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectURI);

    const authorizationString = client.getAuthorizationString();
    const contentType = "application/x-www-form-urlencoded";
    const options = getRequestOptions("POST", authorizationString, contentType, params);

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", options);
      if (response.status !== 200) {
        return await getErrorResponse(response);
      }

      const body = await response.json();
      const authorization = new Authorization(body.access_token, body.refresh_token);
      return getSuccessResponse(authorization);
    } catch (error) {
      console.log(error);
      return getUnknownErrorResponse(error);
    }
  }

  static async refreshToken(client, refreshToken) {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: client.getAuthorizationString(),
      },
      body: params,
    };

    try {
      const url = "https://accounts.spotify.com/api/token";
      const response = await fetch(url, options);
      if (response.status !== 200) {
        return await getErrorResponse(response);
      }

      const body = await response.json();
      return getSuccessResponse(body.accessToken);
    } catch (error) {
      console.log(error);
      return getUnknownErrorResponse(error);
    }
  }

  static async getUserData(accessToken) {
    const options = getRequestOptions("GET", accessToken);

    const response = await fetch(`${BASE_URL}/me`, options);
    if (response.status !== 200) {
      return await getErrorResponse(response);
    }

    const body = await response.json();
    const user = new User(body.display_name, body.country, body.images[0].url, body.id);
    return getSuccessResponse(user);
  }

  static async getUserItems(accessToken) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const response = await fetch(`${BASE_URL}/me/top/artists`, options);
      if (response.status !== 200) {
        return await getErrorResponse(response);
      }

      const body = await response.json();
      return getSuccessResponse(body);
    } catch (error) {
      console.log(error);
      return getUnknownErrorResponse(error);
    }
  }

  static async getPlaylists(accessToken, id) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const url = `${BASE_URL}/users/${id}/playlists?fields=href,items(name, images, id, tracks.total)`;
      const response = await fetch(url, options);
      if (response.status !== 200) {
        return await getErrorResponse(response);
      }

      const body = await response.json();
      return getSuccessResponse(body.items);
    } catch (error) {
      console.log(error);
      return getUnknownErrorResponse(error);
    }
  }

  static async getPlaylist(accessToken, id) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const url = `${BASE_URL}/playlists/${id}?fields=id,images,name,tracks.total`;
      const response = await fetch(url, options);
      if (response.status !== 200) {
        return await getErrorResponse(response);
      }

      const body = await response.json();

      const imageUrl = body.images.length > 0 ? body.images[0].url : "";
      const playlist = new Playlist(body.name, body.id, imageUrl, body.tracks.total);

      return getSuccessResponse(playlist);
    } catch (error) {
      console.log(error);
      return getUnknownErrorResponse(error);
    }
  }

  static async getPlaylistImage(accessToken, playlist) {
    const options = getRequestOptions("GET", accessToken);
    const url = `${BASE_URL}/playlists/${playlist.id}?fields=images`;
    const response = await fetch(url, options);

    if (response.status !== 200) {
      return await getErrorResponse(response);
    }

    const data = await response.json();
    return data.images[0].url;
  }

  static async getPlaylistTracks(accessToken, playlist) {
    const options = getRequestOptions("GET", accessToken);

    const requests = [];

    for (let offset = 0; offset < playlist.totalTracks; offset += TRACKS_PER_REQUEST) {
      const limit = Math.min(TRACKS_PER_REQUEST, playlist.totalTracks - offset);

      const fields = "items(track(name,id,uri,album(name,images)))";
      const url = `${BASE_URL}/playlists/${playlist.id}/tracks?limit=${limit}&offset=${offset}&fields=${fields}`;
      requests.push(fetch(url, options));
    }

    // Check if any request failed
    const responses = await Promise.all(requests);
    if (responses.some((response) => response.status !== 200)) {
      return new ApiResponse(false, null, null);
    }

    const bodies = await Promise.all(responses.map((response) => response.json()));
    for (const body of bodies) {
      const newTracks = body.items.map((item) => item.track);
      playlist.addTracks(newTracks);
    }

    return getSuccessResponse(null);
  }

  static async clearPlaylist(accessToken, playlist) {
    const { tracks, id } = playlist;
    const requests = [];

    for (let offset = 0; offset < tracks.length; offset += TRACKS_PER_REQUEST) {
      const limit = Math.min(TRACKS_PER_REQUEST, tracks.length - offset);

      const body = {
        tracks: tracks.slice(offset, offset + limit).map((track) => ({ uri: track.uri })),
      };

      const options = getRequestOptions("DELETE", accessToken, body);
      const request = fetch(`${BASE_URL}/playlists/${id}/tracks`, options);
      requests.push(request);
    }

    const responses = await Promise.all(requests);
    const success = responses.every((response) => response.status === 200);
    return;
  }

  static async addTracksToPlaylist(accessToken, playlist) {
    const { tracks, id } = playlist;

    for (let offset = 0; offset < tracks.length; offset += TRACKS_PER_REQUEST) {
      const limit = Math.min(TRACKS_PER_REQUEST, tracks.length - offset);

      const body = {
        uris: tracks.slice(offset, offset + limit).map((track) => track.uri),
      };

      const options = getRequestOptions("POST", accessToken, body);
      await fetch(`${BASE_URL}/playlists/${id}/tracks`, options);
    }

    return getSuccessResponse(null);
  }
}

function getSuccessResponse(result) {
  return new ApiResponse(true, null, result);
}

async function getErrorResponse(response) {
  const data = await response.json();
  console.log(data, response.status);

  let errorMessage;
  if ([401, 403, 429].includes(response.status)) {
    errorMessage = { code: response.status, messsage: data.error.message };
  } else if (response.status === 400) {
    errorMessage = data.error_description;
  }

  return new ApiResponse(false, { code: response.status, message: errorMessage }, null);
}

function getUnknownErrorResponse(message) {
  return new ApiResponse(false, { code: 600, message }, null);
}

function getRequestOptions(method, accessToken, contentType, body) {
  const requestBody = body instanceof URLSearchParams ? body : JSON.stringify(body);

  return {
    method: method,
    headers: {
      "Content-Type": contentType || "application/json",
      Authorization: accessToken.startsWith("Basic")
        ? accessToken
        : `Bearer ${accessToken}`,
    },
    json: true,
    body: requestBody,
  };
}

module.exports.SpotifyAPI = SpotifyAPI;
