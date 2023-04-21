const fs = require('fs');
const path = require('path');
const LocalStrategy = require('passport-local').Strategy;
const JWTStrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const userCollectionName = process.env.INTERNAL_USER_COLLECTION_NAME;
const dbName = process.env.BASE_DB_NAME;
const httpReq = require("../mc/http")(null, null);

module.exports = (dbClient, passport) => {
  const publicKey = fs.readFileSync(path.join(__dirname, '../keys/public-key.pem'), 'utf8');
  passport.use(
    new LocalStrategy({
      usernameField: 'userName',
      passReqToCallback: true,
    }, async (req, username, password, done) => {
      const db = dbClient.db(dbName);
      process.nextTick(async () => {
        let query = `users/current-user?userId=${req.body.username}`;
        const db = dbClient.db(dbName);
        const resData = await httpReq.get(query, req.body.token, false);
        if (resData && (resData.status || resData.username)) {
          const user = await db 
            .collection(userCollectionName)
            .findOne({ userName: resData.username, isDeleted: false });
          if (user) {
            return req.logIn(user, { session: false }, (errLogin) => {
              if (errLogin) {
                return done(errLogin, false);
              }
              user.mcToken = req.body.token;
              const privateKey = fs.readFileSync(path.join(__dirname, '../keys/private-key.pem'), 'utf8');
              const token = jwt.sign(user, privateKey, {
                "algorithm": "RS256",
                "expiresIn": 3600000,
                "audience": "PrinterApp",
                "subject": "7292a7d6-74e0-4db1-8266-6fd089221fda",
                "issuer": "PrinterServer"
              });
              user.jwt = token;
              return done(null, user);
            });
          } else {
            return done(null, "NO_USER_FOUND");
          }
        } else {
          return done(null, false);
        }
      });
    }));

  passport.use(
    new JWTStrategy({
      secretOrKey: publicKey,
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      jsonWebTokenOptions: {
        "algorithm": "RS256",
        "expiresIn": 3600000,
        "audience": "PrinterApp",
        "subject": "7292a7d6-74e0-4db1-8266-6fd089221fda",
        "issuer": "PrinterServer"
      },
    }, (req, token, done) => {
      return done(null, token);
    }),
  );

  passport.serializeUser((user, cb) => {
    cb(null, user);
  });

  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });

};
