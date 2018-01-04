var http = require('http');
var express = require('express');
var socketio = require('socket.io');
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

var server = http.createServer(app);
var port = process.env.PORT || config.port;

server.listen(port, function(){
  console.log('Server is Running');
});

var GameManager = require('./modules/server/GameManager.js');
var GM = new GameManager();

GM.start();

var User = require('./modules/server/User.js');

var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;

var io = socketio.listen(server);

GM.onNeedInformUserTakeDamage = function(user, dmg, skillIndex){
  var userData = GM.processChangedUserStat(user);
  userData.damagedAmount = dmg;
  io.sockets.emit('userDamaged', userData, skillIndex);
};
GM.onNeedInformUserDeath = function(attackUserID, deadUserID, loseResource, newSkills){
  var scoreDatas = GM.processScoreDatas();
  var levelDatas = GM.processUserAllTypeLevels(deadUserID);
  io.sockets.emit('userDead', attackUserID, deadUserID, scoreDatas, levelDatas, loseResource, newSkills);
};
GM.onNeedInformUserReduceMP = function(user){
  var userData = GM.processChangedUserStat(user);
  io.sockets.emit('changeUserStat', userData);
};
GM.onNeedInformUserGetExp = function(user, addResource){
  var userData = GM.processChangedUserStat(user);
  io.to(user.socketID).emit('changeUserStat', userData, addResource);
};
GM.onNeedInformUserGetResource = function(user, addResource){
  var resourceData = GM.processUserResource(user);
  io.to(user.socketID).emit('getResource', resourceData, addResource);
};
GM.onNeedInformUserGetSkill = function(socketID, skillIndex){
  io.to(socketID).emit('getSkill', skillIndex);
};
GM.onNeedInformUserSkillChangeToResource = function(socketID, skillIndex){
  io.to(socketID).emit('skillChangeToResource', skillIndex);
};
GM.onNeedInformScoreData = function(){
  var rankDatas = GM.processScoreDatas();
  io.sockets.emit('updateRank', rankDatas);
};
GM.onNeedInformUserLevelUp = function(user){
  var userData = GM.processChangedUserStat(user);
  io.sockets.emit('changeUserStat', userData);
};
GM.onNeedInformBuffUpdate = function(user){
  var buffData = GM.processBuffDataSetting(user);
  io.sockets.emit('updateBuff', buffData);
  // io.to(user.socketID).emit('updateBuff', buffData);
};
GM.onNeedInformSkillUpgrade = function(socketID, beforeSkillIndex, afterSkillIndex, resourceData){
  io.to(socketID).emit('upgradeSkill', beforeSkillIndex, afterSkillIndex, resourceData);
};
GM.onNeedInformUserChangePrivateStat = function(user){
  var statData = GM.processUserPrivateDataSetting(user);
  io.to(user.socketID).emit('updateUserPrivateStat', statData);
};
GM.onNeedInformUserChangeStat = function(user){
  var userData = GM.processChangedUserStat(user);
  // console.log(user.conditions);
  io.sockets.emit('changeUserStat', userData);
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
  var objDatas = [];
  for(var i=0; i<objs.length; i++){
    objDatas.push(GM.processOBJDataSetting(objs[i]));
  }
  io.sockets.emit('createOBJs', objDatas);
  console.log('createObjs executed');
};
GM.onNeedInformDeleteObj = function(objID){
  console.log('onNeedInformDeleteObj : ' + objID);
  io.sockets.emit('deleteOBJ', objID);
};
GM.onNeedInformSkillData = function(socketID, possessSkills){
  io.to(socketID).emit('updateSkillPossessions', possessSkills);
  // socket.emit('updateSkillPossessions', possessSkills);
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
  socket.on('reqStartGame', function(userType){
    console.log('can u see me?');
    // console.log(userType);
    var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', userType, 'level', 1));
    var userBase = objectAssign({}, util.findData(userBaseTable, 'type', userType));
    user = new User(socket.id, userStat, userBase, 0);
    // console.log(user.type);
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
    socket.emit('resStartGame', userDatas, objDatas, chestDatas);
    GM.setStartBuff(user);
  });
  socket.on('reqRestartGame', function(charType, equipSkills){
    var level = GM.getLevel(user.objectID, charType);

    var userStat = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', charType, 'level', level));
    var userBase = objectAssign({}, util.findData(userBaseTable, 'type', charType));
    GM.setUserStat(user.objectID, userStat, userBase);
    GM.setUserSkill(user.objectID, charType, userBase.baseSkill, userBase.basePassiveSkill);
    GM.setUserPosition(user.objectID);
    GM.startUserUpdate(user.objectID);
    GM.setScore(user.objectID);
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
  });
  // var timeDelay = Date.now();
  socket.on('userDataUpdate', function(userData, needInform){
    // console.log(userData.time - timeDelay);
    // timeDelay = userData.time;
    var rand = Math.floor(Math.random() * serverConfig.CHEAT_CHECK_RATE);
    if(rand === 1){
      if(GM.checkCheat(userData)){
      }else{
        console.log(userData.objectID + ' is cheating!!!!!');
      }
    }
    GM.updateUserData(userData);

    if(needInform){
      userData = GM.processUserDataSetting(user);
      socket.broadcast.emit('userDataSync', userData);
      // io.sockets.emit('userDataSync', userData);
    }
  });
  socket.on('userMoveStart', function(userData){
    GM.updateUserData(userData);

    userData = GM.processUserDataSetting(user);
    socket.broadcast.emit('userDataUpdate', userData);
  });
  socket.on('userMoveAndAttack', function(userAndSkillData){
    GM.updateUserData(userAndSkillData);
    var userData = GM.processUserDataSetting(user);
    userData.skillIndex = userAndSkillData.skillIndex;
    userData.skillTargetPosition = userAndSkillData.skillTargetPosition;
    userData.moveBackward = userAndSkillData.moveBackward;

    socket.broadcast.emit('userMoveAndAttack', userData);
  });
  socket.on('userUseSkill', function(userAndSkillData){
    if(GM.checkSkillPossession(userAndSkillData.objectID, userAndSkillData.skillIndex)){
      GM.updateUserData(userAndSkillData);
      // if(userAndSkillData.cancelBlur){
      //   GM.cancelBlur(user.objectID);
      // }
      var userData = GM.processUserDataSetting(user);
      userData.skillIndex = userAndSkillData.skillIndex;
      userData.skillDirection = userAndSkillData.skillDirection;
      userData.skillTargetPosition = userAndSkillData.skillTargetPosition;
      if(userAndSkillData.projectileIDs){
        userData.skillProjectileIDs = userAndSkillData.projectileIDs;
      }
      socket.broadcast.emit('userDataUpdateAndUseSkill', userData);
    }
  });
  socket.on('skillFired', function(data){
    if(GM.checkSkillPossession(user.objectID, data.skillIndex)){
      var skillData = objectAssign({}, util.findData(skillTable, 'index', data.skillIndex));
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
  });
  socket.on('projectilesFired', function(datas, syncFireTime){
    if(GM.checkSkillPossession(user.objectID, datas[0].skillIndex)){
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
  });
  // socket.on('castCanceled', function(userData){
  //   GM.updateUserData(userData);
  //
  //   socket.broadcast.emit('castCanceled', userData.objectID);
  // });
  socket.on('upgradeSkill', function(skillIndex){
    GM.upgradeSkill(user, skillIndex);
  });
  socket.on('exchangePassive', function(beforeBuffGID, afterBuffGID){
    GM.exchangePassive(user, beforeBuffGID, afterBuffGID);
  });
  socket.on('equipPassive', function(buffGroupIndex){
    GM.equipPassive(user, buffGroupIndex);
  });
  socket.on('unequipPassive', function(buffGroupIndex){
    GM.unequipPassive(user, buffGroupIndex);
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
    var msg = util.processMessage(msg);
    io.sockets.emit('chatting', user.objectID, msg);
  });
  socket.on('updateUserTimeDiff', function(clientDate, userLatency){
    var timeDiff = Date.now() - (clientDate + userLatency/2);
    GM.updateUserTimeDiff(user.objectID, timeDiff);
    GM.updateUserLatency(user.objectID, userLatency);
  });
  socket.on('disconnect', function(){
    if(user){
      var rankDatas = GM.processScoreDatas(user.objectID);
      io.sockets.emit('userLeave', user.objectID, rankDatas);
      GM.stopUser(user);
      GM.kickUser(user);
      user = null;
    }
    console.log('user disconnect :' + socket.id);
  });
});
