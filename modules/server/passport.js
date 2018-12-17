// var DB = require('./DB.js');
var DBQuery = require('./DBQuery.js');
var LocalStartegy = require('passport-local').Strategy;
var GoogleStrategy = require('passport-google-oauth20').Strategy;
var passport = require('passport');

var session = require('express-session'),
    RedisStore = require('connect-redis')(session),
    redisConfig = {
      host: '',
      port: '',
      // pass: 'aaa',
      auth_pass: ''
    },
    redis = require('redis'),
    redisClient;

    // redisUrl = 'redis://127.0.0.1:6379';
// var redisClient = require('redis').createClient(redisUrl);

(function connectRedis() {
  var fs = require('fs');
  var text = fs.readFileSync('RedisSetting.txt', 'utf8');
  var datas = text.split(',');
  redisConfig.auth_pass = datas[0];
  redisConfig.host = datas[1];
  redisConfig.port = datas[2];

  redisClient = redis.createClient(redisConfig);
  redisClient.on('connect', function() {
    console.log('Connected to redis!');

    redisClient.on('ready', ()=>{
      console.log('Redis ready!!');
    });
  });
  redisClient.on("error", function (err) {
      console.log("Error " + err);
  });
})();
// var redisClient = redis.createClient(redisConfig);
// redisClient.on('connect', function() {
//   console.log('Connected to redis!');
//
//   redisClient.on('ready', ()=>{
//     console.log('Redis ready!!');
//   });
// });
// redisClient.on("error", function (err) {
//     console.log("Error " + err);
// });

exports.setPassport = function() {
  passport.serializeUser(serialize());
  passport.deserializeUser(deserialize(DBQuery));
  passport.use(new LocalStartegy(
    function(username, password, cb) {
      DBQuery.createGuest(function(err, user) {
        return cb(err, user);
      });
    }
  ));
  passport.use(new GoogleStrategy({
      clientID: '699894960088-nmabbu9jpih79n38789ujd594d5h8mq9.apps.googleusercontent.com',
      clientSecret: 'uDjZL0OFH37kJnHTAUzD-5Si',
      callbackURL: '/auth/google/callback'
    },
    function(accessToken, refreshToken, profile, cb) {
      cb(null, profile);
    // User.findOrCreate({ googleId: profile.id }, function (err, user) {
      //   return done(err, user);
      // });
    }
  ));
}
function serialize() {
  return function(user, cb) {
    cb(null, user.id);
  }
}
function deserialize(DBQuery) {
  return function(id, cb) {
    DBQuery.findById(id, function(err, user) {
      if (err) { return cb(err); }
      cb(null, user);
    });
    // console.log('deserialize');
    // console.log(id);
    // db.user.findById(id, function(err, user) {
    //   if (err) return cb(err);
    //   cb(null, user);
    // });
  }
}
exports.setMiddleware = function(app) {
  app.use(session({
    store: new RedisStore({ client: redisClient, db: 13, ttl: 7 * 24 * 60 * 60 }),
    secret: '!!@@Secret Cat@@!!',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000, secure: false }
  }));

  app.use(function(req, res, next) {
    if(!req.session) {
      return next(new Error('cant find session'));
    }
    next();
  });
  app.use(passport.initialize());
  app.use(passport.session());

  return redisClient;
}
exports.setRouter = function(app) {
  app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile'] }));
  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/loginFail' }),
    getAuthSuccess);
  app.post('/playAsGuest',
    passport.authenticate('local', { failureRedirect: '/loginFail' }),
    createSuccess);
  app.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
      if (!res.headersSent) {
        res.clearCookie('connect.sid');
        res.redirect('/');
      }
    });
  });
}

function getAuthSuccess(req, res) {
  if (req.user) {
    // already login as guest
    if (req.session.userID) {
      // DBQuery.findOrCreate(req.user, onComplete);
      DBQuery.findOrMerging(req.session.userID, req.user, onComplete, onDuplicate);
    } else {
      DBQuery.findOrCreate(req.user, onComplete);
    }
  } else {
    res.redirect('/loginFail');
  }
  function onComplete(err, result) {
    if (err || !result) { res.redirect('/loginFail'); } //login fail
    else {
      req.session.userID = result.id;
      req.session.passport.user = result.id;
      req.user = result;
      var userData = exports.setUserData(req.user);
      // _u = user name, _d = joined user, _a = is authenticated
      res.render('loginComplete', { _u: userData, _d: false, _a: true });
    }
  }
  function onDuplicate(err, result) {
    req.session.passport.user = req.session.userID;
    if (err) { res.redirect('/loginFail'); } //fail
    else { res.render('loginComplete', { _u: null, _d: true, _a: false }); }
  }
}
function createSuccess(req, res) {
  if (req.user) {
    req.session.userID = req.user.id;
    req.session.passport.user = req.user.id;
    res.redirect('/');
  } else {
    res.redirect('/loginFail');
  }
}

exports.setUserData = function(user) {
  if (user) {
    return {
      n : user.displayName,
      l : user.levels,
      f : user.skills ? false : true
    }
  } else {
    return null;
  }
}
