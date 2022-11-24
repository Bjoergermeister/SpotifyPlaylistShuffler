const fetch = require("node-fetch");
const { ApiError } = require("./ApiError");
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

    try {
      const options = getAuthorizationRequestOptions(client.toString(), params);
      const response = await fetch("https://accounts.spotify.com/api/token", options);
      const body = await response.json();

      if (response.status !== 200) {
        throw new ApiError(response.status, body, "Receiving token failed", true);
      }

      const authorization = new Authorization(body.access_token, body.refresh_token);
      return getSuccessResponse(authorization);
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async refreshToken(client, refreshToken) {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    try {
      const options = getAuthorizationRequestOptions(client.toString(), params);
      const response = await fetch("https://accounts.spotify.com/api/token", options);
      const body = await response.json();

      if (response.status !== 200) {
        throw new ApiError(response.status, body, "Refreshing token failed", true);
      }

      return getSuccessResponse(body.accessToken);
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async getUserData(accessToken) {
    try {
      const options = getRequestOptions("GET", accessToken);

      const response = await fetch(`${BASE_URL}/me`, options);
      const body = await response.json();

      if (response.status !== 200) {
        throw new ApiError(response.status, body, "Getting user data failed", false);
      }

      const user = new User(body.display_name, body.country, body.images[0].url, body.id);
      return getSuccessResponse(user);
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async getUserItems(accessToken) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const response = await fetch(`${BASE_URL}/me/top/artists`, options);
      const body = await response.json();

      if (response.status !== 200) {
        throw new ApiError(response.status, body, "Getting user items failed", false);
      }

      return getSuccessResponse(body);
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async getPlaylists(accessToken, id) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const url = `${BASE_URL}/users/${id}/playlists?fields=href,items(name, images, id, tracks.total)`;
      const response = await fetch(url, options);
      const body = await response.json();

      if (response.status !== 200) {
        throw new ApiError(response.status, body, "Getting playlists failed", false);
      }

      return getSuccessResponse(body.items);
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async getPlaylist(accessToken, id) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const url = `${BASE_URL}/playlists/${id}?fields=id,images,name,tracks.total`;
      const response = await fetch(url, options);
      const body = await response.json();

      if (response.status !== 200) {
        throw new ApiError(response.status, body, "Getting playlist failed", false);
      }

      const imageUrl = body.images.length > 0 ? body.images[0].url : "";
      const playlist = new Playlist(body.name, body.id, imageUrl, body.tracks.total);

      return getSuccessResponse(playlist);
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async getPlaylistImage(accessToken, playlist) {
    try {
      const options = getRequestOptions("GET", accessToken);
      const url = `${BASE_URL}/playlists/${playlist.id}?fields=images`;
      const response = await fetch(url, options);
      const body = await response.json();

      if (response.status !== 200) {
        throw new ApiError(response.stauts, body, "Getting playlist image failed", false);
      }

      return body.images[0].url;
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async getPlaylistTracks(accessToken, playlist) {
    try {
      const options = getRequestOptions("GET", accessToken);

      const requests = [];

      for (let offset = 0; offset < playlist.totalTracks; offset += TRACKS_PER_REQUEST) {
        const limit = Math.min(TRACKS_PER_REQUEST, playlist.totalTracks - offset);

        const fields = "items(track(name,id,uri,duration_ms,album(name,images)))";
        const url = `${BASE_URL}/playlists/${playlist.id}/tracks?limit=${limit}&offset=${offset}&fields=${fields}`;
        requests.push(fetch(url, options));
      }

      const responses = await Promise.all(requests);

      // Check if any request failed
      const failedResponse = responses.find((response) => response.status !== 200);
      if (failedResponse !== undefined) {
        const body = await failedResponse.json();
        const message = "Getting playlist tracks failed";
        throw new ApiError(failedResponse.status, body, message, false);
      }

      const bodies = await Promise.all(responses.map((response) => response.json()));

      // Transform responses and calculate combined track length
      let totalDuration = 0;
      for (const body of bodies) {
        const newTracks = body.items.map((item) => {
          const durationInSeconds = Math.round(parseInt(item.track.duration_ms) / 1000);
          totalDuration += durationInSeconds;
          const minutes = Math.floor(durationInSeconds / 60);
          const seconds = durationInSeconds % 60;
          item.track.duration_ms = `${minutes}:${seconds.toString().padStart(2, "0")}`;
          return item.track;
        });
        playlist.addTracks(newTracks);

        const hours = Math.floor(totalDuration / 3600);
        const minutes = Math.floor((totalDuration / 60) % 60);
        playlist.totalDuration = `${hours} Stunden, ${minutes} Minuten`;
      }

      return getSuccessResponse(null);
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async clearPlaylist(accessToken, playlist) {
    try {
      const { tracks, id } = playlist;
      const requests = [];

      for (let offset = 0; offset < tracks.length; offset += TRACKS_PER_REQUEST) {
        const limit = Math.min(TRACKS_PER_REQUEST, tracks.length - offset);

        const body = {
          tracks: tracks
            .slice(offset, offset + limit)
            .map((track) => ({ uri: track.uri })),
        };

        const options = getRequestOptions("DELETE", accessToken, body);
        const request = fetch(`${BASE_URL}/playlists/${id}/tracks`, options);
        requests.push(request);
      }

      const responses = await Promise.all(requests);

      // Look for a failed request. If there is any, get the data from that request and return an error response.
      // Else, return an successful response
      const failedResponse = responses.find((response) => response.status !== 200);
      if (failedResponse !== undefined) {
        const body = await failedResponse.json();
        const message = "Clearing playlist failed";
        throw new ApiError(failedResponse.status, body, message, false);
      }

      return getSuccessResponse(null);
    } catch (error) {
      return getErrorResponse(error);
    }
  }

  static async addTracksToPlaylist(accessToken, playlist) {
    try {
      const { tracks, id } = playlist;

      for (let offset = 0; offset < tracks.length; offset += TRACKS_PER_REQUEST) {
        const limit = Math.min(TRACKS_PER_REQUEST, tracks.length - offset);

        const uris = tracks.slice(offset, offset + limit).map((track) => track.uri);
        const body = { uris };

        const options = getRequestOptions("POST", accessToken, body);
        const response = await fetch(`${BASE_URL}/playlists/${id}/tracks`, options);
        if (response.status !== 201) {
          const result = await response.json();
          const message = "Adding tracks to playlist failed";
          throw new ApiError(response.status, result, message, false);
        }
      }

      return getSuccessResponse(null);
    } catch (error) {
      return getErrorResponse(error);
    }
  }
}

function getSuccessResponse(result) {
  return new ApiResponse(true, null, result);
}

function getErrorResponse(error) {
  return new ApiResponse(false, error, null);
}

function getAuthorizationRequestOptions(authorizationString, body) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authorizationString}`,
    },
    body,
  };
}

function getRequestOptions(method, accessToken, body) {
  return {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    json: true,
    body: JSON.stringify(body),
  };
}

module.exports.SpotifyAPI = SpotifyAPI;
