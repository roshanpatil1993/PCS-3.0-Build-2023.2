require("dotenv").config();
const https = require("https");
const fs = require('fs');
const host = process.env.MC_HOST;
const path = process.env.MC_PATH;
const userPath = process.env.MC_USER_PATH;

function urlToOptions(url) {
  const options = {
    protocol: url.protocol,
    hostname:
      typeof url.hostname === "string" && url.hostname.startsWith("[")
        ? url.hostname.slice(1, -1)
        : url.hostname,
    hash: url.hash,
    search: url.search,
    pathname: url.pathname,
    path: `${url.pathname || ""}${url.search || ""}`,
    href: url.href,
  };
  if (url.port !== "") {
    options.port = Number(url.port);
  }
  if (url.username || url.password) {
    options.auth = `${url.username}:${url.password}`;
  }
  return options;
}

function getOption(url, apiToken, resType) {
  let options = new URL(host + path + url);
  options = urlToOptions(options);
  options.headers = {
    authorization: `Bearer ${apiToken}`,
  };
  if (resType) {
    options.headers.accept = 'application/pdf';
  }
  options.timeout = 10000;
  return options;
}


function getUserOption(url, apiToken) {
  let options = new URL(host + userPath + url);
  options = urlToOptions(options);
  options.headers = {
    authorization: `Bearer ${apiToken}`,
  };
  return options;
}

async function download(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    let fileInfo = null;
    const request = https.request(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url.href}' (${response.statusCode})`));
      }
      fileInfo = {
        mime: response.headers['content-type'],
        size: parseInt(response.headers['content-length'], 10),
      };
      response.pipe(file);
    });
    file.on('finish', () => {
      resolve(fileInfo);
    });

    request.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    file.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    request.end();
  });
}


function doRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.setEncoding("utf8");
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        try {
          let resolveBody = responseBody ? JSON.parse(responseBody) : ''
          resolve(resolveBody);
        } catch (error) {
          resolve('')
        }        
      });
    });
    req.on("error", (err) => {
      console.log('rejected error', err)
      reject(err);
    });
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

module.exports = (dbClient, passport) => {

  async function get(url, token, isUserApi) {
    if (isUserApi) {
      const options = getUserOption(url, token);
      let result = await doRequest(options, null);
      return result;
    } else {
      const options = getOption(url, token);
      let result = await doRequest(options, null);
      return result;
    }
  };

  async function put(url, token, data) {
    const options = getOption(url, token);
    let result = await doRequest(options, data);
    return result;
  };


  async function post(url, token, data) {
    const options = getOption(url, token);
    let result = await doRequest(options, data);
    return result;
  };


  async function deleteReq(url, token, data) {
    const options = getOption(url, token);
    let result = await doRequest(options, data);
    return result;
  }

  async function downloadDoc(url, token, filePath) {
    const options = getOption(url, token, true);
    try {
      const re = await download(options, filePath);
      return re;
    }
    catch (err) {
      return false;
    }

  }

  return {
    get,
    put,
    post,
    deleteReq,
    downloadDoc
  };
};
