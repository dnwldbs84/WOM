var http = require('http');
var express = require('express');
// var socketio = require('socket.io');
var WebSocket = require('ws');
var bodyParser = require('body-parser');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var path = require('path');
var fs = require('fs');

var csvJson = require('./modules/public/csvjson.js');
var objectAssign = require('./modules/public/objectAssign.js');

var app = express();

var DBQuery = require('./modules/server/DBQuery.js');
var passport = require('./modules/server/passport.js');
passport.setPassport();
var redisClient;

var config = require('./config.json');
var gameConfig = require('./modules/public/gameConfig.json');
var serverConfig = require('./modules/server/serverConfig.json');

var dataJson = require('./modules/public/data.json');
var serverDataJson = require('./modules/server/serverData.json');
var csvJsonOption = {delimiter : ',', quote : '"'};

var userBaseTable = csvJson.toObject(serverDataJson.userBase, csvJsonOption);
var skillTable = csvJson.toObject(dataJson.skillData, csvJsonOption);
var userStatTable = csvJson.toObject(dataJson.userStatData, csvJsonOption);
// var buffTable = csvJson.toObject(dataJson.buffData, csvJsonOption);

var util = require('./modules/public/util.js');

var isServerDown = false, serverDownTimeout = false;

// change max event listener 10 to 100
require('events').EventEmitter.prototype._maxListeners = 100;

var allowCORS = function(req, res, next) {
  var allowedOrigins = ['http://worldofmage.io', 'http://localhost', 'http://www.worldofmage.io'];
  var origin = req.headers.origin;
  if(allowedOrigins.indexOf(origin) > -1){
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Max-Age', 10);
  (req.method === 'OPTIONS') ?
    res.sendStatus(200) :
    next();
};

app.use(allowCORS);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
    if (req.url != '/favicon.ico') {
      return next();
    } else {
      res.status(200);
      res.header('Content-Type', 'image/x-icon');
      res.header('Cache-Control', 'max-age=4294880896');
      res.end();
    }
  });
// route post event before set passport
app.post('/usersInfo', function(req, res){
  if(!req.body){
    res.sendStatus(400);
  }else if(GM){
    var cUser = Object.keys(GM.users).length;
    var mUser = serverConfig.MAX_USER_COUNT;
    res.send({ip : req.body.ip, startTime : req.body.startTime,
             currentUser : cUser, maxUser : mUser, optionIndex : req.body.optionIndex, isServerDown : isServerDown});
  }else{
    res.sendStatus(400);
  }
});

app.post('/serverCheck', function(req, res){
  if(!req.body){
    res.sendStatus(400);
  }else if(GM){
    if(Object.keys(GM.users).length < serverConfig.MAX_USER_COUNT &&
       req.body.version === gameConfig.GAME_VERSION && !isServerDown){
      res.send({canJoin : true});
    }else{
      res.send({canJoin : false, isServerDown : isServerDown, version : gameConfig.GAME_VERSION});
    }
  }else{
    res.send({canJoin : false, isServerDown : isServerDown, version : gameConfig.GAME_VERSION});
  }
});

app.post('/instruction', function(req, res){
  if(req.body){
    if(req.body.pw === serverConfig.OPERATION_TOOL_PASSWORD){
      if(req.body.instruction === serverConfig.OPERATION_MSG_TO_USER){
        if(wss){
          // io.sockets.emit('adminMessage', req.body.msg)
          messageToClient('public', util.makePacketForm(gameConfig.MTYPE_ADMIN_MESSAGE, req.body.msg));
        }
        res.send({correctPW : true, correctInstruction : true});
      }else if(req.body.instruction === serverConfig.OPERATION_DOWN_SERVER){
        if(wss){
          var time = parseInt(req.body.time);
          if(time && time > 0){
            isServerDown = true;
            messageToClient('public', util.makePacketForm(gameConfig.MTYPE_DOWN_SERVER, req.body.msg, req.body.time));
            serverDownTimeout = setTimeout(function(){
              if(GM){
                messageToClient('public', util.makePacketForm(gameConfig.MTYPE_NOW_SERVER_IS_DOWN));
                GM.kickAllUser();
              }
            }, req.body.time);
          }
        }
        res.send({correctPW : true, correctInstruction : true});
      }else if(req.body.instruction === serverConfig.OPERATION_CANCEL_SERVER_DOWN){
        if(isServerDown){
          clearTimeout(serverDownTimeout);
          serverDownTimeout = false;
          isServerDown = false;
          messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CANCEL_SERVER_DOWN, req.body.msg));
        }
        res.send({correctPW : true, correctInstruction : true});
      }else{
        res.send({correctPW : true, correctInstruction : false});
      }
    }else{
      res.send({correctPW : false});
    }
  }else{
    res.sendStatus(400);
  }
});

redisClient = passport.setMiddleware(app);

app.use(function(error, req, res, next) {
    var date = new Date();
    console.log('app middleware error : ' + date);
    console.log(error.stack);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).send('Something broken!');
  });

app.set('views', './html');
app.set('view engine', 'ejs');
// DB.query('SELECT * FROM user', null, function(data, err) {
//   if (err) onDBError(req, res, err);
//   console.log(data);
// });
// DB.queryTransaction('UPDATE user SET id=13 WHERE id=?', [3], function(result) {
//   console.log(result);
// });

