var http = require('http');
var express = require('express');
// var socketio = require('socket.io');
var WebSocket = require('ws');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var path = require('path');
var fs = require('fs');

var csvJson = require('./modules/public/csvjson.js');
var objectAssign = require('./modules/public/objectAssign');

var app = express();

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

app.get('/', function(req, res){
  if(!req.cookies.twitter){
    res.cookie('twitter', false, { maxAge: 7 * 24 * 60 * 60 * 1000 });
  }
  if(!req.cookies.facebook){
    res.cookie('facebook', false, { maxAge: 7 * 24 * 60 * 60 * 1000 });
  }
  // res.cookie('twitter', req.cookies.twitter ? '' : 'checked'); // set cookie
  // console.log('Cookies: ', req.cookies)
  fs.readFile('html/index.html', 'utf8', function(err, data){
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
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
app.post('/twitter', function(req, res){
  res.cookie('twitter', true, { maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.end();
});
app.post('/facebook', function(req, res){
  res.cookie('facebook', true, { maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.end();
});
app.post('/instruction', function(req, res){
  if(req.body){
    if(req.body.pw === serverConfig.OPERATION_TOOL_PASSWORD){
      if(req.body.instruction === serverConfig.OPERATION_MSG_TO_USER){
        if(io){
          // io.sockets.emit('adminMessage', req.body.msg)
          messageToClient('public', util.makePacketForm('adminMessage', req.body.msg));
        }
        res.send({correctPW : true, correctInstruction : true});
      }else if(req.body.instruction === serverConfig.OPERATION_DOWN_SERVER){
        if(io){
          var time = parseInt(req.body.time);
          if(time && time > 0){
            isServerDown = true;
            // io.sockets.emit('downServer', req.body.msg, req.body.time);
            messageToClient('public', util.makePacketForm('downServer', req.body.msg, req.body.time));
            serverDownTimeout = setTimeout(function(){
              if(GM){
                // io.sockets.emit('nowServerIsDown');
                messageToClient('public', util.makePacketForm('nowServerIsDown'));
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
          // io.sockets.emit('cancelServerDown', req.body.msg);
          messageToClient('public', util.makePacketForm('cancelServerDown', req.body.msg));
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
var wss = new WebSocket.Server({ server });
// var io = socketio(server, {
//   pingInterval : 2500,
//   pingTimeout : 6000,
//   transports : ['websocket']
// });
// var io = socketio.listen(server);

GM.onUserEnterPortal = function(userID, randomPos){
  // io.sockets.emit('moveUserToNewPos', userID, randomPos);
  messageToClient('public', util.makePacketForm('moveUserToNewPos', userID, randomPos));
};
GM.onNeedInformUserTakeDamage = function(user, dmg, skillIndex){
  try {
    if(user){
      var userData = GM.processChangedUserStat(user);
      userData.damagedAmount = dmg;
      // io.sockets.emit('userDamaged', userData, skillIndex);
      messageToClient('public', util.makePacketForm('userDamaged', userData, skillIndex));
    }
  } catch (e) {
    var time = new Date();
    console.log('onNeedInformUserTakeDamage ' + time);
  }
};
GM.onNeedInformUserDeath = function(attackUserInfo, deadUserInfo, loseResource, newSkills){
  try {
    var scoreDatas = GM.processScoreDatas();
    var levelDatas = GM.processUserAllTypeLevels(deadUserInfo.userID);
    var charSkillDatas = GM.processUserAllTypeSkillLevels(deadUserInfo.userID);
    // io.sockets.emit('userDead', attackUserInfo, deadUserInfo, scoreDatas, levelDatas, loseResource, newSkills, charSkillDatas);
    messageToClient('public', util.makePacketForm('userDead', attackUserInfo, deadUserInfo, scoreDatas, levelDatas, loseResource, newSkills, charSkillDatas));
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
      messageToClient('public', util.makePacketForm('changeUserStat', userData));
    }
  } catch (e) {
    var time = new Date();
    console.log('onNeedInformUserReduceMP ' + time);
  }
};
GM.onNeedInformUserGetExp = function(user, addResource){
  try {
    if(user){
      var userData = GM.processChangedUserStat(user);
      // io.to(user.socketID).emit('changeUserStat', userData, addResource);
      messageToClient('private', util.makePacketForm('changeUserStat', userData, addResource), user.socketID);
    }
  } catch (e) {
    var time = new Date();
    console.log('onNeedInformUserGetExp ' + time);
  }
};
GM.onNeedInformUserGetResource = function(user, addResource){
  try {
    if(user){
      var resourceData = GM.processUserResource(user);
      // io.to(user.socketID).emit('getResource', resourceData, addResource);
      messageToClient('private', util.makePacketForm('getResource', resourceData, addResource), user.socketID);
    }
  } catch (e) {
  }
};
GM.onNeedInformUserGetSkill = function(socketID, skillIndex){
  try {
    // io.to(socketID).emit('getSkill', skillIndex);
    messageToClient('private', util.makePacketForm('getSkill', skillIndex), socketID);
  } catch (e) {
    var time = new Date();
    console.log('onNeedInformUserGetSkill ' + time);
  }
};
GM.onNeedInformUserSkillChangeToResource = function(socketID, skillIndex){
  try {
    // io.to(socketID).emit('skillChangeToResource', skillIndex);
    messageToClient('private', util.makePacketForm('skillChangeToResource', skillIndex), socketID);
  } catch (e) {
    var time = new Date();
    console.log('onNeedInformUserSkillChangeToResource ' + time);
  }
};
GM.onNeedInformScoreData = function(){
  try {
    var rankDatas = GM.processScoreDatas();
    // io.sockets.emit('updateRank', rankDatas);
    messageToClient('public', util.makePacketForm('updateRank', rankDatas));
  } catch (e) {
    var time = new Date();
    console.log('onNeedInformScoreData ' + time);
  }
};
GM.onNeedInformUserLevelUp = function(user){
  try {
    if(user){
      var userData = GM.processChangedUserStat(user);
      // io.sockets.emit('changeUserStat', userData);
      messageToClient('public', util.makePacketForm('changeUserStat', userData));
    }
  } catch (e) {
    var time = new Date();
    console.log('onNeedInformUserLevelUp ' + time);
  }
};
GM.onNeedInformBuffUpdate = function(user){
  try {
    if(user){
      var buffData = GM.processBuffDataSetting(user);
      // io.sockets.emit('updateBuff', buffData);
      messageToClient('public', util.makePacketForm('updateBuff', buffData));
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
    messageToClient('private', util.makePacketForm('upgradeSkill', beforeSkillIndex, afterSkillIndex, resourceData), socketID);
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
      messageToClient('private', util.makePacketForm('updateUserPrivateStat', statData), user.socketID);
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
      messageToClient('public', util.makePacketForm('changeUserStat', userData));
    }
  } catch (e) {
    var time = new Date();
    console.log('onNeedInformUserChangeStat ' + time);
  }
};
GM.onNeedInformCreateChest = function(chest){
  var chestData = GM.processChestDataSetting(chest);
  // io.sockets.emit('createChest', chestData);
  messageToClient('public', util.makePacketForm('createChest', chestData));
};
GM.onNeedInformChestDamaged = function(locationID, HP){
  // io.sockets.emit('chestDamaged', locationID, HP);
  messageToClient('public', util.makePacketForm('chestDamaged', locationID, HP));
};
GM.onNeedInformDeleteChest = function(locationID){
  // io.sockets.emit('deleteChest', locationID);
  messageToClient('public', util.makePacketForm('deleteChest', locationID));
};
GM.onNeedInformCreateObjs = function(objs){
  try {
    var objDatas = [];
    for(var i=0; i<objs.length; i++){
      objDatas.push(GM.processOBJDataSetting(objs[i]));
    }
    // io.sockets.emit('createOBJs', objDatas);
    messageToClient('public', util.makePacketForm('createOBJs', objDatas));
  } catch (e) {
    console.log('onNeedInformCreateObjs ' + time);
  }
};
GM.onNeedInformDeleteObj = function(objID){
  // io.sockets.emit('deleteOBJ', objID);
  messageToClient('public', util.makePacketForm('deleteOBJ', objID));
};
GM.onNeedInformSkillData = function(socketID, possessSkills){
  try {
    // io.to(socketID).emit('updateSkillPossessions', possessSkills);
    messageToClient('private', util.makePacketForm('updateSkillPossessions', possessSkills), socketID);
  } catch (e) {
    console.log('onNeedInformSkillData ' + time);
  }
};
GM.onNeedInformProjectileDelete = function(projectileData){
  // io.sockets.emit('deleteProjectile', projectileData.objectID, projectileData.id);
  messageToClient('public', util.makePacketForm('deleteProjectile', projectileData.objectID, projectileData.id));
};
GM.onNeedInformProjectileExplode = function(projectileData){
  // io.sockets.emit('explodeProjectile', projectileData.objectID, projectileData.id, {x : projectileData.x, y : projectileData.y});
  messageToClient('public', util.makePacketForm('explodeProjectile', projectileData.objectID, projectileData.id, {x : projectileData.x, y : projectileData.y}));
};

wss.on('connection', function(client, req){
  var user;
  var warnCount = 0;
  var isReconnecting = false;
  client.isAlive = true;
  client.on('pong', heartbeat);

  client.on('message', function(msg){
    try {
      var data = JSON.parse(msg);
      var vars = data.vars;
      switch (data.type) {
        case 'reqStartGame':
          reqStartGame(vars[0], vars[1], vars[2], vars[3]);
          break;
        case 'reqRestartGame':
          reqRestartGame(vars[0], vars[1], vars[2]);
          break;
        case 'reqReconnect':
          reqReconnect(vars[0], vars[1], vars[2], vars[3], vars[4], vars[5], vars[6], vars[7]);
          break;
        case 'reconnectSuccess':
          isReconnecting = false;
          var time = new Date();
          console.log('reconnectSuccess ', time);
          break;
        case 'needReconnect':
          needReconnect();
          break;
        case 'userDataUpdate':
          userDataUpdate(vars[0], vars[1], vars[2]);
          break;
        case 'userMoveStart':
          userMoveStart(vars[0]);
          break;
        case 'userMoveAndAttack':
          userMoveAndAttack(vars[0]);
          break;
        case 'userUseSkill':
          userUseSkill(vars[0]);
          break;
        case 'userStop':
          userStop(vars[0]);
          break;
        case 'skillFired':
          skillFired(vars[0]);
          break;
        case 'projectilesFired':
          projectilesFired(vars[0], vars[1]);
          break;
        case 'upgradeSkill':
          upgradeSkill(vars[0]);
          break;
        case 'exchangePassive':
          exchangePassive(vars[0], vars[1]);
          break;
        case 'equipPassive':
          equipPassive(vars[0]);
          break;
        case 'unequipPassive':
          unequipPassive(vars[0]);
          break;
        case 'firePing':
          firePing(vars[0]);
          break;
        case 'chatting':
          chatting(vars[0]);
          break;
        case 'updateUserTimeDiff':
          updateUserTimeDiff(vars[0], vars[1]);
          break;
        case 'completeTwitter':
          completeTwitter();
          break;
        case 'completeFacebook':
          completeFacebook();
          break;
        case 'killme':
          killme();
          break;
        case 'giveExp':
          giveExp();
          break;
        case 'giveResources':
          giveResources();
          break;
        case 'giveAllSkill':
          giveAllSkill();
          break;
      }
    } catch (e) {
      var time = new Date();
      console.log('error at onmessage ' + data.type + " " + time + " " + e);
      try {
        if(user){
          var rankDatas = GM.processScoreDatas(user.objectID);
          messageToClient('public', util.makePacketForm('userLeave', user.objectID, rankDatas));
          GM.stopUser(user);
          GM.kickUser(user);
        }
      } catch (e) {
        console.log('In try catch ' + e.message);
      } finally {
        client.close();
      }
    }
  });
  client.on('error', function(err){
    if(err.errno){
      return;
    }else{
      if(err.message !== 'RSV1 must be clear'){
        console.log(err);
      }
    }
  });
  client.on('close', function(){
    try {
      if(user){
        var rankDatas = GM.processScoreDatas(user.objectID);
        messageToClient('public', util.makePacketForm('userLeave', user.objectID, rankDatas));
        GM.stopUser(user);
        GM.kickUser(user);
      }
    } catch (e) {
      var time = new Date();
      console.log('At onclose ' + e.message + " " + time);
    } finally {
      client.close();
    }
  });

  // socket.on('reqStartGame', function(userType, userName, twitter, facebook){
  function reqStartGame(userType, userName, twitter, facebook){
    // try {
      if(userType === gameConfig.CHAR_TYPE_FIRE || userType === gameConfig.CHAR_TYPE_FROST || userType === gameConfig.CHAR_TYPE_ARCANE){
        var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', userType, 'level', 1));
        var userBase = objectAssign({}, util.findData(userBaseTable, 'type', userType));
        user = new User(client, userName, userStat, userBase, 0);

        var baseSkill = userBase.baseSkill;
        var equipSkills = [];
        for(var i=0; i<3; i++){
          if(userBase['baseEquipSkill' + (i + 1)]){
            equipSkills.push(userBase['baseEquipSkill' + (i + 1)]);
          }
        }
        var possessSkills = [];
        for(i=0; i<4; i++){
          if(userBase['basePossessionSkill' + (i + 1)]){
            possessSkills.push(userBase['basePossessionSkill' + (i + 1)]);
          }
        }
        var inherentPassiveSkill = userBase.basePassiveSkill;

        // user init and join game
        GM.initializeUser(user, baseSkill, possessSkills, inherentPassiveSkill);
        GM.joinUser(user);
        GM.setUserPosition(user.objectID);

        GM.setScore(user.objectID);
        var userData = GM.processUserDataSetting(user);
        var rankDatas = GM.processScoreDatas();
        //send users user joined game
        // socket.broadcast.emit('userJoined', userData, rankDatas);
        messageToClient('broadcast', util.makePacketForm('userJoined', userData, rankDatas), client);

        var userDatas = GM.processUserDataSettings();
        var buffDatas = GM.processBuffDataSettings();
        // console.log(userDatas);
        // var skillDatas = GM.processSkillsDataSettings();
        // var projectileDatas = GM.processProjectilesDataSettings();
        var objDatas = GM.processOBJDataSettings();
        var chestDatas = GM.processChestDataSettings();

        GM.addSkillData(userData);
        GM.addPrivateData(userData);
        //user initial equip skill setting;
        userData.equipSkills = equipSkills;

        // socket.emit('syncAndSetSkills', userData);
        messageToClient('private', util.makePacketForm('syncAndSetSkills', userData), client);
        // socket.emit('resStartGame', userDatas, buffDatas, objDatas, chestDatas, rankDatas);
        messageToClient('private', util.makePacketForm('resStartGame', userDatas, buffDatas, objDatas, chestDatas, rankDatas), client);
        GM.setStartBuff(user);
        if(twitter){
          GM.giveTwitterGold(user.objectID, 5000);
        }
        if(facebook){
          GM.giveFacebookJewel(user.objectID, 5);
        }
      }else{
        throw "charType error";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('reqStartGame1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('reqStartGame2');
    //     console.log(Date.now());
    //     console.log(e.message);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('reqRestartGame', function(userName, charType, equipSkills){
  function reqRestartGame(userName, charType, equipSkills){
    // try {
      if(user.objectID && charType === gameConfig.CHAR_TYPE_FIRE || charType === gameConfig.CHAR_TYPE_FROST || charType === gameConfig.CHAR_TYPE_ARCANE){
        var level = GM.getLevel(user.objectID, charType);

        var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', charType, 'level', level));
        var userBase = objectAssign({}, util.findData(userBaseTable, 'type', charType));
        GM.setUserStat(user.objectID, userStat, userBase);
        GM.setUserSkill(user.objectID, charType, userBase.baseSkill, userBase.basePassiveSkill);
        GM.setUserPosition(user.objectID);
        GM.disableCheatCheck(user.objectID);
        GM.startUserUpdate(user.objectID);
        GM.setScore(user.objectID);
        GM.setUserName(user.objectID, userName);
        var baseSkill = GM.getBaseSkill(user.objectID, charType);
        var inherentPassiveSkill = GM.getInherentPassiveSkill(user.objectID, charType);

        var userData = GM.processUserDataSetting(user);
        var rankDatas = GM.processScoreDatas();

        // socket.broadcast.emit('userJoined', userData, rankDatas);
        messageToClient('broadcast', util.makePacketForm('userJoined', userData, rankDatas), client);

        GM.addSkillData(userData);
        GM.addPrivateData(userData);
        // socket.emit('resRestartGame', userData, rankDatas);
        messageToClient('private', util.makePacketForm('resRestartGame', userData, rankDatas), client);

        var passiveList = [];
        for(var i=0; i<equipSkills.length; i++){
          var skillData = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
          if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            passiveList.push(skillData.buffToSelf);
          }
        }
        GM.equipPassives(user.objectID, passiveList);
        GM.setStartBuff(user);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          // socket.emit('reqReconnectResource');
          messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
        }
        // throw "charType error";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('reqRestartGame1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('reqRestartGame2');
    //     console.log(Date.now());
    //     console.log(e.message);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('reqReconnect', function(userName, charType, stat, skills, killCount, totalKillCount, position, resources){
  function reqReconnect(userName, charType, stat, skills, killCount, totalKillCount, position, resources){
    var time = new Date();
    console.log('reqReconnect Start ' + time);
    // try {
      if(!user){
        if(charType === gameConfig.CHAR_TYPE_FIRE || charType === gameConfig.CHAR_TYPE_FROST || charType === gameConfig.CHAR_TYPE_ARCANE){
          var level = 1;
          var exp = 0;
          if(util.isNumeric(stat.level)){
            level = parseInt(stat.level);
          }
          if(util.isNumeric(stat.exp)){
            exp = parseInt(stat.exp);
          }
          var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', charType, 'level', level));
          var userBase = objectAssign({}, util.findData(userBaseTable, 'type', charType));
          user = new User(client, userName, userStat, userBase, 0);

          GM.initReconnectUser(user, level, exp, skills.baseSkill, skills.inherentPassiveSkill, skills.possessSkills);
          GM.joinUser(user);

          GM.setReconnectUserPosition(user.objectID, position);
          GM.setReconnectUserScore(user.objectID, killCount, totalKillCount);
          GM.disableCheatCheck(user.objectID);
          GM.setReconnectResource(user.objectID, resources.gold, resources.jewel);
          GM.setReconnectUserHPMP(user.objectID, stat.HP, stat.MP);
          var userData = GM.processUserDataSetting(user);
          var rankDatas = GM.processScoreDatas();

          // socket.broadcast.emit('userJoined', userData, rankDatas);
          messageToClient('broadcast', util.makePacketForm('userJoined', userData, rankDatas), client);

          var userDatas = GM.processUserDataSettings();
          var buffDatas = GM.processBuffDataSettings();

          var objDatas = GM.processOBJDataSettings();
          var chestDatas = GM.processChestDataSettings();

          GM.addPrivateData(userData);
          var passiveList = [];
          for(var i=0; i<skills.equipSkills.length; i++){
            var skillData = objectAssign({}, util.findData(skillTable, 'index', skills.equipSkills[i]));
            if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
              passiveList.push(skillData.buffToSelf);
            }
          }
          GM.equipPassives(user.objectID, passiveList);
          // socket.emit('resReconnect', userData, userDatas, buffDatas, objDatas, chestDatas, rankDatas);
          messageToClient('private', util.makePacketForm('resReconnect', userData, userDatas, buffDatas, objDatas, chestDatas, rankDatas), client);
        }
      }
    // } catch (e) {
    //   console.log('reqReconnect');
    //   console.log(Date.now());
    //   console.log(e.message);
    //   socket.disconnect();
    // }
  }
  // socket.on('reconnectSuccess', function(){
  //   console.log('reconnectSuccess');
  // });
  // socket.on('needReconnect', function(){
  function needReconnect(){
    // socket.emit('reqReconnectResource');
    messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
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
            messageToClient('private', util.makePacketForm('dontCheat', beforePosition), client);
          }
        }
      }
      GM.updateUserData(userData);

      if(needInform){
        if(user){
          userData = GM.processUserDataSetting(user);
          // socket.broadcast.emit('userDataSync', userData);
          messageToClient('broadcast', util.makePacketForm('userDataSync', userData), client);
        }else{
          if(!isReconnecting){
            isReconnecting = true;
            // socket.emit('reqReconnectResource');
            messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
          }
          // throw "user isn`t instantiated";
        }
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('userDataUpdate1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('userDataUpdate2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('userMoveStart', function(userData){
  function userMoveStart(userData){
    // try {
      GM.updateUserData(userData);

      if(user){
        userData = GM.processUserDataSetting(user);
        // socket.broadcast.emit('userDataUpdate', userData);
        messageToClient('broadcast', util.makePacketForm('userDataUpdate', userData), client);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          // socket.emit('reqReconnectResource');
          messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
        }
        // throw "user isn`t instantiated";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('userMoveStart1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('userMoveStart2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('userMoveAndAttack', function(userAndSkillData){
  function userMoveAndAttack(userAndSkillData){
    // try {
      GM.updateUserData(userAndSkillData);
      if(user){
        var userData = GM.processUserDataSetting(user);
        userData.skillIndex = userAndSkillData.skillIndex;
        userData.skillTargetPosition = userAndSkillData.skillTargetPosition;
        userData.moveBackward = userAndSkillData.moveBackward;

        // socket.broadcast.emit('userMoveAndAttack', userData);
        messageToClient('broadcast', util.makePacketForm('userMoveAndAttack', userData), client);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          // socket.emit('reqReconnectResource');
          messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
        }
        // throw "user isn`t instantiated";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('userMoveAndAttack1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('userMoveAndAttack2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
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
          userData.skillIndex = userAndSkillData.skillIndex;
          userData.skillDirection = userAndSkillData.skillDirection;
          userData.skillTargetPosition = userAndSkillData.skillTargetPosition;
          if(userAndSkillData.projectileIDs){
            userData.skillProjectileIDs = userAndSkillData.projectileIDs;
          }
          // socket.broadcast.emit('userDataUpdateAndUseSkill', userData);
          messageToClient('broadcast', util.makePacketForm('userDataUpdateAndUseSkill', userData), client);
        }else{
          if(!isReconnecting){
            isReconnecting = true;
            // socket.emit('reqReconnectResource');
            messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
          }
          // throw "user isn`t instantiated";
        }
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('userUseSkill1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('userUseSkill2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('userStop', function(data){
  function userStop(data){
    // try {
      GM.updateUserData(data);
      if(user){
        var userData = GM.processUserDataSetting(user);
        // socket.broadcast.emit('userDataUpdate', userData);
        messageToClient('broadcast', util.makePacketForm('userDataUpdate', userData), client);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          // socket.emit('reqReconnectResource');
          messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
        }
        // throw "user isn`t instantiated";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('userStop1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('userStop2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('skillFired', function(data){
  function skillFired(data){
    // try {
      if(GM.checkSkillPossession(user.objectID, data.skillIndex)){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', data.skillIndex));
        if(GM.checkSkillCondition(user.objectID, skillData)){
          skillData.targetPosition = data.skillTargetPosition;

          var serverSyncFireTime = data.syncFireTime + GM.getUserTimeDiff(user.objectID);
          data.syncFireTime = serverSyncFireTime;
          // skillData.buffsToSelf = util.findAndSetBuffs(skillData, buffTable, 'buffToSelf', 3, user.objectID);
          // skillData.buffsToTarget = util.findAndSetBuffs(skillData, buffTable, 'buffToTarget', 3, user.objectID);
          var timeoutTime = serverSyncFireTime - Date.now();
          if(timeoutTime < serverConfig.MINIMUM_LATENCY){
            timeoutTime = serverConfig.MINIMUM_LATENCY;
          }
          if(skillData.effectLastTime && util.isNumeric(skillData.effectLastTime)){
            timeoutTime += skillData.effectLastTime / 2;
          }
          if(skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
            GM.userUseTeleport(user.objectID);
          }
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
          messageToClient('public', util.makePacketForm('skillFired', data, user.objectID));
        }
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (er) {
    //       console.log(er.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('skillFired2');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('skillFired3');
    //     console.log(Date.now());
    //     console.log(e.message);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('projectilesFired', function(datas, syncFireTime){
  function projectilesFired(datas, syncFireTime){
    // try {
      if(GM.checkSkillPossession(user.objectID, datas[0].skillIndex)){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', datas[0].skillIndex));
        if(GM.checkSkillCondition(user.objectID, skillData)){
          var serverSyncFireTime = syncFireTime + GM.getUserTimeDiff(user.objectID);
          var timeoutTime = serverSyncFireTime - Date.now();
          if(timeoutTime < serverConfig.MINIMUM_LATENCY){
            timeoutTime = serverConfig.MINIMUM_LATENCY;
          }
          setTimeout(function(){
            try {
              var projectiles = [];
              for(var i=0; i<datas.length; i++){
                var projectileData = objectAssign({}, util.findData(skillTable, 'index', datas[i].skillIndex));

                projectileData.objectID = datas[i].objectID;
                projectileData.position = datas[i].position;
                projectileData.speed = datas[i].speed;
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
          messageToClient('public', util.makePacketForm('projectilesFired', datas, serverSyncFireTime, user.objectID));
        }
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (er) {
    //       console.log(er.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('projectilesFired2');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('projectilesFired3');
    //     console.log(Date.now());
    //     console.log(e.message);
    //     socket.disconnect();
    //   }
    // }
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
          messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
          // socket.emit('reqReconnectResource');
        }
        // throw "user isn`t instantiated";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('upgradeSkill1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('upgradeSkill2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('exchangePassive', function(beforeBuffGID, afterBuffGID){
  function exchangePassive(beforeBuffGID, afterBuffGID){
    // try {
      if(user){
        GM.exchangePassive(user, beforeBuffGID, afterBuffGID);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          // socket.emit('reqReconnectResource');
          messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
        }
        // throw "user isn`t instantiated";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('exchangePassive1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('exchangePassive2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('equipPassive', function(buffGroupIndex){
  function equipPassive(buffGroupIndex){
    // try {
      if(user){
        GM.equipPassive(user, buffGroupIndex);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          // socket.emit('reqReconnectResource');
          messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
        }
        // throw "user isn`t instantiated";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('equipPassive1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('equipPassive2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('unequipPassive', function(buffGroupIndex){
  function unequipPassive(buffGroupIndex){
    // try {
      if(user){
        GM.unequipPassive(user, buffGroupIndex);
      }else{
        if(!isReconnecting){
          isReconnecting = true;
          // socket.emit('reqReconnectResource');
          messageToClient('private', util.makePacketForm('reqReconnectResource'), client);
        }
        // throw "user isn`t instantiated";
      }
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('unequipPassive1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('unequipPassive2');
    //     console.log(Date.now());
    //     console.log(e);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('killme', function(){
  function killme(){
    GM.killme(user.objectID);
  }
  // socket.on('giveExp', function(){
  function giveExp(){
    GM.giveExp(user.objectID);
  }
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
    // socket.emit('firePong', date, Date.now());
    messageToClient('private', util.makePacketForm('firePong', date, Date.now()), client);
  }
  // socket.on('chatting', function(msg){
  function chatting(msg){
    // try {
      var msg = util.processMessage(msg, gameConfig.CHAT_MESSAGE_LENGTH);
      // io.sockets.emit('chatting', user.objectID, msg);
      messageToClient('public', util.makePacketForm('chatting', user.objectID, msg));
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('chatting');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }
    // }
  }
  // socket.on('updateUserTimeDiff', function(clientDate, userLatency){
  function updateUserTimeDiff(clientDate, userLatency){
    var timeDiff = Date.now() - (clientDate + userLatency/2);
    // try {
      GM.updateUserTimeDiff(user.objectID, timeDiff);
      GM.updateUserLatency(user.objectID, userLatency);
    // }catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('updateUserTimeDiff');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }
    // }
  }
  // socket.on('completeTwitter', function(){
  function completeTwitter(){
    // try {
      GM.giveTwitterGold(user.objectID, 5000);
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('completeTwitter1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('completeTwitter2');
    //     console.log(Date.now());
    //     console.log(e.message);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('completeFacebook', function(){
  function completeFacebook(){
    // try {
      GM.giveFacebookJewel(user.objectID, 5);
    // } catch (e) {
    //   if(user){
    //     try {
    //       var rankDatas = GM.processScoreDatas(user.objectID);
    //       io.sockets.emit('userLeave', user.objectID, rankDatas);
    //     } catch (e) {
    //       console.log(e.message);
    //     } finally {
    //       GM.stopUser(user);
    //       GM.kickUser(user);
    //       console.log('completeFacebook1');
    //       console.log(Date.now());
    //       console.log(e.message);
    //       socket.disconnect();
    //     }
    //   }else{
    //     console.log('completeFacebook2');
    //     console.log(Date.now());
    //     console.log(e.message);
    //     socket.disconnect();
    //   }
    // }
  }
  // socket.on('disconnect', function(reason){
  //   try {
  //     var rankDatas = GM.processScoreDatas(user.objectID);
  //     io.sockets.emit('userLeave', user.objectID, rankDatas);
  //     GM.stopUser(user);
  //     GM.kickUser(user);
  //   } catch (e) {
  //     console.log('disconnect');
  //     console.log(reason);
  //     console.log(Date.now());
  //     console.log(e.message);
  //   } finally {
  //     socket.disconnect();
  //     user = null;
  //   }
  // });
});
// messageToClient('public', util.makePacketForm());
// messageToClient('broadcast', util.makePacketForm(), client);
// messageToClient('private', util.makePacketForm(), client);

function messageToClient(msgType, msg, thisClient){
  try {
    if(msgType === 'public'){
      wss.clients.forEach(function(client){
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg, function(err){
            if(err && err !== 'Error: write EPIPE'){
              var time = new Date();
              console.log('error at ' + msgType + " " + time + " " + err);
            }
          });
        }
      });
    }else if(msgType === 'broadcast'){
      wss.clients.forEach(function(client){
        if (client !== thisClient && client.readyState === WebSocket.OPEN) {
          client.send(msg, function(err){
            if(err && err !== 'Error: write EPIPE'){
              var time = new Date();
              console.log('error at ' + msgType + " " + time + " " + err);
            }
          });
        }
      });
    }else if(msgType === 'private'){
      if(thisClient.readyState === WebSocket.OPEN){
        thisClient.send(msg, function(err){
          if(err && err !== 'Error: write EPIPE'){
            var time = new Date();
            console.log('error at ' + msgType + " " + time + " " + err);
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
// function makePacketForm(type){
//   var vars = [];
//   for(var i=1; i<arguments.length; i++){
//     vars.push(arguments[i]);
//   }
//   return JSON.stringify({
//     type: type,
//     vars: vars
//   });
// }
