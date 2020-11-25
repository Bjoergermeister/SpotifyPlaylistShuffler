const {nullOrUndefined, generateRandomString} = require("./Helper");
const { SpotifyAPI } = require("./SpotifyAPI");

class Session {

  constructor(authorization){
    this.id = generateRandomString(32);
    this.authorization = authorization;
    this.currentPlaylist = null;
  }

  getSessionCookie(){
    const maxAge = 24 * 60 * 60; //Expires after 24 hours
    const httpOnly = true;

    return {name: "session", sessionID: this.id, maxAge, httpOnly};
  }

  async refreshIfExpired(client){
    if (this.authorization.isExpired() === false) return;

    const result = await SpotifyAPI.refreshToken(client, this.authorization.refreshToken);
    if (result.success === false) return;

    console.log(result);

    this.authorization.accessToken = result.data;
  }

  static getFromRequest(request, sessions){
    const { cookies } = request;
 
    if ( ("session" in cookies) === false) return null;
    const session = cookies.session;
    
    if (nullOrUndefined(session)) return null;
    if (sessions.has(session) == false) {
      console.log(`No session found for session id ${session}`);
      return null;
    }

    return sessions.get(session);
  }

}

module.exports.Session = Session;