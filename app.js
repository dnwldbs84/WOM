var http = require('http');
var express = require('express');
var socketio = require('socket.io');
var bodyParser = require('body-parser')
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

var allowCORS = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Max-Age', 10);
  (req.method === 'OPTIONS') ?
    res.send(200) :
    next();
};

app.use(allowCORS);

app.use(bodyParser.urlencoded({ extended: false }))
// app.use(function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", "*");
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//     next();
// });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  fs.readFile('/index.html', 'utf8', function(err, data){
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
})
app.post('/usersInfo', function(req, res){
  // console.log(req.body);
  if(!req.body){
    res.sendStatus(400);
  }else if(GM){
    var cUser = Object.keys(GM.users).length;
    var mUser = serverConfig.MAX_USER_COUNT;
    res.send({ip : req.body.ip, startTime : req.body.startTime,
             currentUser : cUser, maxUser : mUser, optionIndex : req.body.optionIndex});
  }else{
    res.sendStatus(400);
  }
});
app.post('/serverCheck', function(req, res){
  if(GM){
    if(Object.keys(GM.users).length < serverConfig.MAX_USER_COUNT){
      res.send({canJoin : true});
    }else{
      res.send({canJoin : false});
    }
  }else{
    res.send({canJoin : false});
  }
})

var server = http.createServer(app);
var port = process.env.PORT || config.port;

server.listen(port, function(){
  console.log('Server is Running');
});

var GameManager = require('./modules/server/GameManager.js');
var GM = new GameManager();

GM.start();

var User = require('./modules/server/User.js');
var io = socketio.listen(server);

GM.onNeedInformUserTakeDamage = function(user, dmg, skillIndex){
  try {
    if(user){
      var userData = GM.processChangedUserStat(user);
      userData.damagedAmount = dmg;
      io.sockets.emit('userDamaged', userData, skillIndex);
    }
  } catch (e) {
  }
};
GM.onNeedInformUserDeath = function(attackUserInfo, deadUserInfo, loseResource, newSkills){
  try {
    var scoreDatas = GM.processScoreDatas();
    var levelDatas = GM.processUserAllTypeLevels(deadUserInfo.userID);
    io.sockets.emit('userDead', attackUserInfo, deadUserInfo, scoreDatas, levelDatas, loseResource, newSkills);
  } catch (e) {
  }
};
GM.onNeedInformUserReduceMP = function(user){
  try {
    if(user){
      var userData = GM.processChangedUserStat(user);
      io.sockets.emit('changeUserStat', userData);
    }
  } catch (e) {
  }
};
GM.onNeedInformUserGetExp = function(user, addResource){
  try {
    if(user){
      var userData = GM.processChangedUserStat(user);
      io.to(user.socketID).emit('changeUserStat', userData, addResource);
    }
  } catch (e) {
  }
};
GM.onNeedInformUserGetResource = function(user, addResource){
  try {
    if(user){
      var resourceData = GM.processUserResource(user);
      io.to(user.socketID).emit('getResource', resourceData, addResource);
    }
  } catch (e) {
  }
};
GM.onNeedInformUserGetSkill = function(socketID, skillIndex){
  try {
    io.to(socketID).emit('getSkill', skillIndex);
  } catch (e) {
  }
};
GM.onNeedInformUserSkillChangeToResource = function(socketID, skillIndex){
  try {
    io.to(socketID).emit('skillChangeToResource', skillIndex);
  } catch (e) {
  }
};
GM.onNeedInformScoreData = function(){
  var rankDatas = GM.processScoreDatas();
  io.sockets.emit('updateRank', rankDatas);
};
GM.onNeedInformUserLevelUp = function(user){
  try {
    if(user){
      var userData = GM.processChangedUserStat(user);
      io.sockets.emit('changeUserStat', userData);
    }
  } catch (e) {
  }
};
GM.onNeedInformBuffUpdate = function(user){
  try {
    if(user){
      var buffData = GM.processBuffDataSetting(user);
      io.sockets.emit('updateBuff', buffData);
    }
  } catch (e) {
  }
  // io.to(user.socketID).emit('updateBuff', buffData);
};
GM.onNeedInformSkillUpgrade = function(socketID, beforeSkillIndex, afterSkillIndex, resourceData){
  try {
    io.to(socketID).emit('upgradeSkill', beforeSkillIndex, afterSkillIndex, resourceData);
  } catch (e) {
  }
};
GM.onNeedInformUserChangePrivateStat = function(user){
  try {
    if(user){
      var statData = GM.processUserPrivateDataSetting(user);
      io.to(user.socketID).emit('updateUserPrivateStat', statData);
    }
  } catch (e) {
  }
};
GM.onNeedInformUserChangeStat = function(user){
  try {
    if(user){
      var userData = GM.processChangedUserStat(user);
      // console.log(user.conditions);
      io.sockets.emit('changeUserStat', userData);
    }
  } catch (e) {
  }
};
GM.onNeedInformCreateChest = function(chest){
  var chestData = GM.processChestDataSetting(chest);
  io.sockets.emit('createChest', chestData);
};
GM.onNeedInformChestDamaged = function(locationID, HP){
  io.sockets.emit('chestDamaged', locationID, HP);
};
GM.onNeedInformDeleteChest = function(locationID){
  io.sockets.emit('deleteChest', locationID);
};
GM.onNeedInformCreateObjs = function(objs){
  try {
    var objDatas = [];
    for(var i=0; i<objs.length; i++){
      objDatas.push(GM.processOBJDataSetting(objs[i]));
    }
    io.sockets.emit('createOBJs', objDatas);
  } catch (e) {
  }
};
GM.onNeedInformDeleteObj = function(objID){
  io.sockets.emit('deleteOBJ', objID);
};
GM.onNeedInformSkillData = function(socketID, possessSkills){
  try {
    io.to(socketID).emit('updateSkillPossessions', possessSkills);
  } catch (e) {
  }
};
GM.onNeedInformProjectileDelete = function(projectileData){
  io.sockets.emit('deleteProjectile', projectileData.objectID, projectileData.id);
};
GM.onNeedInformProjectileExplode = function(projectileData){
  io.sockets.emit('explodeProjectile', projectileData.objectID, projectileData.id, {x : projectileData.x, y : projectileData.y});
};