app.get('/', function(req, res){
  // if(!req.cookies.twitter){
  //   res.cookie('twitter', false, { maxAge: 7 * 24 * 60 * 60 * 1000 });
  // }
  // if(!req.cookies.facebook){
  //   res.cookie('facebook', false, { maxAge: 7 * 24 * 60 * 60 * 1000 });
  // }
  // fs.readFile('html/index.html', 'utf8', function(err, data){
  //   // res.writeHead(200, {'Content-Type': 'text/html'});
  //   // res.end(data);
  if (req.user) {
    if (!req.session.userID) { req.session.userID = req.user.id; }
  }
  console.log(req.cookies);
  var userData = passport.setUserData(req.user);
  res.render('index', { user: userData, isAuth: req.user ? (req.user.googleId ? true : null) : null });
  // });
});
app.get('/changelog', function(req, res){
  fs.readFile('html/changelog.html', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});
app.get('/error', function(req, res){
  fs.readFile('html/error.html', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});
app.get('/duplicate', function(req, res) {
  fs.readFile('html/duplicate.html', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});
app.get('/loginFail', function(req, res) {
  fs.readFile('html/loginFail.html', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});
app.get('/noaction', function(req, res){
  fs.readFile('html/noaction.html', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});
app.get('/adminpage', function(req, res){
  fs.readFile('html/operationTool.html', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});
app.get('/serverdown', function(req, res){
  fs.readFile('html/serverdown.html', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});
app.get('/ads.txt', function(req, res){
  fs.readFile('html/txt/ads.txt', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/text'});
    res.end(data);
  });
});
// app.post('/usersInfo', function(req, res){
//   if(!req.body){
//     res.sendStatus(400);
//   }else if(GM){
//     var cUser = Object.keys(GM.users).length;
//     var mUser = serverConfig.MAX_USER_COUNT;
//     res.send({ip : req.body.ip, startTime : req.body.startTime,
//              currentUser : cUser, maxUser : mUser, optionIndex : req.body.optionIndex, isServerDown : isServerDown});
//   }else{
//     res.sendStatus(400);
//   }
// });
// app.post('/serverCheck', function(req, res){
//   if(!req.body){
//     res.sendStatus(400);
//   }else if(GM){
//     if(Object.keys(GM.users).length < serverConfig.MAX_USER_COUNT &&
//        req.body.version === gameConfig.GAME_VERSION && !isServerDown){
//       res.send({canJoin : true});
//     }else{
//       res.send({canJoin : false, isServerDown : isServerDown, version : gameConfig.GAME_VERSION});
//     }
//   }else{
//     res.send({canJoin : false, isServerDown : isServerDown, version : gameConfig.GAME_VERSION});
//   }
// });
// app.post('/twitter', function(req, res){
//   res.cookie('twitter', true, { maxAge: 7 * 24 * 60 * 60 * 1000 });
//   res.end();
// });
// app.post('/facebook', function(req, res){
//   res.cookie('facebook', true, { maxAge: 7 * 24 * 60 * 60 * 1000 });
//   res.end();
// });
// app.post('/instruction', function(req, res){
//   if(req.body){
//     if(req.body.pw === serverConfig.OPERATION_TOOL_PASSWORD){
//       if(req.body.instruction === serverConfig.OPERATION_MSG_TO_USER){
//         if(wss){
//           // io.sockets.emit('adminMessage', req.body.msg)
//           messageToClient('public', util.makePacketForm(gameConfig.MTYPE_ADMIN_MESSAGE, req.body.msg));
//         }
//         res.send({correctPW : true, correctInstruction : true});
//       }else if(req.body.instruction === serverConfig.OPERATION_DOWN_SERVER){
//         if(wss){
//           var time = parseInt(req.body.time);
//           if(time && time > 0){
//             isServerDown = true;
//             messageToClient('public', util.makePacketForm(gameConfig.MTYPE_DOWN_SERVER, req.body.msg, req.body.time));
//             serverDownTimeout = setTimeout(function(){
//               if(GM){
//                 messageToClient('public', util.makePacketForm(gameConfig.MTYPE_NOW_SERVER_IS_DOWN));
//                 GM.kickAllUser();
//               }
//             }, req.body.time);
//           }
//         }
//         res.send({correctPW : true, correctInstruction : true});
//       }else if(req.body.instruction === serverConfig.OPERATION_CANCEL_SERVER_DOWN){
//         if(isServerDown){
//           clearTimeout(serverDownTimeout);
//           serverDownTimeout = false;
//           isServerDown = false;
//           messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CANCEL_SERVER_DOWN, req.body.msg));
//         }
//         res.send({correctPW : true, correctInstruction : true});
//       }else{
//         res.send({correctPW : true, correctInstruction : false});
//       }
//     }else{
//       res.send({correctPW : false});
//     }
//   }else{
//     res.sendStatus(400);
//   }
// });
passport.setRouter(app);

var server = http.createServer(app);
var port = process.env.PORT || config.port;

server.listen(port, function(){
  var time = new Date();
  console.log('Server is Running ', time);
});

var GameManager = require('./modules/server/GameManager.js');
var GM = new GameManager();

GM.start();

var User = require('./modules/server/User.js');
var wss = new WebSocket.Server({ server: server, perMessageDeflate: false });
// var wss = new WebSocket.Server({ server });
// var io = socketio(server, {
//   pingInterval : 2500,
//   pingTimeout : 6000,
//   transports : ['websocket']
// });
// var io = socketio.listen(server);

// GameManagr Events
if (true) {
  GM.onUserEnterPortal = function(userID, randomPos){
    // io.sockets.emit('moveUserToNewPos', userID, randomPos);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_MOVE_USER_TO_NEW_POS, userID, randomPos));
  };
  GM.onNeedInformUserTakeDamage = function(user, skillIndex){
    try {
      if(user){
        var userData = GM.processChangedUserStat(user);
        // userData.damagedAmount = dmg;
        // io.sockets.emit('userDamaged', userData, skillIndex);
        messageToClient('public', util.makePacketForm(gameConfig.MTYPE_USER_DAMAGED, userData, skillIndex));
      }
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformUserTakeDamage ' + time);
    }
  };
  GM.onNeedInformUserDeath = function(attackUserInfo, deadUserInfo, deadUserCalcInfo) { //, loseResource, newSkills){
    try {
      var scoreDatas = GM.processScoreDatas();
      // var levelDatas = GM.processUserAllTypeLevels(deadUserInfo.uID);
      // var charSkillDatas = GM.processUserAllTypeSkillLevels(deadUserInfo.uID);
      // io.sockets.emit('userDead', attackUserInfo, deadUserInfo, scoreDatas, levelDatas, loseResource, newSkills, charSkillDatas);
      messageToClient('public', util.makePacketForm(gameConfig.MTYPE_USER_DEAD, attackUserInfo, deadUserInfo, scoreDatas, deadUserCalcInfo));  //levelDatas, loseResource, newSkills, charSkillDatas));
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformUserDeath ' + time);
    }
  };
  GM.onNeedInformUserReduceMP = function(user){
    try {
      if(user){
        var userData = GM.processChangedUserStat(user);
        // io.sockets.emit('changeUserStat', userData);
        messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CHANGE_USER_STAT, userData));
      }
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformUserReduceMP ' + time);
    }
  };
  // GM.onNeedInformUserGetExp = function(user, addResource){
  //   try {
  //     if(user){
  //       var userData = GM.processChangedUserStat(user);
  //       // io.to(user.socketID).emit('changeUserStat', userData, addResource);
  //       messageToClient('private', util.makePacketForm(gameConfig.MTYPE_CHANGE_USER_STAT, userData, addResource), user.socketID);
  //     }
  //   } catch (e) {
  //     var time = new Date();
  //     console.log('onNeedInformUserGetExp ' + time);
  //   }
  // };
  GM.onNeedInformUserGetResource = function(user, addResource){
    try {
      if(user){
        // io.to(user.socketID).emit('getResource', resourceData, addResource);
        messageToClient('private', util.makePacketForm(gameConfig.MTYPE_GET_RESOURCE, addResource), user.socketID);
      }
    } catch (e) {
    }
  };
  GM.onNeedInformUserGetSkill = function(socketID, skillIndex, possessSkills){
    try {
      // io.to(socketID).emit('getSkill', skillIndex);
      messageToClient('private', util.makePacketForm(gameConfig.MTYPE_GET_SKILL, skillIndex, possessSkills), socketID);
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformUserGetSkill ' + time);
    }
  };
  GM.onNeedInformUserSkillChangeToResource = function(socketID, skillIndex){
    try {
      // io.to(socketID).emit('skillChangeToResource', skillIndex);
      messageToClient('private', util.makePacketForm(gameConfig.MTYPE_SKILL_CHANGE_TO_RESOURCE, skillIndex), socketID);
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformUserSkillChangeToResource ' + time);
    }
  };
  GM.onNeedInformScoreData = function(){
    try {
      var rankDatas = GM.processScoreDatas();
      // io.sockets.emit('updateRank', rankDatas);
      messageToClient('public', util.makePacketForm(gameConfig.MTYPE_UPDATE_RANK, rankDatas));
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformScoreData ' + time);
    }
  };
  // GM.onNeedInformUserLevelUp = function(user){
  //   try {
  //     if(user){
  //       var userData = GM.processChangedUserStat(user);
  //       // io.sockets.emit('changeUserStat', userData);
  //       messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CHANGE_USER_STAT, userData));
  //     }
  //   } catch (e) {
  //     var time = new Date();
  //     console.log('onNeedInformUserLevelUp ' + time);
  //   }
  // };
  GM.onNeedInformBuffUpdate = function(user){
    try {
      if(user){
        var buffData = GM.processBuffDataSetting(user);
        // io.sockets.emit('updateBuff', buffData);
        messageToClient('public', util.makePacketForm(gameConfig.MTYPE_UPDATE_BUFF, buffData));
      }
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformBuffUpdate ' + time);
    }
    // io.to(user.socketID).emit('updateBuff', buffData);
  };
  GM.onNeedInformSkillUpgrade = function(socketID, beforeSkillIndex, afterSkillIndex, resourceData){
    try {
      // io.to(socketID).emit('upgradeSkill', beforeSkillIndex, afterSkillIndex, resourceData);
      messageToClient('private', util.makePacketForm(gameConfig.MTYPE_UPGRADE_SKILL, beforeSkillIndex, afterSkillIndex, resourceData), socketID);
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformSkillUpgrade ' + time);
    }
  };
  GM.onNeedInformUserChangePrivateStat = function(user){
    try {
      if(user){
        var statData = GM.processUserPrivateDataSetting(user);
        // io.to(user.socketID).emit('updateUserPrivateStat', statData);
        messageToClient('private', util.makePacketForm(gameConfig.MTYPE_UPDATE_USER_PRIVATE_STAT, statData), user.socketID);
      }
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformUserChangePrivateStat ' + time);
    }
  };
  GM.onNeedInformUserChangeStat = function(user){
    try {
      if(user){
        var userData = GM.processChangedUserStat(user);
        // console.log(user.conditions);
        // io.sockets.emit('changeUserStat', userData);
        messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CHANGE_USER_STAT, userData));
      }
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformUserChangeStat ' + time);
    }
  };
  GM.onNeedInformCreateChest = function(chest){
    var chestData = GM.processChestDataSetting(chest);
    // io.sockets.emit('createChest', chestData);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CREATE_CHEST, chestData));
  };
  GM.onNeedInformChestDamaged = function(locationID, HP){
    // io.sockets.emit('chestDamaged', locationID, HP);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CHEST_DAMAGED, locationID, HP));
  };
  GM.onNeedInformDeleteChest = function(locationID){
    // io.sockets.emit('deleteChest', locationID);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_DELETE_CHEST, locationID));
  };
  GM.onNeedInformCreateObjs = function(objs){
    try {
      var objDatas = [];
      for(var i=0; i<objs.length; i++){
        objDatas.push(GM.processOBJDataSetting(objs[i]));
      }
      // io.sockets.emit('createOBJs', objDatas);
      messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CREATE_OBJS, objDatas));
    } catch (e) {
      var time = new Date();
      console.log('onNeedInformCreateObjs ' + time);
    }
  };
  GM.onNeedInformDeleteObj = function(objID){
    // io.sockets.emit('deleteOBJ', objID);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_DELETE_OBJS, objID));
  };
  GM.onNeedInformProjectileDelete = function(projectileData){
    // io.sockets.emit('deleteProjectile', projectileData.objectID, projectileData.id);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_DELETE_PROJECTILE, projectileData.objectID, projectileData.id));
  };
  GM.onNeedInformProjectileExplode = function(projectileData){
    // io.sockets.emit('explodeProjectile', projectileData.objectID, projectileData.id, {x : projectileData.x, y : projectileData.y});
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_EXPLODE_PROJECTILE, projectileData.objectID, projectileData.id, {x : projectileData.x, y : projectileData.y}));
  };
  GM.onNeedInformMobsCreate = function(mobs){
    var mobDatas = GM.processCreatedMobDatas(mobs);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_MOB_CREATED, mobDatas));
  };
  GM.onNeedInfromMobChangeState = function(mob){
    var mobData = GM.processMobData(mob);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_MOB_CHANGE_STATE, mobData));
  };
  GM.onNeedInformMobTakeDamage = function(mob, skillIndex){
    // var mobData = GM.processMobData(mob);
    var mobData = GM.processMobStatData(mob);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_MOB_TAKE_DAMAGE, mobData, skillIndex));
  };
  GM.onNeedInformMobBuffExchange = function(mob){
    var buffData = GM.processMobBuffData(mob);
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_MOB_UPDATE_BUFF, buffData));
  };
  GM.onNeedInformMobDeath = function(mobID){
    messageToClient('public', util.makePacketForm(gameConfig.MTYPE_MOB_DEAD, mobID));
  };
}

