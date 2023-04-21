var express = require("express");
const host = process.env.PY_HOST;
const helmet = require("helmet");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");
const compression = require("compression");
//const axios = require('axios')
const fs = require('fs');
const docDir = './../resources/docs';
const outputDir = './../resources/output';
const templateDir = './../resources/templates';
const formFiledTemplate = './../resources/formFiledTemplate'


if (!fs.existsSync(docDir)) {
  fs.mkdirSync(docDir);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}


if (!fs.existsSync(templateDir)) {
  fs.mkdirSync(templateDir);
}

if (!fs.existsSync(formFiledTemplate)) {
  fs.mkdirSync(formFiledTemplate);
}

var app = express();

app.use(helmet());
app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:4200"],
    credentials: true,
    methods: "GET,PUT,POST,DELETE",
  })
);
app.use(compression());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


app.get("/download/:docId", function (req, res) {
	try{
  const file = "/output/" + req.params.docId;
  // const filePath = __dirname + file;
const filePath = path.join(__dirname,'../resources')
 /* axios({
    url: `http://65.1.13.171:6050/pyApi/fileDownload?path=${filePath}`, //your url
    method: 'GET',
    responseType: 'blob', // important
    })
    .then((resp) => {console.log("Success :: "+resp) 
	           return res.send(resp)
                   })  
    .catch((err) =>{return res.send("Error in AXIOS :: "+err)})
*/
 sleep(5000).then(() =>  res.sendFile(filePath + file));
	} catch(error){
           console.log("error in download:", error)
	   return res.send("Error in download :: "+error)
	}
	
});

app.use(logger("dev"));
app.use(
  express.json({
    limit: "5mb",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
    parameterLimit: 10,
  })
);
app.use(cookieParser());

app.options("*", (req, res) => {
  res.send(200);
});

module.exports = app;
