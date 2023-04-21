const async = require('async');
const mClient = require('mongodb').MongoClient;

const URI = process.env.DB_HOST;
const database = {};
database['dbs'] = async.apply(mClient.connect, URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  poolSize: 10,
});

module.exports = (cb) => {
  async.parallel(database, cb);
};
