const fetch = require("node-fetch");
const { User, Authorization, Playlist } = require("./Spotify");
const { getEnvOrDie } = require("./Helper");

const baseURL = "https://api.spotify.com/v1/";
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

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: client.getBasicAuthorizationString(),
      },
      body: params,
    };

    try {
      const url = "https://accounts.spotify.com/api/token";
      const response = await fetch(url, options);
      if (response.status !== 200) {
        return new ApiResponse(false, null, null);
      }

      const body = await response.json();
      const authorization = new Authorization(body.access_token, body.refresh_token);
      return new ApiResponse(true, null, authorization);
    } catch (error) {
      console.log(error);
      return new ApiResponse(false, null, null);
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
        Authorization: client.getBasicAuthorizationString(),
      },
      body: params,
    };

    try {
      const url = "https://accounts.spotify.com/api/token";
      const response = await fetch(url, options);
      if (response.status !== 200) {
        const body = await response.json();
        return new ApiResponse(false, body, null);
      }

      const body = await response.json();
      console.log(body);
      return new ApiResponse(true, null, body.accessToken);
    } catch (error) {
      console.log(error);
      return new ApiResponse(false, null, null);
    }
  }

  static async getUserData(accessToken) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const response = await fetch(baseURL + "me", options);
      if (response.status !== 200) {
        return new ApiResponse(false, null, null);
      }

      const body = await response.json();
      const user = new User(body.display_name, body.country, body.images[0].url, body.id);
      return new ApiResponse(true, null, user);
    } catch (error) {
      console.log(error);
      return new ApiResponse(false, null, null);
    }
  }

  static async getUserItems(accessToken) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const response = await fetch(`${baseURL}me/top/artists`, options);
      if (response.status !== 200) {
        return new ApiResponse(false, null, null);
      }

      const body = await response.json();
      return new ApiResponse(true, null, body);
    } catch (error) {
      console.log(error);
      return new ApiResponse(false, null, null);
    }
  }

  static async getPlaylists(accessToken, id) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const url = `${baseURL}users/${id}/playlists?fields=href,items(name, images, id, tracks.total)`;
      const response = await fetch(url, options);
      if (response.status !== 200) {
        return new ApiResponse(false, null, null);
      }

      const body = await response.json();
      return new ApiResponse(true, null, body.items);
    } catch (error) {
      console.log(error);
      return new ApiResponse(false, null, null);
    }
  }

  static async getPlaylist(accessToken, id) {
    const options = getRequestOptions("GET", accessToken);

    try {
      const url = `${baseURL}playlists/${id}?fields=id,images,name,tracks.total`;
      const response = await fetch(url, options);
      if (response.status !== 200) {
        return new ApiResponse(false, null, null);
      }

      const body = await response.json();
      const playlist = new Playlist(
        body.name,
        body.id,
        body.images[0].url,
        body.tracks.total
      );

      return new ApiResponse(true, null, playlist);
    } catch (error) {
      console.log(error);
      return new ApiResponse(false, null, null);
    }
  }

  static async getPlaylistTracks(accessToken, playlist) {
    const options = getRequestOptions("GET", accessToken);

    const requests = [];

    for (let offset = 0; offset < playlist.totalTracks; offset += TRACKS_PER_REQUEST) {
      const limit = Math.min(TRACKS_PER_REQUEST, playlist.totalTracks - offset);

      const fields = "fields=items(track(name,id,uri,album,images))";
      const url = `${baseURL}playlists/${playlist.id}/tracks?limit=${limit}&offset=${offset}&fields=${fields}`;
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

    return new ApiResponse(true, null, null);
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
      const request = fetch(`${baseURL}playlists/${id}/tracks`, options);
      requests.push(request);
    }

    const responses = await Promise.all(requests);
    const success = responses.every((response) => response.status === 200);
    return new ApiResponse(success, null, null);
  }

  static async addTracksToPlaylist(accessToken, playlist) {
    const { tracks, id } = playlist;

    for (let offset = 0; offset < tracks.length; offset += TRACKS_PER_REQUEST) {
      const limit = Math.min(TRACKS_PER_REQUEST, tracks.length - offset);

      const body = {
        uris: tracks.slice(offset, offset + limit).map((track) => track.uri),
      };

      const options = getRequestOptions("POST", accessToken, body);
      await fetch(`${baseURL}playlists/${id}/tracks`, options);
    }

    return new ApiResponse(true, null, null);
  }
}

function getRequestOptions(method, accessToken, body) {
  return {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
    },
    json: true,
    body: JSON.stringify(body),
  };
}

module.exports.SpotifyAPI = SpotifyAPI;
