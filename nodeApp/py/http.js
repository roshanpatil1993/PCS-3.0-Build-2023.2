require("dotenv").config();
const http = require("http");
const host = process.env.PY_HOST;

function urlToOptions(url) {
    const options = {
        protocol: url.protocol,
        method: 'POST',        
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

function getOption(url) {
    let options = new URL(host + url);
    options = urlToOptions(options);
    options.headers = { 'Content-Type': 'application/json' };
    options.timeout = 6000;
    return options;
}


function doRequest(options, data) {
	console.log("this is doRequest: ", options)
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            res.setEncoding("utf8");
            let responseBody = "";
            res.on("data", (chunk) => {
                responseBody += chunk;
            });
            res.on("end", () => {
                try {
                    resolve(responseBody ? JSON.parse(responseBody) : '');
                } catch (e) {
                    resolve(responseBody)
                }
            });
        });
        req.on("error", (err) => {
            reject(err);
        });
        if (data) {
            req.write(data);
        }
        req.end();
    });
}

module.exports = (dbClient, passport) => {

    async function post(url, data) {          
        const options = getOption(url);
        let result = await doRequest(options, data);
        return result;
    };

    return {
        post,      
    };
};
