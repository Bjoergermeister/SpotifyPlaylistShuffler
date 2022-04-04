const fetch = require("node-fetch"); 
const querystring = require("querystring");
const { Session } = require("./Session");
const { User, Authorization, Playlist } = require("./Spotify");

const baseURL = "https://api.spotify.com/v1/";

class SpotifyAPI {

    static getAuthorizationURL(client, process, state){
        const baseAuthorizationURL = "https://accounts.spotify.com/authorize?";
        return baseAuthorizationURL + querystring.stringify({
            response_type: "code",
            client_id: client.id,
            scope: process.env.SCOPE,
            redirect_uri: process.env.REDIRECT_URI,
            state: state,
        });
    }

    static async receiveToken(client, code, redirectURI){

        const params = new URLSearchParams();
        params.append("grant_type", "authorization_code");
        params.append("code", code);
        params.append("redirect_uri", redirectURI);

        const options = {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded", "Authorization": client.getBasicAuthorizationString()},
            body: params
        };
        
        return await fetch("https://accounts.spotify.com/api/token", options)
        .then(async (result) => {
            if (result.status !== 200) {
                return {"success": false };
            }

            const body = await result.json();

            const authorization = new Authorization(body.access_token, body.refresh_token);
            const session = new Session(authorization);
            const cookie = session.getSessionCookie();

            return {
                "success": true, 
                session, 
                cookie
            };
        })
        .catch((error) => console.log(error));
    }

    static async refreshToken(client, refreshToken){

        const params = new URLSearchParams();
        params.append("grant_type", "refresh_token");
        params.append("refresh_token", refreshToken);

        const options = {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded", "Authorization": client.getBasicAuthorizationString()},
            body: params
        };

        const result = await fetch("https://accounts.spotify.com/api/token", options)
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
            "success": result !== null,
            result: result
        };
    }

    static async getUserData(accessToken){
        const options = getRequestOptions("GET", accessToken)

        const response = await fetch(baseURL + "me", options)
        .then(async (result) => {
            if (result.status === 200){
                const data = await result.json();
                return { "success": true, data: new User(data.display_name, data.country, data.images[0].url, data.id)};
            }else{
                return { "success": false, data: {}};
            }
        })
        .catch((error) => {
            console.log(error);
        });

        return response;

    }

    static async getPlaylists(accessToken, id){
        const options = getRequestOptions("GET", accessToken);

        let playlist = null;

        const response = await fetch(baseURL + `users/${id}/playlists?fields=href,items(name, images, id, tracks.total)`, options)
            .then(async (result) => {
                if (result.status !== 200) return {"success": false};
                const data = await result.json();
                return {"success": true, data: data.items};
            })
            .catch((error) => console.log("API Error: " + error));

        return response;
    }

    static async getPlaylist(accessToken, id){
        const options = getRequestOptions("GET", accessToken);

        return await fetch(baseURL + `playlists/${id}?fields=id,images,name,tracks.total`, options)
            .then(async (result) => {
                const { id, name, images, tracks } = await result.json();
                return {"success": true, data: new Playlist(name, id, images[0].url, tracks.total)};
            })
            .catch((error) => {
                return {"success": false};
            });
    }

    static async getTracksFromPlaylist(accessToken, id, playlist){
        const options = getRequestOptions("GET", accessToken);

        let promises = [];

        let offset = 0;
        let limit = 100;

        while(offset < playlist.totalTracks)
        {
            limit = (offset + 100 < playlist.totalTracks) ? 100 : playlist.totalTracks - offset;
            await fetch(baseURL + `playlists/${id}/tracks?limit=${limit}&offset=${offset}&fields=items(track(name,id,uri))`, options)
            .then((result) => {
                if (result.status !== 200) return {"success": false};
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

            return {"success": true}
        });
    }

    static async clearPlaylist(accessToken, id, tracks){
        const responses = [];

        let offset = 0;
        let limit = 100;

        while(offset < tracks.length)
        {
            limit = (offset + 100 < tracks.length) ? 100 : tracks.length - offset;

            const body = {tracks: tracks.slice(offset, offset + limit)};
            const options = getRequestOptions("DELETE", accessToken, body);

            const response = fetch(baseURL + `playlists/${id}/tracks`, options);
            responses.push(response);

            offset += 100;
        }

        const result = await Promise.all(responses).then((results) => {
            return results.every((result) => result.status === 200);
        })
        .catch((error) => {
            return false;
        });

        return {"Success": result};
    }

    static async addTracksToPlaylist(accessToken, id, tracks){
        const responses = [];

        let offset = 0;
        let limit = 100;

        while(offset < tracks.length)
        {
            limit = (offset + 100 < tracks.length) ? 100 : tracks.length - offset;

            const body = {uris: tracks.slice(offset, offset + limit).map((track) => track.uri)};

            const options = getRequestOptions("POST", accessToken, body);

            const response = fetch(baseURL + `playlists/${id}/tracks`, options);
            responses.push(response);

            offset += 100;
        }

        const result = await Promise.all(responses).then((results) => {
            return results.every((result) => result.status === 200);
        })
        .catch((error) => {
            return false;
        });

        return {"Success": result};
    }
}

function getRequestOptions(method, accessToken, body){

    return {
        method: method,
        headers: {"Content-Type": "application/json", "Authorization": "Bearer " + accessToken},
        json: true,
        body: JSON.stringify(body)
    };

}

module.exports.SpotifyAPI = SpotifyAPI;