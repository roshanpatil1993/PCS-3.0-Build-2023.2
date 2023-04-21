exports.raiseError = (req, res, next, errorcode, httpstatus, message) => {
    const returnMessage = {
      status: 'fail',
    };
    if (message) {
      returnMessage.message = message;
    } 
    returnMessage.messageCode = errorcode;
    returnMessage.httpStatus = Number(httpstatus);
    res.status(Number(httpstatus)).send(returnMessage);
  };