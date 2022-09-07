// Handlebars helper functions
function increment(value) {
  return value + 1;
}

function getColorForPlaylist(name, maxValue = 360) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return sum % maxValue;
}

function condition(expression1, operator, expression2) {
  switch (operator) {
    case "==":
      return expression1 === expression2;
  }
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
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function shufflePlaylist(tracks) {
  var j, x, i;
  for (i = tracks.length - 1; i > 0; i--) {
    do {
      j = Math.floor(Math.random() * (i + 1));
    } while (i === j);
    x = tracks[i];
    tracks[i] = tracks[j];
    tracks[j] = x;
  }
}

function getEnvOrDie(name) {
  if (!process.env[name]) {
    console.error(`FATAL: No envvar with name ${name}`);
  }

  return process.env[name];
}

function parseBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

module.exports.increment = increment;
module.exports.getColorForPlaylist = getColorForPlaylist;
module.exports.condition = condition;

module.exports.nullOrUndefined = nullOrUndefined;
module.exports.generateRandomString = generateRandomString;
module.exports.shufflePlaylist = shufflePlaylist;
module.exports.getEnvOrDie = getEnvOrDie;
module.exports.parseBoolean = parseBoolean;