// Websocket Events
wss.on('connection', function(client, req){
  try {
    if (req) {
      console.log(req.headers);
      console.log(req.headers.cookie);
      var cookies = cookie.parse(req.headers.cookie);
      var redisSid = cookieParser.signedCookie(cookies["connect.sid"], '!!@@Secret Cat@@!!');
      redisClient.get('sess:' + redisSid, function(err, result) {
        // console.log(result);
        if (err) { throw err; }
        if (result) {
          client.dbId = JSON.parse(result)['userID'];
        }
        if (client.dbId) {
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_SYNC_SUCCESS), client);
          // check duplicate access
          wss.clients.forEach(function(cli) {
            if (cli.dbId === client.dbId && cli !== client) {
              // duplicate
              messageToClient('private', util.makePacketForm(gameConfig.MTYPE_DUPLICATE_ACCESS), cli);
            }
          });
        } else {
          console.log('Can`t find cookies 1');
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_ERROR_SET_ID), client);
          // client.terminate();
        }
      });
    }
  } catch (e) {
    console.log('Can`t find cookies 2');
    console.log(e);
    // go to error
    messageToClient('private', util.makePacketForm(gameConfig.MTYPE_ERROR_SET_ID), client);
    return;
  }

  var user;
  // var uid = null;
  var warnCount = 0;
  var isReconnecting = false;
  client.isAlive = true;
  client.on('pong', heartbeat);

  client.on('message', function(msg){
    try {
      client.isAlive = true;
      var data = util.decodePacket(msg);
      var vars = data.v;
      switch (data.t) {
        case gameConfig.MTYPE_REQ_START_GAME: //'reqStartGame':
          reqStartGame(vars[0], vars[1]);
          break;
        case gameConfig.MTYPE_REQ_RESTART_GAME: //'reqRestartGame':
          reqRestartGame(vars[0], vars[1], vars[2]);
          break;
        case gameConfig.MTYPE_REQ_RECONNECT: //'reqReconnect':
          reqReconnect(vars[0], vars[1], vars[2], vars[3], vars[4], vars[5], vars[6]) //, vars[6], vars[7]);
          break;
        case gameConfig.MTYPE_RECONNECT_SUCCESS: //'reconnectSuccess':
          isReconnecting = false;
          var time = new Date();
          console.log('reconnectSuccess ', time);
          break;
        case gameConfig.MTYPE_NEED_RECONNECT: //'needReconnect':
          needReconnect();
          break;
        case gameConfig.MTYPE_USER_DATA_UPDATE: //'userDataUpdate':
          userDataUpdate(vars[0], vars[1], vars[2]);
          break;
        case gameConfig.MTYPE_USER_MOVE_START: //'userMoveStart':
          userMoveStart(vars[0]);
          break;
        case gameConfig.MTYPE_USER_MOVE_AND_ATTACK: //'userMoveAndAttack':
          userMoveAndAttack(vars[0]);
          break;
        case gameConfig.MTYPE_USER_USE_SKILL: //'userUseSkill':
          userUseSkill(vars[0]);
          break;
        case gameConfig.MTYPE_USER_STOP: //'userStop':
          userStop(vars[0]);
          break;
        case gameConfig.MTYPE_SKILL_FIRED: //'skillFired':
          skillFired(vars[0]);
          break;
        case gameConfig.MTYPE_PROJECTILE_FIRED: //'projectilesFired':
          projectilesFired(vars[0], vars[1]);
          break;
        case gameConfig.MTYPE_UPGRADE_SKILL: //'upgradeSkill':
          upgradeSkill(vars[0]);
          break;
        case gameConfig.MTYPE_EXCHANGE_PASSIVE: //'exchangePassive':
          exchangePassive(vars[0], vars[1]);
          break;
        case gameConfig.MTYPE_EQUIP_PASSIVE: //'equipPassive':
          equipPassive(vars[0]);
          break;
        case gameConfig.MTYPE_UNEQUIP_PASSIVE: //'unequipPassive':
          unequipPassive(vars[0]);
          break;
        case gameConfig.MTYPE_FIRE_PING: //'firePing':
          firePing(vars[0]);
          break;
        case gameConfig.MTYPE_CHATTING: //'chatting':
          chatting(vars[0]);
          break;
        case gameConfig.MTYPE_UPDATE_USER_TIME_DIFF: //'updateUserTimeDiff':
          updateUserTimeDiff(vars[0], vars[1]);
          break;
        case gameConfig.MTYPE_UPDATE_EQUIP_SKILLS: //'updateEquipSkills':
          updateEquipSkills(vars[0], vars[1]);
          break;
        // case 'completeTwitter':
        //   completeTwitter();
        //   break;
        // case 'completeFacebook':
        //   completeFacebook();
        //   break;
        case gameConfig.MTYPE_KILL_ME: //'killme':
          killme();
          break;
        case gameConfig.MTYPE_GIVE_EXP: //'giveExp':
          // giveExp();
          break;
        case gameConfig.MTYPE_GIVE_RESOURCES: //'giveResources':
          giveResources();
          break;
        case gameConfig.MTYPE_GIVE_ALL_SKILL: //'giveAllSkill':
          giveAllSkill();
          break;
      }
    } catch (e) {
      var time = new Date();
      console.log('error at onmessage ' + data + " " + time + " " + e);
      try {
        if(user){
          var rankDatas = GM.processScoreDatas(user.objectID);
          messageToClient('public', util.makePacketForm(gameConfig.MTYPE_USER_LEAVE, user.objectID, rankDatas));
          if (user.buffUpdateInterval) {
            user.calcGame();
            DBQuery.updateUserData(client.dbId, user);
          }
          GM.stopUser(user);
          GM.kickUser(user);
        }
      } catch (e) {
        console.log('In on message ' + e.message);
      } finally {
        user = null;
        client.close();
      }
    }
  });
  client.on('error', function(err){
    try {
      client.close();
      if(err.errno){
        return;
      }else{
        if(err.message !== 'RSV1 must be clear'){
          console.log(err.message);
        }
      }
    } catch (e) {
      console.log('In on error' + e.message);
    }
  });
  client.on('close', function(){
    try {
      if(user){
        var rankDatas = GM.processScoreDatas(user.objectID);
        messageToClient('public', util.makePacketForm(gameConfig.MTYPE_USER_LEAVE, user.objectID, rankDatas));
        if (user.buffUpdateInterval) {
          user.calcGame();
        }
        DBQuery.updateUserData(client.dbId, user);
        GM.stopUser(user);
        GM.kickUser(user);
      }
    } catch (e) {
      var time = new Date();
      console.log('At onclose ' + e.message + " " + time);
    } finally {
      user = null;
      // client.terminate();
    }
  });

  // socket.on('reqStartGame', function(userType, userName, twitter, facebook){
  function reqStartGame(userType, userName){
    // try {
    if (userType === gameConfig.CHAR_TYPE_FIRE || userType === gameConfig.CHAR_TYPE_FROST || userType === gameConfig.CHAR_TYPE_ARCANE) {
      if (client.dbId) {
        DBQuery.findUserData(client.dbId, (err, result) => {
          if (err) { throw 'Can`t find user Data (reqStartGame)'; }
          if (result) {
            var level = 1;
            var exp = 0;
            var gold = 0;
            var jewel = 0;
            var equipSkills = [];
            var possessSkills = [];
            if (result.wasPlayed) {
              switch (userType) {
                case gameConfig.CHAR_TYPE_FIRE:
                  level = parseInt(result.levels.split(',')[0]);
                  exp = parseInt(result.exps.split(',')[0]);
                  var tEquipSkills = result.pyroEquipSkills ? result.pyroEquipSkills.split(',') : [];
                  break;
                case gameConfig.CHAR_TYPE_FROST:
                  level = parseInt(result.levels.split(',')[1]);
                  exp = parseInt(result.exps.split(',')[1]);
                  tEquipSkills = result.frosterEquipSkills ? result.frosterEquipSkills.split(',') : [];
                  break;
                case gameConfig.CHAR_TYPE_ARCANE:
                  level = parseInt(result.levels.split(',')[2]);
                  exp = parseInt(result.exps.split(',')[2]);
                  tEquipSkills = result.mysterEquipSkills ? result.mysterEquipSkills.split(',') : [];
                  break;
              }
              var pEquipSkills = result.pyroEquipSkills ? result.pyroEquipSkills.split(',') : [];
              var fEquipSkills = result.frosterEquipSkills ? result.frosterEquipSkills.split(',') : [];
              var mEquipSkills = result.mysterEquipSkills ? result.mysterEquipSkills.split(',') : [];

              var aEquipSkills = new Array(3);
              aEquipSkills[0] = new Array(4);
              aEquipSkills[1] = new Array(4);
              aEquipSkills[2] = new Array(4);

              for (var i=0; i<pEquipSkills.length; i++) {
                if (parseInt(pEquipSkills[i])) {
                  aEquipSkills[0][i] = parseInt(pEquipSkills[i]);
                }
              }
              for (var i=0; i<fEquipSkills.length; i++) {
                if (parseInt(fEquipSkills[i])) {
                  aEquipSkills[1][i] = parseInt(fEquipSkills[i]);
                }
              }
              for (var i=0; i<mEquipSkills.length; i++) {
                if (parseInt(mEquipSkills[i])) {
                  aEquipSkills[2][i] = parseInt(mEquipSkills[i]);
                }
              }

              var tPossessSkills = result.skills.split(',');

              for (var i=0; i<tEquipSkills.length; i++) {
                if (parseInt(tEquipSkills[i])) {
                  equipSkills.push(parseInt(tEquipSkills[i]));
                }
              }
              for (var i=0; i<tPossessSkills.length; i++) {
                if (parseInt(tPossessSkills[i])) {
                  possessSkills.push(parseInt(tPossessSkills[i]));
                }
              }
              gold = result.gold;
              jewel = result.jewel;
            }
            var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', userType, 'level', level));
            var userBase = objectAssign({}, util.findData(userBaseTable, 'type', userType));
            user = new User(client, userName, userStat, userBase, exp);
            user.onNeedDBUpdate = function() {
              DBQuery.updateUserData(client.dbId, user);
            }
            user.setStartResource(gold, jewel);
            user.setCharSkills();
            if (result.wasPlayed) {
              // GM.setUserSkill(user.objectID, charType, equipSkills[0], equipSkills[1]);
              GM.initializeUser(user, possessSkills);
              GM.setUserStat(user.objectID, userStat, userBase);
            } else {
              var baseSkill = userBase.baseSkill;
              for(var i=0; i<3; i++){
                if(userBase['baseEquipSkill' + (i + 1)]){
                  equipSkills.push(userBase['baseEquipSkill' + (i + 1)]);
                }
              }
              for(i=0; i<4; i++){
                if(userBase['basePossessionSkill' + (i + 1)]){
                  possessSkills.push(userBase['basePossessionSkill' + (i + 1)]);
                }
              }
              inherentPassiveSkill = userBase.basePassiveSkill;
              GM.initializeUser(user, possessSkills);
            }
            // GM.setResource(user.objectID, result.gold, result.jewel);

            GM.joinUser(user);
            GM.setUserPosition(user.objectID);

            GM.setScore(user.objectID);
            var userData = GM.processUserDataSetting(user);
            var rankDatas = GM.processScoreDatas();
            //send users user joined game
            // socket.broadcast.emit('userJoined', userData, rankDatas);
            messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_JOINED, userData, rankDatas), client);

            var userDatas = GM.processUserDataSettings();
            var buffDatas = GM.processBuffDataSettings();
            // console.log(userDatas);
            // var skillDatas = GM.processSkillsDataSettings();
            // var projectileDatas = GM.processProjectilesDataSettings();
            var objDatas = GM.processOBJDataSettings();
            var chestDatas = GM.processChestDataSettings();
            var mobDatas = GM.processMobDatas();

            GM.addSkillData(userData);
            userData.push(equipSkills);
            userData.push(aEquipSkills);
            GM.addPrivateData(userData);
            // GM.addResourceData(userData);
            //user initial equip skill setting;
            userData.push(result.gold, result.jewel);
            // userData.g = result.gold;
            // userData.j = result.jewel;

            // userData.eS = equipSkills;
            user.updateEquipSkills(userType, equipSkills);

            // socket.emit('syncAndSetSkills', userData);
            messageToClient('private', util.makePacketForm(gameConfig.MTYPE_SYNC_AND_SET_SKILLS, userData), client);
            // socket.emit('resStartGame', userDatas, buffDatas, objDatas, chestDatas, rankDatas);
            messageToClient('private', util.makePacketForm(gameConfig.MTYPE_RES_START_GAME, userDatas, buffDatas, objDatas, chestDatas, rankDatas, mobDatas), client);
            var passiveList = [];
            for(var i=0; i<equipSkills.length; i++){
              var skillData = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
              if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
                passiveList.push(skillData.buffToSelf);
              }
            }
            GM.equipPassives(user.objectID, passiveList);
            GM.setStartBuff(user);
          }
        });
      } else {
        console.log('Waiting sync id')
        process.nextTick(() => { reqStartGame(userType, userName); });
      }
    } else {
      throw "charType error";
    }
  }
  // socket.on('reqRestartGame', function(userName, charType, equipSkills){
  function reqRestartGame(userName, charType, equipSkills){
    // try {
      if (user.objectID && charType === gameConfig.CHAR_TYPE_FIRE || charType === gameConfig.CHAR_TYPE_FROST || charType === gameConfig.CHAR_TYPE_ARCANE) {
        if (client.dbId) {
          DBQuery.findUserData(client.dbId, (err, result) => {
            if (err) { throw 'Can`t find user Data (reqRestartGame)'; }
            if (result) {
              var level = 1;
              var exp = 0;
              switch (charType) {
                case gameConfig.CHAR_TYPE_FIRE:
                  level = parseInt(result.levels.split(',')[0]);
                  exp = parseInt(result.exps.split(',')[0]);
                  break;
                case gameConfig.CHAR_TYPE_FROST:
                  level = parseInt(result.levels.split(',')[1]);
                  exp = parseInt(result.exps.split(',')[1]);
                  break;
                case gameConfig.CHAR_TYPE_ARCANE:
                  level = parseInt(result.levels.split(',')[2]);
                  exp = parseInt(result.exps.split(',')[2]);
                  break;
              }
              var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', charType, 'level', level));
              var userBase = objectAssign({}, util.findData(userBaseTable, 'type', charType));
              GM.setUserStat(user.objectID, userStat, userBase, exp);
              // user.auraList = [serverConfig.ENV_IMMORTAL_BUFF_INDEX];
              user.setCharSkills();
              // GM.setUserSkill(user.objectID, charType, userBase.baseSkill, userBase.basePassiveSkill);
              GM.setUserPosition(user.objectID);
              GM.disableCheatCheck(user.objectID);
              GM.startUserUpdate(user.objectID);
              GM.setScore(user.objectID);
              GM.setUserName(user.objectID, userName);

              var userData = GM.processUserDataSetting(user);
              var rankDatas = GM.processScoreDatas();

              messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_JOINED, userData, rankDatas), client);
              GM.addSkillData(userData);
              GM.addPrivateData(userData);
              messageToClient('private', util.makePacketForm(gameConfig.MTYPE_RES_RESTART_GAME, userData, rankDatas), client);

              var passiveList = [];
              for(var i=0; i<equipSkills.length; i++){
                var skillData = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
                if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
                  passiveList.push(skillData.buffToSelf);
                }
              }
              GM.equipPassives(user.objectID, passiveList);
              GM.setStartBuff(user);
            }
          });
        }
        // var level = GM.getLevel(user.objectID, charType);
        //
        // var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', charType, 'level', level));
        // var userBase = objectAssign({}, util.findData(userBaseTable, 'type', charType));
        // GM.setUserStat(user.objectID, userStat, userBase);
        // GM.setUserSkill(user.objectID, charType, userBase.baseSkill, userBase.basePassiveSkill);
        // GM.setUserPosition(user.objectID);
        // GM.disableCheatCheck(user.objectID);
        // GM.startUserUpdate(user.objectID);
        // GM.setScore(user.objectID);
        // GM.setUserName(user.objectID, userName);
        // var baseSkill = GM.getBaseSkill(user.objectID, charType);
        // var inherentPassiveSkill = GM.getInherentPassiveSkill(user.objectID, charType);
        //
        // var userData = GM.processUserDataSetting(user);
        // var rankDatas = GM.processScoreDatas();
        //
        // // socket.broadcast.emit('userJoined', userData, rankDatas);
        // messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_JOINED, userData, rankDatas), client);
        //
        // GM.addSkillData(userData);
        // GM.addPrivateData(userData);
        // // socket.emit('resRestartGame', userData, rankDatas);
        // messageToClient('private', util.makePacketForm(gameConfig.MTYPE_RES_RESTART_GAME, userData, rankDatas), client);
        //
        // var passiveList = [];
        // for(var i=0; i<equipSkills.length; i++){
        //   var skillData = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
        //   if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
        //     passiveList.push(skillData.buffToSelf);
        //   }
        // }
        // GM.equipPassives(user.objectID, passiveList);
        // GM.setStartBuff(user);
      }
      //  else {
      //   if(!isReconnecting){
      //     isReconnecting = true;
      //     messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
      //   }
      //   // throw "charType error";
      // }
  }
  // socket.on('reqReconnect', function(userName, charType, stat, skills, killCount, totalKillCount, position, resources){
  function reqReconnect(userName, charType, stat, equipSkills, killCount, totalKillCount, position) { //skills, killCount, totalKillCount, position, resources){
    var time = new Date();
    console.log('reqReconnect Start ', time);
    // try {
    if (client.dbId) {
      DBQuery.findUserData(client.dbId, (err, result) => {
        if (err) { throw 'Can`t find user Data (reqReconnect)'; }
        if (!user && result) {
          if(charType === gameConfig.CHAR_TYPE_FIRE || charType === gameConfig.CHAR_TYPE_FROST || charType === gameConfig.CHAR_TYPE_ARCANE){
            var level = 1;
            var exp = 0;
            switch (charType) {
              case gameConfig.CHAR_TYPE_FIRE:
              level = parseInt(result.levels.split(',')[0]);
              exp = parseInt(result.exps.split(',')[0]);
              // var tEquipSkills = result.pyroEquipSkills ? result.pyroEquipSkills.split(',') : [];
              break;
              case gameConfig.CHAR_TYPE_FROST:
              level = parseInt(result.levels.split(',')[1]);
              exp = parseInt(result.exps.split(',')[1]);
              // tEquipSkills = result.frosterEquipSkills ? result.frosterEquipSkills.split(',') : [];
              break;
              case gameConfig.CHAR_TYPE_ARCANE:
              level = parseInt(result.levels.split(',')[2]);
              exp = parseInt(result.exps.split(',')[2]);
              // tEquipSkills = result.mysterEquipSkills ? result.mysterEquipSkills.split(',') : [];
              break;
            }
            var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', charType, 'level', level));
            var userBase = objectAssign({}, util.findData(userBaseTable, 'type', charType));
            user = new User(client, userName, userStat, userBase, exp);
            user.onNeedDBUpdate = function() {
              DBQuery.updateUserData(client.dbId, user);
            }
            user.setStartResource(result.gold, result.jewel);
            var tPossessSkills = result.skills.split(',');
            var possessSkills = [];
            for (var i=0; i<tPossessSkills.length; i++) {
              possessSkills.push(parseInt(tPossessSkills[i]));
            }

            user.setCharSkills();
            GM.initReconnectUser(user, user.baseSkill, user.inherentPassiveSkill, possessSkills);
            GM.joinUser(user);
            GM.setReconnectUserPosition(user.objectID, position);
            GM.setReconnectUserScore(user.objectID, killCount, totalKillCount);
            // GM.setResource(user.objectID, result.gold, result.jewel);
            GM.disableCheatCheck(user.objectID);
            GM.setReconnectUserHPMP(user.objectID, stat.HP, stat.MP);

            var userData = GM.processUserDataSetting(user);
            var rankDatas = GM.processScoreDatas();

            // socket.broadcast.emit('userJoined', userData, rankDatas);
            messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_JOINED, userData, rankDatas), client);

            var userDatas = GM.processUserDataSettings();
            var buffDatas = GM.processBuffDataSettings();

            var objDatas = GM.processOBJDataSettings();
            var chestDatas = GM.processChestDataSettings();
            var mobDatas = GM.processMobDatas();

            // GM.addPrivateData(userData);
            var passiveList = [];
            for(var i=0; i<equipSkills.length; i++){
              var skillData = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
              if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
                passiveList.push(skillData.buffToSelf);
              }
            }
            GM.equipPassives(user.objectID, passiveList);
            // socket.emit('resReconnect', userData, userDatas, buffDatas, objDatas, chestDatas, rankDatas);
            messageToClient('private', util.makePacketForm(gameConfig.MTYPE_RES_RECONNECT, userData, userDatas, buffDatas, objDatas, chestDatas, rankDatas, mobDatas), client);
          }
        }
      });
    } else {
      messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
    }
      // if(!user){
      //   if(charType === gameConfig.CHAR_TYPE_FIRE || charType === gameConfig.CHAR_TYPE_FROST || charType === gameConfig.CHAR_TYPE_ARCANE){
      //     var level = 1;
      //     var exp = 0;
      //     if(util.isNumeric(stat.level)){
      //       level = parseInt(stat.level);
      //     }
      //     if(util.isNumeric(stat.exp)){
      //       exp = parseInt(stat.exp);
      //     }
      //     var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', charType, 'level', level));
      //     var userBase = objectAssign({}, util.findData(userBaseTable, 'type', charType));
      //     user = new User(client, userName, userStat, userBase, 0);
      //
      //     GM.initReconnectUser(user, level, exp, skills.baseSkill, skills.inherentPassiveSkill, skills.possessSkills);
      //     GM.joinUser(user);
      //
      //     GM.setReconnectUserPosition(user.objectID, position);
      //     GM.setReconnectUserScore(user.objectID, killCount, totalKillCount);
      //     GM.disableCheatCheck(user.objectID);
      //     GM.setReconnectResource(user.objectID, resources.gold, resources.jewel);
      //     GM.setReconnectUserHPMP(user.objectID, stat.HP, stat.MP);
      //     var userData = GM.processUserDataSetting(user);
      //     var rankDatas = GM.processScoreDatas();
      //
      //     // socket.broadcast.emit('userJoined', userData, rankDatas);
      //     messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_JOINED, userData, rankDatas), client);
      //
      //     var userDatas = GM.processUserDataSettings();
      //     var buffDatas = GM.processBuffDataSettings();
      //
      //     var objDatas = GM.processOBJDataSettings();
      //     var chestDatas = GM.processChestDataSettings();
      //     var mobDatas = GM.processMobDatas();
      //
      //     // GM.addPrivateData(userData);
      //     var passiveList = [];
      //     for(var i=0; i<skills.equipSkills.length; i++){
      //       var skillData = objectAssign({}, util.findData(skillTable, 'index', skills.equipSkills[i]));
      //       if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
      //         passiveList.push(skillData.buffToSelf);
      //       }
      //     }
      //     GM.equipPassives(user.objectID, passiveList);
      //     // socket.emit('resReconnect', userData, userDatas, buffDatas, objDatas, chestDatas, rankDatas);
      //     messageToClient('private', util.makePacketForm(gameConfig.MTYPE_RES_RECONNECT, userData, userDatas, buffDatas, objDatas, chestDatas, rankDatas, mobDatas), client);
      //   }
      // }
  }
  // socket.on('reconnectSuccess', function(){
  //   console.log('reconnectSuccess');
  // });
  // socket.on('needReconnect', function(){
  function needReconnect(){
    messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
  }
  // var timeDelay = Date.now();
  // socket.on('userDataUpdate', function(userData, needInform, fps){
  function userDataUpdate(userData, needInform, fps){
    // console.log(userData.time - timeDelay);
    // timeDelay = userData.time;
    // try {
      if(fps && fps > 20){
        var rand = Math.floor(Math.random() * serverConfig.CHEAT_CHECK_RATE);
        if(rand === 1){
          var beforePosition = GM.checkCheat(userData);
          if(beforePosition){
            warnCount++;
            console.log(userData.objectID + ' is cheating!!! : ' + warnCount);
            // socket.emit('dontCheat', beforePosition);
            messageToClient('private', util.makePacketForm(gameConfig.MTYPE_DONT_CHEAT, beforePosition), client);
          }
        }
      }
      GM.updateUserData(userData);

      if(needInform){
        if(user){
          userData = GM.processUserDataSetting(user);
          // socket.broadcast.emit('userDataSync', userData);
          messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_DATA_SYNC, userData), client);
        }else{
          if(!isReconnecting){
            isReconnecting = true;
            messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
          }
          // throw "user isn`t instantiated";
        }
      }
  }
  // socket.on('userMoveStart', function(userData){
  function userMoveStart(userData){
    // try {
      GM.updateUserData(userData);

      if(user){
        userData = GM.processUserDataSetting(user);
        // socket.broadcast.emit('userDataUpdate', userData);
        messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_DATA_UPDATE, userData), client);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
        }
        // throw "user isn`t instantiated";
      }
  }
  // socket.on('userMoveAndAttack', function(userAndSkillData){
  function userMoveAndAttack(userAndSkillData){
    // try {
      GM.updateUserData(userAndSkillData);
      if(user){
        var userData = GM.processUserDataSetting(user);
        userData.push(
          userAndSkillData.skillIndex,
          userAndSkillData.skillTargetPosition,
          userAndSkillData.moveBackward
        )
        // userData.sID = userAndSkillData.skillIndex;
        // userData.sTPos = userAndSkillData.skillTargetPosition;
        // userData.mB = userAndSkillData.moveBackward;

        // socket.broadcast.emit('userMoveAndAttack', userData);
        messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_MOVE_AND_ATTACK, userData), client);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
        }
        // throw "user isn`t instantiated";
      }
  }
  // socket.on('userUseSkill', function(userAndSkillData){
  function userUseSkill(userAndSkillData){
    // try {
      if(GM.checkSkillPossession(userAndSkillData.objectID, userAndSkillData.skillIndex)){
        GM.updateUserData(userAndSkillData);
        // if(userAndSkillData.cancelBlur){
        //   GM.cancelBlur(user.objectID);
        // }
        if(user){
          var userData = GM.processUserDataSetting(user);
          userData.push(userAndSkillData.skillIndex,
            userAndSkillData.skillDirection,
            userAndSkillData.skillTargetPosition);
          // userData.sID = userAndSkillData.skillIndex;
          // userData.sDir = userAndSkillData.skillDirection;
          // userData.sTPos = userAndSkillData.skillTargetPosition;
          if(userAndSkillData.projectileIDs){
            userData.push(userAndSkillData.projectileIDs);
            // userData.sPIDs = userAndSkillData.projectileIDs;
          }
          // socket.broadcast.emit('userDataUpdateAndUseSkill', userData);
          messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_DATA_UPDATE_AND_USER_SKILL, userData), client);
        }else{
          if(!isReconnecting){
            isReconnecting = true;
            messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
          }
          // throw "user isn`t instantiated";
        }
      }
  }
  // socket.on('userStop', function(data){
  function userStop(data){
    // try {
      GM.updateUserData(data);
      if(user){
        var userData = GM.processUserDataSetting(user);
        // socket.broadcast.emit('userDataUpdate', userData);
        messageToClient('broadcast', util.makePacketForm(gameConfig.MTYPE_USER_DATA_UPDATE, userData), client);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
        }
        // throw "user isn`t instantiated";
      }
  }
  // socket.on('skillFired', function(data){
  function skillFired(data){
    // try {
      if(GM.checkSkillPossession(user.objectID, data.sID)){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', data.sID));
        if(GM.checkSkillCondition(user.objectID, skillData) && GM.checkSkillCooldown(user.objectID, skillData)){
          skillData.targetPosition = data.sTPos;

          var serverSyncFireTime = data.sT + GM.getUserTimeDiff(user.objectID);
          data.sT = serverSyncFireTime;
          // skillData.buffsToSelf = util.findAndSetBuffs(skillData, buffTable, 'buffToSelf', 3, user.objectID);
          // skillData.buffsToTarget = util.findAndSetBuffs(skillData, buffTable, 'buffToTarget', 3, user.objectID);
          var timeoutTime = serverSyncFireTime - Date.now();
          if(timeoutTime < serverConfig.MINIMUM_LATENCY){
            timeoutTime = serverConfig.MINIMUM_LATENCY;
          }
          if(skillData.effectLastTime && util.isNumeric(skillData.effectLastTime)){
            timeoutTime += skillData.effectLastTime / 2;
          }
          // if(skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
          //   // check teleport to immortal safeZone
          //   if (data.sTPos.x > gameConfig.CANVAS_MAX_SIZE.width - 400 && data.sTPos.y > gameConfig.CANVAS_MAX_SIZE.height) {
          //
          //   }
          //   GM.userUseTeleport(user.objectID);
          // }
          setTimeout(function(){
            try {
              GM.applySkill(user.objectID, skillData);
            } catch (er) {
              console.log('skillFired1');
              console.log(Date.now());
              console.log(er.message);
            }
          }, timeoutTime);
          // io.sockets.emit('skillFired', data, user.objectID);
          if(skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
            // check teleport to immortal safeZone
            if (data.sTPos.x > gameConfig.CANVAS_MAX_SIZE.width - 420 && data.sTPos.y > gameConfig.CANVAS_MAX_SIZE.height - 420) {
              var beforePosition = GM.getLastPosition(user);
              if (beforePosition) {
                messageToClient('private', util.makePacketForm(gameConfig.MTYPE_DONT_CHEAT, beforePosition), client);
              }
            } else {
              messageToClient('public', util.makePacketForm(gameConfig.MTYPE_SKILL_FIRED, data, user.objectID));
            }
            GM.userUseTeleport(user.objectID);
          } else {
            messageToClient('public', util.makePacketForm(gameConfig.MTYPE_SKILL_FIRED, data, user.objectID));
          }
        }
      }
  }
  // socket.on('projectilesFired', function(datas, syncFireTime){
  function projectilesFired(datas, syncFireTime){
    // try {
      if(GM.checkSkillPossession(user.objectID, datas[0].sID)){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', datas[0].sID));
        if(GM.checkSkillCondition(user.objectID, skillData) && GM.checkSkillCooldown(user.objectID, skillData)){
          var serverSyncFireTime = syncFireTime + GM.getUserTimeDiff(user.objectID);
          var timeoutTime = serverSyncFireTime - Date.now();
          if(timeoutTime < serverConfig.MINIMUM_LATENCY){
            timeoutTime = serverConfig.MINIMUM_LATENCY;
          }
          setTimeout(function(){
            try {
              var projectiles = [];
              for(var i=0; i<datas.length; i++){
                var projectileData = objectAssign({}, util.findData(skillTable, 'index', datas[i].sID));

                projectileData.objectID = datas[i].oID;
                projectileData.position = datas[i].pos;
                projectileData.speed = datas[i].sp;
                projectileData.startTime = Date.now();

                projectiles.push(projectileData);
              }
              GM.applyProjectile(user.objectID, projectiles);
            } catch (er) {
              console.log('projectilesFired1');
              console.log(Date.now());
              console.log(er.message);
            }
          }, timeoutTime);
          // io.sockets.emit('projectilesFired', datas, serverSyncFireTime, user.objectID);
          messageToClient('public', util.makePacketForm(gameConfig.MTYPE_PROJECTILE_FIRED, datas, serverSyncFireTime, user.objectID));
        }
      }
  }
  // socket.on('castCanceled', function(userData){
  //   GM.updateUserData(userData);
  //
  //   socket.broadcast.emit('castCanceled', userData.objectID);
  // });
  // socket.on('upgradeSkill', function(skillIndex){
  function upgradeSkill(skillIndex){
    // try {
      if(user){
        GM.upgradeSkill(user, skillIndex);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
        }
        // throw "user isn`t instantiated";
      }
  }
  // socket.on('exchangePassive', function(beforeBuffGID, afterBuffGID){
  function exchangePassive(beforeBuffGID, afterBuffGID){
    // try {
      if(user){
        GM.exchangePassive(user, beforeBuffGID, afterBuffGID);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
        }
        // throw "user isn`t instantiated";
      }
  }
  // socket.on('equipPassive', function(buffGroupIndex){
  function equipPassive(buffGroupIndex){
    // try {
      if(user){
        GM.equipPassive(user, buffGroupIndex);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
        }
        // throw "user isn`t instantiated";
      }
  }
  // socket.on('unequipPassive', function(buffGroupIndex){
  function unequipPassive(buffGroupIndex){
    // try {
      if(user){
        GM.unequipPassive(user, buffGroupIndex);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          messageToClient('private', util.makePacketForm(gameConfig.MTYPE_REQ_RECONNECT_RES), client);
        }
        // throw "user isn`t instantiated";
      }
  }
  // socket.on('killme', function(){
  function killme(){
    GM.killme(user.objectID);
  }
  // socket.on('giveExp', function(){
  // function giveExp(){
  //   GM.giveExp(user.objectID);
  // }
  // socket.on('giveResources', function(){
  function giveResources(){
    GM.giveResources(user.objectID);
  }
  // socket.on('giveAllSkill', function(){
  function giveAllSkill(){
    var baseSkills = [];
    var passiveSkills = [];
    var allSkills = [];
    var allSkillGroup = [];
    for(var i=0; i<userBaseTable.length; i++){
      if(userBaseTable[i]){
        baseSkills.push(userBaseTable[i].baseSkill);
        passiveSkills.push(userBaseTable[i].basePassiveSkill);
      }
    }
    for(var i=0; i<skillTable.length; i++){
      if(skillTable[i]){
        if(!allSkillGroup.includes(skillTable[i].groupIndex)){
          allSkillGroup.push(skillTable[i].groupIndex);
          allSkills.push(skillTable[i].index);
        }
      }
    }
    for(var i=0; i<baseSkills.length; i++){
      var index = allSkills.indexOf(baseSkills[i]);
      allSkills.splice(index, 1);
    }
    for(var i=0; i<passiveSkills.length; i++){
      index = allSkills.indexOf(passiveSkills[i]);
      allSkills.splice(index, 1);
    }
    // console.log(allSkills);
    GM.giveAllSkill(user.objectID, allSkills);
  }
  // socket.on('firePing', function(date){
  function firePing(date){
    messageToClient('private', util.makePacketForm(gameConfig.MTYPE_FIRE_PONG, date, Date.now()), client);
  }
  // socket.on('chatting', function(msg){
  function chatting(msg){
    // try {
      var msg = util.processMessage(msg, gameConfig.CHAT_MESSAGE_LENGTH);
      // io.sockets.emit('chatting', user.objectID, msg);
      messageToClient('public', util.makePacketForm(gameConfig.MTYPE_CHATTING, user.objectID, msg));
  }
  // socket.on('updateUserTimeDiff', function(clientDate, userLatency){
  function updateUserTimeDiff(clientDate, userLatency){
    if (user) {
      var timeDiff = Date.now() - (clientDate + userLatency/2);
      // try {
      GM.updateUserTimeDiff(user.objectID, timeDiff);
      GM.updateUserLatency(user.objectID, userLatency);
    }
  }
  function updateEquipSkills(userType, equipSkills) {
    if (user) {
      user.updateEquipSkills(userType, equipSkills);
    }
  }
  // // socket.on('completeTwitter', function(){
  // function completeTwitter(){
  //   // try {
  //     GM.giveTwitterGold(user.objectID, 5000);
  // }
  // // socket.on('completeFacebook', function(){
  // function completeFacebook(){
  //   // try {
  //     GM.giveFacebookJewel(user.objectID, 5);
  // }
});

