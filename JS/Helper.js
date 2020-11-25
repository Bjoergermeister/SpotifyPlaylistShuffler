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
};

module.exports.nullOrUndefined = nullOrUndefined;
module.exports.generateRandomString = generateRandomString;