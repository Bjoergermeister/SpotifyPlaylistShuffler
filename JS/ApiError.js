class ApiError extends Error {
  constructor(status, data, publicMessage, redirect) {
    let message;
    if ([401, 403, 429].includes(status)) {
      message = data.error.message;
    } else if (status === 400) {
      message = data.error;
    } else if (status === 500) {
      message = "Internal Server Error";
    }

    super(message);
    this.publicMessage = publicMessage;
    this.status = status;
    this.redirect = redirect;
  }
}

module.exports.ApiError = ApiError;
