class Client {
    constructor(id, secret){
        this.id = id;
        this.secret = secret;
    }

    getBasicAuthorizationString(){
        return "Basic " + Buffer.from(this.id + ":" + this.secret).toString("base64");
    }    
}

class Authorization {
    constructor(accessToken, refreshToken){
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenTimestamp = Date.now();
    }

    isExpired(){
        const passedTimeSinceTokenReceived = Date.now() - this.tokenTimestamp;
        const millisecondsInOneHour = 60 * 60 * 1000;
        
        return passedTimeSinceTokenReceived > millisecondsInOneHour;
    }
}

class User {
    constructor(name, country, image, id)
    {
        this.name = name;
        this.country = country;
        this.image = image;
        this.id = id;
    }
}

class Playlist {
    constructor(name, id, image, totalTracks){
        this.name = name;
        this.id = id;
        this.image = image;
        this.totalTracks = totalTracks;

        this.tracks = [];
    }

    addTracks = (newTracks) => this.tracks.push(...newTracks);

    shuffle(){
        var j, x, i;
        for (i = this.tracks.length - 1; i > 0; i--) {
            do {
                j = Math.floor(Math.random() * (i + 1));
            }while(i === j)
            x = this.tracks[i];
            this.tracks[i] = this.tracks[j];
            this.tracks[j] = x;
        }
    }
}

module.exports.Client = Client;
module.exports.Authorization = Authorization;
module.exports.User = User;
module.exports.Playlist = Playlist;