io.on('connection', function(socket){
  console.log('user connect : ' + socket.id);
  var user;
  socket.on('reqStartGame', function(userType, userName){
    try {
      if(userType === gameConfig.CHAR_TYPE_FIRE || userType === gameConfig.CHAR_TYPE_FROST || userType === gameConfig.CHAR_TYPE_ARCANE){
        var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', userType, 'level', 1));
        var userBase = objectAssign({}, util.findData(userBaseTable, 'type', userType));
        user = new User(socket.id, userName, userStat, userBase, 0);

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

        // add all skills
        possessSkills.push(31); possessSkills.push(41); possessSkills.push(51);
        possessSkills.push(61); possessSkills.push(71); possessSkills.push(81);
        possessSkills.push(1021); possessSkills.push(1031); possessSkills.push(1041);
        possessSkills.push(1051); possessSkills.push(1061); possessSkills.push(1071);
        possessSkills.push(2021); possessSkills.push(2031); possessSkills.push(2041);
        possessSkills.push(2051); possessSkills.push(2061); possessSkills.push(2071); possessSkills.push(2081);

        // user init and join game
        GM.initializeUser(user, baseSkill, possessSkills, inherentPassiveSkill);
        GM.joinUser(user);
        GM.setScore(user.objectID);
        var userData = GM.processUserDataSetting(user);
        var rankDatas = GM.processScoreDatas();
        //send users user joined game
        socket.broadcast.emit('userJoined', userData, rankDatas);

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

        socket.emit('syncAndSetSkills', userData);
        socket.emit('resStartGame', userDatas, buffDatas, objDatas, chestDatas, rankDatas);
        GM.setStartBuff(user);
      }else{
        throw "charType error";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('reqRestartGame', function(userName, charType, equipSkills){
    try {
      if(user.objectID && charType === gameConfig.CHAR_TYPE_FIRE || charType === gameConfig.CHAR_TYPE_FROST || charType === gameConfig.CHAR_TYPE_ARCANE){
        var level = GM.getLevel(user.objectID, charType);

        var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', charType, 'level', level));
        var userBase = objectAssign({}, util.findData(userBaseTable, 'type', charType));
        GM.setUserStat(user.objectID, userStat, userBase);
        GM.setUserSkill(user.objectID, charType, userBase.baseSkill, userBase.basePassiveSkill);
        GM.setUserPosition(user.objectID);
        GM.startUserUpdate(user.objectID);
        GM.setScore(user.objectID);
        GM.setUserName(user.objectID, userName);
        var baseSkill = GM.getBaseSkill(user.objectID, charType);
        var inherentPassiveSkill = GM.getInherentPassiveSkill(user.objectID, charType);

        var userData = GM.processUserDataSetting(user);
        var rankDatas = GM.processScoreDatas();

        socket.broadcast.emit('userJoined', userData, rankDatas);
        GM.addSkillData(userData);
        GM.addPrivateData(userData);
        socket.emit('resRestartGame', userData, rankDatas);

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
        throw "charType error";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  // var timeDelay = Date.now();
  socket.on('userDataUpdate', function(userData, needInform){
    // console.log(userData.time - timeDelay);
    // timeDelay = userData.time;
    try {
      var rand = Math.floor(Math.random() * serverConfig.CHEAT_CHECK_RATE);
      if(rand === 1){
        if(GM.checkCheat(userData)){
        }else{
          console.log(userData.objectID + ' is cheating!!!!!');
        }
      }
      GM.updateUserData(userData);

      if(needInform){
        if(user){
          userData = GM.processUserDataSetting(user);
          socket.broadcast.emit('userDataSync', userData);
        }else{
          throw "user isn`t instantiated";
        }
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('userMoveStart', function(userData){
    try {
      GM.updateUserData(userData);

      if(user){
        userData = GM.processUserDataSetting(user);
        socket.broadcast.emit('userDataUpdate', userData);
      }else{
        throw "user isn`t instantiated";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('userMoveAndAttack', function(userAndSkillData){
    try {
      GM.updateUserData(userAndSkillData);
      if(user){
        var userData = GM.processUserDataSetting(user);
        userData.skillIndex = userAndSkillData.skillIndex;
        userData.skillTargetPosition = userAndSkillData.skillTargetPosition;
        userData.moveBackward = userAndSkillData.moveBackward;

        socket.broadcast.emit('userMoveAndAttack', userData);
      }else{
        throw "user isn`t instantiated";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('userUseSkill', function(userAndSkillData){
    try {
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
          socket.broadcast.emit('userDataUpdateAndUseSkill', userData);
        }else{
          throw "user isn`t instantiated";
        }
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('userStop', function(data){
    try {
      GM.updateUserData(data);
      if(user){
        var userData = GM.processUserDataSetting(user);
        socket.broadcast.emit('userDataUpdate', userData);
      }else{
        throw "user isn`t instantiated";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('skillFired', function(data){
    try {
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
          setTimeout(function(){
            GM.applySkill(user.objectID, skillData);
          }, timeoutTime);
          io.sockets.emit('skillFired', data, user.objectID);
        }
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e.message);
        socket.disconnect();
      }
    }
  });
  socket.on('projectilesFired', function(datas, syncFireTime){
    try {
      if(GM.checkSkillPossession(user.objectID, datas[0].skillIndex)){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', datas[0].skillIndex));
        if(GM.checkSkillCondition(user.objectID, skillData)){
          var serverSyncFireTime = syncFireTime + GM.getUserTimeDiff(user.objectID);
          var timeoutTime = serverSyncFireTime - Date.now();
          if(timeoutTime <serverConfig.MINIMUM_LATENCY){
            timeoutTime = serverConfig.MINIMUM_LATENCY;
          }
          setTimeout(function(){
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
          }, timeoutTime);
          io.sockets.emit('projectilesFired', datas, serverSyncFireTime, user.objectID);
        }
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e.message);
        socket.disconnect();
      }
    }
  });
  // socket.on('castCanceled', function(userData){
  //   GM.updateUserData(userData);
  //
  //   socket.broadcast.emit('castCanceled', userData.objectID);
  // });
  socket.on('upgradeSkill', function(skillIndex){
    try {
      if(user){
        GM.upgradeSkill(user, skillIndex);
      }else{
        throw "user isn`t instantiated";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('exchangePassive', function(beforeBuffGID, afterBuffGID){
    try {
      if(user){
        GM.exchangePassive(user, beforeBuffGID, afterBuffGID);
      }else{
        throw "user isn`t instantiated";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('equipPassive', function(buffGroupIndex){
    try {
      if(user){
        GM.equipPassive(user, buffGroupIndex);
      }else{
        throw "user isn`t instantiated";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('unequipPassive', function(buffGroupIndex){
    try {
      if(user){
        GM.unequipPassive(user, buffGroupIndex);
      }else{
        throw "user isn`t instantiated";
      }
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }else{
        console.log(e);
        socket.disconnect();
      }
    }
  });
  socket.on('killme', function(){
    GM.killme(user.objectID);
  });
  socket.on('giveExp', function(){
    GM.giveExp(user.objectID);
  });
  socket.on('giveResources', function(){
    GM.giveResources(user.objectID);
  });
  socket.on('firePing', function(date){
    socket.emit('firePong', date, Date.now());
  });
  socket.on('chatting', function(msg){
    try {
      var msg = util.processMessage(msg, gameConfig.CHAT_MESSAGE_LENGTH);
      io.sockets.emit('chatting', user.objectID, msg);
    } catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }
    }
  });
  socket.on('updateUserTimeDiff', function(clientDate, userLatency){
    var timeDiff = Date.now() - (clientDate + userLatency/2);
    try {
      GM.updateUserTimeDiff(user.objectID, timeDiff);
      GM.updateUserLatency(user.objectID, userLatency);
    }catch (e) {
      if(user){
        try {
          var rankDatas = GM.processScoreDatas(user.objectID);
          io.sockets.emit('userLeave', user.objectID, rankDatas);
        } catch (e) {
          console.log(e.message);
        } finally {
          GM.stopUser(user);
          GM.kickUser(user);
          console.log(e.message);
          socket.disconnect();
        }
      }
    }
  });
  socket.on('disconnect', function(){
    try {
      var rankDatas = GM.processScoreDatas(user.objectID);
      io.sockets.emit('userLeave', user.objectID, rankDatas);
      GM.stopUser(user);
      GM.kickUser(user);
    } catch (e) {
      console.log(e.message);
    } finally {
      socket.disconnect();
      user = null;
      console.log('user disconnect :' + socket.id);
      console.log('user count :' + Object.keys(GM.users).length);
    }
  });
});