// messageToClient('public', util.makePacketForm());
// messageToClient('broadcast', util.makePacketForm(), client);
// messageToClient('private', util.makePacketForm(), client);

function messageToClient(msgType, msg, thisClient){
  try {
    if(msgType === 'public'){
      wss.clients.forEach(function(client){
        if (client.readyState === WebSocket.OPEN && client.dbId) {
          client.send(msg, function(err){
            if(err){
              // var time = new Date();
              // console.log('error at ' + msgType + " " + time + " " + err);
            }
          });
        }
      });
    }else if(msgType === 'broadcast'){
      wss.clients.forEach(function(client){
        if (client !== thisClient && client.readyState === WebSocket.OPEN) {
          client.send(msg, function(err){
            if(err){
              // var time = new Date();
              // console.log('error at ' + msgType + " " + time + " " + err);
            }
          });
        }
      });
    }else if(msgType === 'private'){
      if(thisClient.readyState === WebSocket.OPEN){
        thisClient.send(msg, function(err){
          if(err){
            // var time = new Date();
            // console.log('error at ' + msgType + " " + time + " " + err);
          }
        });
      }
    }else{
      console.log('msgType error', msgType);
    }
  } catch (e) {
    var time = new Date();
    console.log('At messageToClient ' + msgType + " " + time);
  }
}
function heartbeat(){
  this.isAlive = true;
};
var pingpongInterval = setInterval(function(){
  try {
    wss.clients.forEach(function(client){
      if(client.isAlive === false){
        console.log('ping timeout');
        console.log(new Date());
        return client.terminate();
      }
      client.isAlive = false;
      if(client.readyState === WebSocket.OPEN){
        client.ping();
      }
    });
  } catch (e) {
    console.log('pingpongInterval Error');
  }
}, 30000);
function onDBError(req, res, err) {
  if (res) {
    res.status(500).send('Something broken!');
  }
}
