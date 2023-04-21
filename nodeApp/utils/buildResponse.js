exports.send = (req, res) => {
  const responseObj = {};
  if (req.error) {
    responseObj.status = 'fail';
    responseObj.httpStatus = req.errorCode ? req.errorCode : 500;
    responseObj.message = req.error;
    res.status(Number(req.errorCode)).send(responseObj);
  } else {
    responseObj.status = 'success';
    responseObj.httpStatus = 200;
    if (req.payload) {
      responseObj.payload = req.payload;
    }
    if (req.count) {
      responseObj.count = req.count;
    }
    if (req.token) {
      responseObj.token = req.token;
    }
    res.send(responseObj);
  }
};
