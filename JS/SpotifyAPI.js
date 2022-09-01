const fetch = require("node-fetch");
const { User, Authorization, Playlist } = require("./Spotify");

const baseURL = "https://api.spotify.com/v1/";

class SpotifyAPI {
  static getAuthorizationURL(client, process, state) {
    const baseAuthorizationURL = "https://accounts.spotify.com/authorize?";

    const params = new URLSearchParams();
    params.append("response_type", "code");
    params.append("client_id", client.id);
    params.append("scope", process.env.SCOPE);
    params.append("redirect_uri", process.env.REDIRECT_URI);
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

    return await fetch("https://accounts.spotify.com/api/token", options)
      .then(async (result) => {
        if (result.status !== 200) {
          return [false, null];
        }

        const body = await result.json();

        return [true, new Authorization(body.access_token, body.refresh_token)];
      })
      .catch((error) => console.log(error));
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

    const result = await fetch(
      "https://accounts.spotify.com/api/token",
      options
    )
      .then(async (result) => {
        if (result.status !== 200) return null;

        const body = await result.json();
        return body.access_token;
      })
      .catch((error) => {
        console.log(error);
        return null;
      });

    return {
      success: result !== null,
      result: result,
    };
  }

  static async getUserData(accessToken) {
    const options = getRequestOptions("GET", accessToken);

    const response = await fetch(baseURL + "me", options)
      .then(async (result) => {
        if (result.status === 200) {
          const data = await result.json();
          return [
            true,
            new User(
              data.display_name,
              data.country,
              data.images[0].url,
              data.id
            ),
          ];
        } else {
          return [false, null];
        }
      })
      .catch((error) => {
        console.log(error);
      });

    return response;
  }

  static async getUserItems(accessToken) {
    const options = getRequestOptions("GET", accessToken);
    await fetch(baseURL + "me/top/artists", options)
      .then((response) => {
        return response.json();
      })
      .then((json) => console.log(json));
  }

  static async getPlaylists(accessToken, id) {
    const options = getRequestOptions("GET", accessToken);

    const response = await fetch(
      baseURL +
        `users/${id}/playlists?fields=href,items(name, images, id, tracks.total)`,
      options
    )
      .then(async (result) => {
        if (result.status !== 200) {
          return [false, null];
        }

        const data = await result.json();
        return [true, data.items];
      })
      .catch((error) => console.log("API Error: " + error));

    return response;
  }

  static async getPlaylist(accessToken, id) {
    const options = getRequestOptions("GET", accessToken);

    return await fetch(
      baseURL + `playlists/${id}?fields=id,images,name,tracks.total`,
      options
    )
      .then(async (result) => {
        const { id, name, images, tracks } = await result.json();
        return [true, new Playlist(name, id, images[0].url, tracks.total)];
      })
      .catch((error) => {
        return [false, null];
      });
  }

  static async getTracksFromPlaylist(accessToken, id, playlist) {
    const options = getRequestOptions("GET", accessToken);

    let promises = [];

    let offset = 0;
    let limit = 100;

    while (offset < playlist.totalTracks) {
      limit =
        offset + 100 < playlist.totalTracks
          ? 100
          : playlist.totalTracks - offset;
      // await fetch(baseURL + `playlists/${id}/tracks?limit=${limit}&offset=${offset}&fields=items(track(name,id,uri,images(url)))`, options)
      await fetch(
        baseURL +
          `playlists/${id}/tracks?limit=${limit}&offset=${offset}&fields=items(track(name, id, uri, album(name, images)))`,
        options
      )
        .then((result) => {
          if (result.status !== 200) {
            return false;
          }
          promises.push(result.json());
        })
        .catch((error) => console.log("API Error: " + error));

      offset += 100;
    }

    return await Promise.all(promises).then((requests) => {
      requests.forEach((request) => {
        const newTracks = request.items.map((item) => item.track);
        playlist.addTracks(newTracks);
      });

      return true;
    });
  }

  static async clearPlaylist(accessToken, id, tracks) {
    const responses = [];

    let offset = 0;
    let limit = 100;

    while (offset < tracks.length) {
      limit = offset + 100 < tracks.length ? 100 : tracks.length - offset;

      const body = {
        tracks: tracks.slice(offset, offset + limit).map((track) => {
          return { uri: track.uri };
        }),
      };

      const options = getRequestOptions("DELETE", accessToken, body);

      const response = fetch(baseURL + `playlists/${id}/tracks`, options);
      responses.push(response);

      offset += 100;
    }

    const result = await Promise.all(responses)
      .then((results) => {
        return results.every((result) => {
          return result.status === 200;
        });
      })
      .catch((error) => {
        return false;
      });

    return [true];
  }

  static async addTracksToPlaylist(accessToken, id, tracks) {
    let offset = 0;
    let limit = 100;

    while (offset < tracks.length) {
      limit = offset + 100 < tracks.length ? 100 : tracks.length - offset;

      const body = {
        uris: tracks.slice(offset, offset + limit).map((track) => track.uri),
      };
      const options = getRequestOptions("POST", accessToken, body);
      const result = await fetch(baseURL + `playlists/${id}/tracks`, options);
      offset += 100;
    }

    return [true];
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
