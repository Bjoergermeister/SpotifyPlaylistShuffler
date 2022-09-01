// Handlebars helper functions
function increment(value, options) {
  return value + 1;
}

function isSelectedPlaylist(playlistId, selectedPlaylistId, options) {
  return playlistId === selectedPlaylistId;
}

function hashPlaylistName(name, maxValue = 360) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return sum % maxValue;
}

function getColorForPlaylist(name) {
  const sum = hashPlaylistName(name);
  return `linear-gradient(180deg, hsl(${sum}, 90%, 20%) 20%, hsl(${sum}, 95%, 5%) 70%)`;
}

// General helper functions
function nullOrUndefined(value) {
  if (value === null || value === undefined) {
    console.log("The value is null or undefined");
    return true;
  }

  return false;
}

function generateRandomString(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

module.exports.increment = increment;
module.exports.isSelectedPlaylist = isSelectedPlaylist;
module.exports.getColorForPlaylist = getColorForPlaylist;
module.exports.nullOrUndefined = nullOrUndefined;
module.exports.generateRandomString = generateRandomString;
