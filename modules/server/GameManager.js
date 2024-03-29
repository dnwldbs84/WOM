var Obstacle = require('./Obstacle.js');
var config = require('../../config.json');
var gameConfig = require('../public/gameConfig.json');
var serverConfig = require('./serverConfig.json');
var util = require('../public/util.js');
var SUtil = require('./ServerUtil.js');

var SkillColliders = require('./SkillColliders.js');
var SkillCollider = SkillColliders.SkillCollider;
var ProjectileCollider = SkillColliders.ProjectileCollider;

var csvJson = require('../public/csvjson.js');
var csvJsonOption = {delimiter : ',', quote : '"'};

var dataJson = require('../public/data.json');
var serverDataJson = require('./serverData.json');

var skillTable = csvJson.toObject(dataJson.skillData, csvJsonOption);
var chestTable = csvJson.toObject(dataJson.chestData, csvJsonOption);
var obstacleTable = csvJson.toObject(dataJson.obstacleData, csvJsonOption);
var mobTable = csvJson.toObject(dataJson.mobData, csvJsonOption);
var mobGenTable = csvJson.toObject(serverDataJson.mobGenData, csvJsonOption);
var dropGroupTable = csvJson.toObject(serverDataJson.dropGroupData, csvJsonOption);
var objBuffTable = csvJson.toObject(dataJson.objBuffData, csvJsonOption);
// var map = require('../public/map.json');

var Monster = require('./Monster.js');
var OBJs = require('./OBJs.js');
// var OBJExp = OBJs.OBJExp;
var OBJSkill = OBJs.OBJSkill;
var OBJGold = OBJs.OBJGold;
var OBJJewel = OBJs.OBJJewel;
var OBJChest = OBJs.OBJChest;
var OBJBox = OBJs.OBJBox;
var OBJBuff = OBJs.OBJBuff;

var objectAssign = require('../public/objectAssign');
// var QuadTree = require('quadtree-lib');
var QuadTree = require('../public/quadtree.js');

var INTERVAL_TIMER = 1000/serverConfig.INTERVAL;

//quadTree var
//user and chest
var entityTree;
// var entityBefore150msTree;
// var entityBefore300msTree;

var userEles = [];
var mobEles = [];
// var userBefore150msEles = [];
// var userBefore300msEles = [];

var chestEles = [];
//skill
var colliderEles = [];

// for collection exp, gold, skill objs
var collectionTree;
var collectionEles = [];
var removeOBJs = [];

var deleteCollectionEle = [];
var addCollectionEle = [];
//obstacles...like tree, rock
var staticTree;
var staticEles = [];
var affectedEles = [];

// var mobOrderTimer = Date.now();
var auraCheckTimer = Date.now();

function GameManager(){
  this.users = [];
  this.monsters = [];

  this.skills = [];
  this.projectiles = [];

  this.obstacles = [];
  this.chests = [];
  this.chestLocations = [];
  // this.objExps = [];
  // this.addedObjExps = [];
  this.objSkills = [];
  this.addedObjSkills = [];
  this.objGolds = [];
  this.addedObjGolds = [];
  this.objJewels = [];
  this.addedObjJewels = [];
  this.objBoxs = [];
  this.addedObjBoxs = [];
  this.objBuffs = [];
  this.addedObjBuffs = [];
  // this.objExpsCount = serverConfig.OBJ_EXP_MIN_COUNT;
  // this.objSkillsCount = serverConfig.OBJ_SKILL_MIN_COUNT;
  // this.objBoxsCount = serverConfig.OBJ_BOX_COUNT;
  // this.objGoldsCount = serverConfig.OBJ_GOLD_COUNT;
  // this.objJewelsCount = serverConfig.OBJ_JEWEL_MIN_COUNT;

  this.longTimeInterval = false;
  this.updateInteval = false;
  this.staticInterval = false;
  this.affectInterval = false;

  this.onUserEnterPortal = new Function();
  this.onNeedInformBuffUpdate = new Function();
  this.onNeedInformSkillUpgrade = new Function();
  this.onNeedInformUserChangePrivateStat = new Function();
  this.onNeedInformUserChangeStat = new Function();
  this.onNeedInformUserTakeDamage = new Function();
  this.onNeedInformUserReduceMP = new Function();
  // this.onNeedInformUserGetExp = new Function();
  this.onNeedInformUserGetResource = new Function();
  this.onNeedInformUserGetSkill = new Function();
  this.onNeedInformUserSkillChangeToResource = new Function();
  this.onNeedInformUserLevelUp = new Function();
  this.onNeedInformUserDeath = new Function();

  this.onNeedInformCreateObjs = new Function();
  this.onNeedInformDeleteObj = new Function();
  this.onNeedInformCreateChest = new Function();
  this.onNeedInformChestDamaged = new Function();
  this.onNeedInformDeleteChest = new Function();

  // this.onNeedInformSkillData = new Function();
  this.onNeedInformProjectileDelete = new Function();
  this.onNeedInformProjectileExplode = new Function();

  this.onNeedInformMobsCreate = new Function();
  this.onNeedInfromMobChangeState = new Function();
};

GameManager.prototype.start = function(){
  entityTree = new QuadTree({
    width : gameConfig.CANVAS_MAX_SIZE.width,
    height : gameConfig.CANVAS_MAX_SIZE.height,
    maxElements : 5
  });
  // entityBefore150msTree = new QuadTree({
  //   width : gameConfig.CANVAS_MAX_SIZE.width,
  //   height : gameConfig.CANVAS_MAX_SIZE.height,
  //   maxElements : 5
  // });
  // entityBefore300msTree = new QuadTree({
  //   width : gameConfig.CANVAS_MAX_SIZE.width,
  //   height : gameConfig.CANVAS_MAX_SIZE.height,
  //   maxElements : 5
  // });

  collectionTree = new QuadTree({
    width : gameConfig.CANVAS_MAX_SIZE.width,
    height : gameConfig.CANVAS_MAX_SIZE.height,
    maxElements : 5
  });
  staticTree = new QuadTree({
    width : gameConfig.CANVAS_MAX_SIZE.width,
    height : gameConfig.CANVAS_MAX_SIZE.height,
    maxElements : 5
  });

  this.mapSetting();
  this.updateGame();
};
GameManager.prototype.mapSetting = function(){
  this.setObstacles();
  this.setEnvironment();
  this.setChestsLocation();
  this.setStaticTreeEle();
  // this.setOBJExps();
  // this.setOBJSkills();
  // this.setOBJGolds();

  // this.testJewel();
  // this.testBox();
};
// GameManager.prototype.testJewel = function(){
//   var objJewel = this.createOBJs(1, gameConfig.PREFIX_OBJECT_JEWEL, 1, {x : 300, y: 300});
// };
// GameManager.prototype.testBox = function(){
//   var objBox = this.createOBJs(1, gameConfig.PREFIX_OBJECT_BOX, 1, {x : 500, y : 500});
// };
GameManager.prototype.updateGame = function(){
  if(this.longTimeInterval === false){
    this.longTimeInterval = setInterval(longTimeIntervalHandler.bind(this), serverConfig.LONG_TIME_INTERVAL_TIME);
  }
  if(this.updateInteval === false){
    this.updateInteval = setInterval(updateIntervalHandler.bind(this), INTERVAL_TIMER);
  }
  if(this.staticInterval === false){
    this.staticInterval = setInterval(staticIntervalHandler.bind(this), INTERVAL_TIMER);
  }
  if(this.affectInterval === false){
    var thisManager = this;
    setTimeout(function(){
      thisManager.affectInterval = setInterval(affectedIntervalHandler.bind(thisManager), INTERVAL_TIMER);
    }, INTERVAL_TIMER/3);
  }
};
//create obstacles and static tree setup
GameManager.prototype.setObstacles = function(){
  var trees = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_TREE));
  for(var i=0; i<Object.keys(trees).length; i++){
    var tempTree = new Obstacle(trees[i].posX, trees[i].posY, trees[i].radius, trees[i].id);
    this.obstacles.push(tempTree);
    staticEles.push(tempTree.staticEle);
  }
  var rocks = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_ROCK));
  for(var i=0; i<Object.keys(rocks).length; i++){
    var tempRock = new Obstacle(rocks[i].posX, rocks[i].posY, rocks[i].radius, rocks[i].id);
    this.obstacles.push(tempRock);
    staticEles.push(tempRock.staticEle);
  }
};
GameManager.prototype.setEnvironment = function(){
  var immortalZones = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.ENV_TYPE_IMMORTAL_GROUND));
  for(var i=0; i<Object.keys(immortalZones).length; i++){
    var tempObstacle = new Obstacle(immortalZones[i].posX, immortalZones[i].posY, immortalZones[i].radius, immortalZones[i].id);
    // this.obstacles.push(tempObstacle);
    staticEles.push(tempObstacle.staticEle);
  }
  var portalZone = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.ENV_TYPE_PORTAL));
  for(var i=0; i<Object.keys(portalZone).length; i++){
    var tempObstacle = new Obstacle(portalZone[i].posX, portalZone[i].posY, portalZone[i].radius, portalZone[i].id);
    // this.obstacles.push(tempObstacle);
    staticEles.push(tempObstacle.staticEle);
  }
};
GameManager.prototype.setChestsLocation = function(){
  var chestGrounds = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
  for(var i=0; i<Object.keys(chestGrounds).length; i++){
    var tempGround = new Obstacle(chestGrounds[i].posX, chestGrounds[i].posY, chestGrounds[i].radius, chestGrounds[i].id);

    this.chestLocations.push(tempGround);
    staticEles.push(tempGround.staticEle);
  }
};
GameManager.prototype.setStaticTreeEle = function(){
  staticTree.pushAll(staticEles);
};
// GameManager.prototype.setOBJSkills = function(){
//   for(var i=0; i<this.objSkillsCount; i++){
//     var randomID = SUtil.generateRandomUniqueID(this.objSkills, gameConfig.PREFIX_OBJECT_SKILL);
//     var objSkill = new OBJSkill(randomID);
//     var skillIndex = 21;
//     var radius = gameConfig.OBJ_SKILL_RADIUS;
//     var randomPos = SUtil.generateRandomPos(collectionTree, 0, 0, gameConfig.CANVAS_MAX_SIZE.width - radius, gameConfig.CANVAS_MAX_SIZE.height - radius,
//                                       radius, serverConfig.OBJ_SKILL_RANGE_WITH_OTHERS, randomID, staticTree);
//
//     objSkill.initOBJSkill(randomPos, radius, skillIndex);
//     objSkill.setCollectionEle();
//     // this.staticTree.push(food.staticEle);
//     this.objSkills.push(objSkill);
//     collectionEles.push(objSkill.collectionEle);
//     collectionTree.push(objSkill.collectionEle);
//   }
// };
// GameManager.prototype.setOBJGolds = function(){
//   for(var i=0; i<this.objGoldsCount; i++){
//     var randomID = SUtil.generateRandomUniqueID(this.objGolds, gameConfig.PREFIX_OBJECT_GOLD);
//     var objGold = new OBJGold(randomID);
//     var goldAmount = SUtil.getRandomNum(serverConfig.OBJ_GOLD_MIN_GOLD_AMOUNT, serverConfig.OBJ_GOLD_MAX_GOLD_AMOUNT);
//     var radius = SUtil.goldToRadius(goldAmount);
//     var randomPos = SUtil.generateRandomPos(collectionTree, 0, 0, gameConfig.CANVAS_MAX_SIZE.width - radius, gameConfig.CANVAS_MAX_SIZE.height - radius,
//                                       radius, serverConfig.OBJ_GOLD_RANGE_WITH_OTHERS, randomID, staticTree);
//
//     objGold.initOBJGold(randomPos, radius, goldAmount);
//     objGold.setCollectionEle();
//     // this.staticTree.push(food.staticEle);
//     this.objGolds.push(objGold);
//     collectionEles.push(objGold.collectionEle);
//     collectionTree.push(objGold.collectionEle);
//   }
// };
GameManager.prototype.createChest = function(chestLocationID){
  var chestGrounds = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
  for(var i=0; i<Object.keys(chestGrounds).length; i++){
    if(chestGrounds[i].id === chestLocationID){
      // var chestGrade = Math.floor(Math.random() * (chestGrounds[i].chestGradeMax - chestGrounds[i].chestGradeMin + 1) + chestGrounds[i].chestGradeMin);
      // var chestData = objectAssign({}, util.findData(chestTable, 'grade', chestGrade));
      var totalRate = serverConfig.CHEST_GRADE_RATE_1 + serverConfig.CHEST_GRADE_RATE_2 + serverConfig.CHEST_GRADE_RATE_3 +
                      serverConfig.CHEST_GRADE_RATE_4 + serverConfig.CHEST_GRADE_RATE_5;
      if (Object.keys(this.users).length <= 10) {
        totalRate = serverConfig.CHEST_GRADE_RATE_1 + serverConfig.CHEST_GRADE_RATE_2 + serverConfig.CHEST_GRADE_RATE_3;
      } else if (Object.keys(this.users).length <= 20) {
        totalRate = serverConfig.CHEST_GRADE_RATE_1 + serverConfig.CHEST_GRADE_RATE_2 + serverConfig.CHEST_GRADE_RATE_3 +
                    serverConfig.CHEST_GRADE_RATE_4;
      }
      var chestGrade = 1;
      var randVal = Math.floor(Math.random() * totalRate);
      var sumOfRate = 0;
      for(var j=0; j<5; j++){
        sumOfRate += serverConfig['CHEST_GRADE_RATE_' + (j + 1)];
        if(sumOfRate >= randVal){
          chestGrade = j + 1;
          break;
        }
      }

      var chestDatas = objectAssign({}, util.findAllDatas(chestTable, 'grade', chestGrade));
      var chestDatasLength = Object.keys(chestDatas).length;
      var index = Math.floor(Math.random() * chestDatasLength);
      var chestData = chestDatas[index];
      var position = {x : chestGrounds[i].posX, y : chestGrounds[i].posY};
      var chestID = SUtil.generateRandomUniqueID(this.chests, gameConfig.PREFIX_CHEST);

      var chest = new OBJChest(chestID, chestLocationID);
      chest.initOBJChest(position, chestGrounds[i].radius, chestData);
      chest.setEntityEle();
      this.chests.push(chest);
      this.onNeedInformCreateChest(chest);

      chest.onTakeDamage = SUtil.onChestDamaged.bind(this);
      chest.onDestroy = SUtil.onChestDestroy.bind(this);
      break;
    }
  }
};
GameManager.prototype.createOBJs = function(count, type, amount, nearPosition, nearRange){
  var createdObjs =[];
  var range = nearRange ? nearRange : serverConfig.CHEST_NEAR_RANGE;
  if(type === gameConfig.PREFIX_OBJECT_SKILL){
    for(var i=0; i<count; i++){
      var randomID = SUtil.generateRandomUniqueID(this.objSkills, gameConfig.PREFIX_OBJECT_SKILL);
      var objSkill = new OBJSkill(randomID);
      if(amount){
        var skillIndex = amount;
      }else{
        skillIndex = 21;
      }
      var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
      var radius = gameConfig.OBJ_SKILL_RADIUS;
      if(nearPosition){
        var randomPos = SUtil.generateNearPos(nearPosition, range, staticTree, randomID, radius);
      }else{
        randomPos = SUtil.generateRandomPos(collectionTree, 200, 200, gameConfig.CANVAS_MAX_SIZE.width - 200, gameConfig.CANVAS_MAX_SIZE.height - 200,
                                          radius, serverConfig.OBJ_SKILL_RANGE_WITH_OTHERS, randomID, staticTree);
      }

      if(randomPos){
        objSkill.initOBJSkill(randomPos, radius, skillIndex, skillData.property);
        objSkill.setCollectionEle();
        this.objSkills.push(objSkill);
        this.addedObjSkills.push(objSkill);
        createdObjs.push(objSkill);
      }
    }
  }else if(type === gameConfig.PREFIX_OBJECT_GOLD){
    for(var i=0; i<count; i++){
      var randomID = SUtil.generateRandomUniqueID(this.objGolds, gameConfig.PREFIX_OBJECT_GOLD);
      var objGold = new OBJGold(randomID);
      if(amount){
        var goldAmount = amount;
      }else{
        goldAmount = serverConfig.OBJ_GOLD_MIN_GOLD_AMOUNT;
      }
      var radius = SUtil.goldToRadius(goldAmount);
      if(nearPosition){
        var randomPos = SUtil.generateNearPos(nearPosition, range, staticTree, randomID, radius);
      }else{
        randomPos = SUtil.generateRandomPos(collectionTree, 200, 200, gameConfig.CANVAS_MAX_SIZE.width - 200, gameConfig.CANVAS_MAX_SIZE.height - 200,
                                            radius, serverConfig.OBJ_GOLD_RANGE_WITH_OTHERS, randomID, staticTree);
      }
      if(randomPos){
        objGold.initOBJGold(randomPos, radius, goldAmount);
        objGold.setCollectionEle();

        this.objGolds.push(objGold);
        this.addedObjGolds.push(objGold);
        createdObjs.push(objGold);
      }
    }
  }else if(type === gameConfig.PREFIX_OBJECT_JEWEL){
    for(var i=0; i<count; i++){
      var randomID = SUtil.generateRandomUniqueID(this.objJewels, gameConfig.PREFIX_OBJECT_JEWEL);
      var objJewel = new OBJJewel(randomID);
      if(amount){
        var jewelAmount = amount;
      }else{
        jewelAmount = serverConfig.OBJ_JEWEL_MIN_JEWEL_AMOUNT;
      }
      var radius = gameConfig.OBJ_JEWEL_RADIUS;
      if(nearPosition){
        var randomPos = SUtil.generateNearPos(nearPosition, range, staticTree, randomID, radius);
      }else{
        randomPos = SUtil.generateRandomPos(collectionTree, 200, 200, gameConfig.CANVAS_MAX_SIZE.width - 200, gameConfig.CANVAS_MAX_SIZE.height - 200,
                                            radius, serverConfig.OBJ_GOLD_RANGE_WITH_OTHERS, randomID, staticTree);
      }
      if(randomPos){
        objJewel.initOBJJewel(randomPos, radius, jewelAmount);
        objJewel.setCollectionEle();

        this.objJewels.push(objJewel);
        this.addedObjJewels.push(objJewel);
        createdObjs.push(objJewel);
      }
    }
  }else if(type === gameConfig.PREFIX_OBJECT_BOX){
    for(var i=0; i<count; i++){
      var randomID = SUtil.generateRandomUniqueID(this.objBoxs, gameConfig.PREFIX_OBJECT_BOX);
      var objBox = new OBJBox(randomID);
      var radius = gameConfig.OBJ_BOX_RADIUS;
      var objDrops = SUtil.getBoxDrop();
      if(nearPosition){
        var randomPos = SUtil.generateNearPos(nearPosition, range, staticTree, randomID, radius);
      }else{
        randomPos = SUtil.generateRandomPos(collectionTree, 200, 200, gameConfig.CANVAS_MAX_SIZE.width - 200, gameConfig.CANVAS_MAX_SIZE.height - 200,
                                            radius, serverConfig.OBJ_GOLD_RANGE_WITH_OTHERS, randomID, staticTree);
      }
      if(randomPos){
        objBox.initOBJBox(randomPos, radius, objDrops.gold, objDrops.jewel, objDrops.skillIndex);
        objBox.setCollectionEle();

        this.objBoxs.push(objBox);
        this.addedObjBoxs.push(objBox);
        createdObjs.push(objBox);
      }
    }
  }else if(type === gameConfig.PREFIX_OBJECT_BUFF){
    for(var i=0; i<count; i++){
      var randomID = SUtil.generateRandomUniqueID(this.objBuffs, gameConfig.PREFIX_OBJECT_BUFF);
      //find buff
      var isHealObj = Math.random() > 0.4;
      if (isHealObj) {
        var objBuffIndex = 0;
      } else {
        objBuffIndex = Math.floor(Math.random() * objBuffTable.length);
      }
      var objBuffData = objBuffTable[objBuffIndex];

      var objBuff = new OBJBuff(randomID, objBuffData.resourceIndex);
      var radius = gameConfig.OBJ_BUFF_RADIUS;

      if(nearPosition){
        var randomPos = SUtil.generateNearPos(nearPosition, range, staticTree, randomID, radius);
      }else{
        randomPos = SUtil.generateRandomPos(collectionTree, 200, 200, gameConfig.CANVAS_MAX_SIZE.width - 200, gameConfig.CANVAS_MAX_SIZE.height - 200,
                                            radius, serverConfig.OBJ_GOLD_RANGE_WITH_OTHERS, randomID, staticTree);
      }
      if(randomPos){
        objBuff.initOBJBuff(randomPos, radius, objBuffData.buffGroupIndex);
        objBuff.setCollectionEle();

        this.objBuffs.push(objBuff);
        this.addedObjBuffs.push(objBuff);
        createdObjs.push(objBuff);
      }
    }
  }else{
    console.log('check objs prefix : ' + type);
  }
  return createdObjs;
};
// GameManager.prototype.createOBJsWhenHitStone = function(stoneID){
//   for(var i=0; i<this.obstacles.length; i++){
//     if(this.obstacles[i].objectID === stoneID){
//       var randVal = Math.floor(Math.random() * serverConfig.OBSTACLE_STONE_GOLD_RATE);
//       var createdObjs = [];
//       if(randVal === 5){
//         var amount = Math.floor(Math.random() * (serverConfig.OBSTACLE_STONE_GOLD_MAX - serverConfig.OBSTACLE_STONE_GOLD_MIN + 1) + serverConfig.OBSTACLE_STONE_GOLD_MIN);
//         var objGold = this.createOBJs(1, gameConfig.PREFIX_OBJECT_GOLD, amount, this.obstacles[i].center, this.obstacles[i].size.width / 2 + 40);
//         if(objGold.length){
//           createdObjs.push(objGold[0]);
//         }
//       }
//       randVal = Math.floor(Math.random() * serverConfig.OBSTACLE_STONE_JEWEL_RATE);
//       if(randVal === 13){
//         var objJewel = this.createOBJs(1, gameConfig.PREFIX_OBJECT_JEWEL, 1, this.obstacles[i].center, this.obstacles[i].size.width / 2 + 40);
//         if(objJewel.length){
//           createdObjs.push(objJewel[0]);
//         }
//       }
//       if(createdObjs.length){
//         this.onNeedInformCreateObjs(createdObjs);
//       }
//       break;
//     }
//   }
// };
// GameManager.prototype.createBoxWhenHitTree = function(treeID){
//   for(var i=0; i<this.obstacles.length; i++){
//     if(this.obstacles[i].objectID === treeID){
//       var randVal = Math.floor(Math.random() * serverConfig.OBSTACLE_TREE_BOX_RATE);
//       if(randVal === 9){
//         var objBox = this.createOBJs(1, gameConfig.PREFIX_OBJECT_BOX, 1, this.obstacles[i].center, this.obstacles[i].size.width / 2 + 40);
//         if(objBox.length){
//           this.onNeedInformCreateObjs(objBox);
//         }
//       }
//       break;
//     }
//   }
// };
GameManager.prototype.createGoldsToRandomPosition = function(count){
  var createdObjs = [];
  for(var i=0; i<count; i++){
    var amount = Math.floor(Math.random() * (serverConfig.OBJ_GOLD_MAX_GOLD_AMOUNT - serverConfig.OBJ_GOLD_MIN_GOLD_AMOUNT + 1) + serverConfig.OBJ_GOLD_MIN_GOLD_AMOUNT);
    var objGold = this.createOBJs(1, gameConfig.PREFIX_OBJECT_GOLD, amount);
      // , {x : rock.posX + rock.radius, y : rock.posY + rock.radius}, rock.radius + 40);
    if(objGold.length){
      createdObjs.push(objGold[0]);
    }
  }
  if(createdObjs.length){
    this.onNeedInformCreateObjs(createdObjs);
  }
};
GameManager.prototype.createJewelsToRandomPosition = function(count){
  var createdObjs = [];
  for(var i=0; i<count; i++){
    var objJewel = this.createOBJs(1, gameConfig.PREFIX_OBJECT_JEWEL, 1);
      // , {x : rock.posX + rock.radius, y : rock.posY + rock.radius}, rock.radius + 40);
    if(objJewel.length){
      createdObjs.push(objJewel[0]);
    }
  }
  if(createdObjs.length){
    this.onNeedInformCreateObjs(createdObjs);
  }
};
GameManager.prototype.createBoxsToRandomPosition = function(count){
  var createdObjs = [];
  for(var i=0; i<count; i++){
    var objBox = this.createOBJs(1, gameConfig.PREFIX_OBJECT_BOX, 1);
      // {x : tree.posX + tree.radius, y : tree.posY + tree.radius}, tree.radius + 40);
    if(objBox.length){
      createdObjs.push(objBox[0]);
    }
  }
  if(createdObjs.length){
    this.onNeedInformCreateObjs(createdObjs);
  }
};
GameManager.prototype.createBuffToRandomPosition = function(count){
  var createdObjs = [];
  for(var i=0; i<count; i++){
    var objBuff = this.createOBJs(1, gameConfig.PREFIX_OBJECT_BUFF, 1);
      // {x : tree.posX + tree.radius, y : tree.posY + tree.radius}, tree.radius + 40);
    if(objBuff.length){
      createdObjs.push(objBuff[0]);
    }
  }
  if(createdObjs.length){
    this.onNeedInformCreateObjs(createdObjs);
  }
};
GameManager.prototype.createMobs = function(count, type){
  var mobs = [];
  for(var i=0; i<count; i++){
    var mob = this.createMob(type);
    if(mob){
      mobs.push(mob);
    }
  }
  this.onNeedInformMobsCreate(mobs);
};
GameManager.prototype.createMob = function(type){
  // if(type === serverConfig.MOB_GEN_TYPE_SMALL ||
  //    type === serverConfig.MOB_GEN_TYPE_SMALL_CENTER ||
  //    type === serverConfig.MOB_GEN_TYPE_MEDIUM){
    //set gen type
  var mobGenDatas = objectAssign({}, util.findAllDatas(mobGenTable, 'mobGenType', type));
  var index = Math.floor(Math.random() * Object.keys(mobGenDatas).length);
  var mobGenData = mobGenDatas[index];
  if(Object.keys(mobGenDatas).length){
    if (type === serverConfig.MOB_GEN_TYPE_STRONG_CHEST) {
      for (var i in this.monsters) {
        if (this.monsters[i].mobGenType === serverConfig.MOB_GEN_TYPE_STRONG_CHEST) {
          // select other chest location
          for (var j in mobGenDatas) {
            if (mobGenDatas[j].index !== this.monsters[i].genIndex) {
              mobGenData = mobGenDatas[j];
              break;
            }
          }
        }
      }
    }

    var mobDatas = util.getMobs(mobGenData, mobTable);
    if(mobDatas.length){
      var mobIndex = Math.floor(Math.random() * mobDatas.length);
      var mobData = mobDatas[mobIndex];

      var mob = new Monster(mobData, mobGenData);
      var randomID = SUtil.generateRandomUniqueID(this.monsters, gameConfig.PREFIX_MONSTER);

      mob.assignID(randomID);
      mob.setSize(mobData.size, mobData.size);
      var randomDirection = Math.random() > 0.5 ? 1 : -1 * Math.floor(Math.random() * 180);

      mob.setDirection(randomDirection);
      var insidePosition = SUtil.generateInsidePos({x : mobGenData.genPosX, y : mobGenData.genPosY }, mobGenData.freeMoveRange, staticTree, randomID, mobData.size, true);

      var isInImmortalZone = true;
      var repeatCount = 0;
      while (isInImmortalZone) {
        repeatCount++;
        if (repeatCount > 10) {
          isInImmortalZone = false;
          insidePosition = 0;
        } else if (insidePosition && insidePosition.x >= gameConfig.CANVAS_MAX_SIZE.width - 400 &&
            insidePosition.y >= gameConfig.CANVAS_MAX_SIZE.width - 400) {
            insidePosition = SUtil.generateInsidePos({x : mobGenData.genPosX, y : mobGenData.genPosY }, mobGenData.freeMoveRange, staticTree, randomID, mobData.size, true);
        } else {
          isInImmortalZone = false;
        }
      }

      if(insidePosition) {
        mob.setPosition(insidePosition.x, insidePosition.y);
        mob.initEntityEle();
        var dropData = objectAssign({}, util.findData(dropGroupTable, 'index', mobData.dropIndex));
        mob.initDropData(dropData);

        mob.onNeedToGetMobTarget = getMobTarget.bind(this);
        mob.onNeedToGetMobTargetPos = SUtil.getMobTargetPos.bind(this);
        mob.onNeedToGetMobDirection = SUtil.getMobDirection.bind(this);
        mob.onChangeState = SUtil.onMobChangeState.bind(this);
        mob.onAttackUser = SUtil.onMobAttackUser.bind(this);

        mob.onMove = onMoveCalcCompelPos.bind(mob);
        mob.onTakeDamage = SUtil.onMobTakeDamage.bind(this);
        mob.onBuffExchange = SUtil.onMobBuffExchange.bind(this);
        mob.onDeath = SUtil.onMobDeath.bind(this);

        this.monsters[mob.objectID] = mob;
        // this.monsters.push(mob);
        mob.startUpdate();
        mob.changeState(gameConfig.OBJECT_STATE_IDLE);
        return mob;
      }else{
        return false;
      }
    }
  }else{
    return false;
  }
  // }
  return false;
  // if(type === serverConfig.MOB_GEN_TYPE_SMALL){
  //   // var randomID = SUtil.generateRandomUniqueID(this.monsters, gameConfig.PREFIX_MONSTER);
  //   // var mobData = ;
  //   // var mobGenData = ;
  //   //
  //   // var mob = new Monster();
  // }
};
GameManager.prototype.getObj = function(objID, affectNum, userID, treeObj){
  if(userID in this.users && !this.users[userID].isDead){
    // if(objID.substr(0, 3) === gameConfig.PREFIX_OBJECT_EXP){
    //   for(var i=0; i<this.objExps.length; i++){
    //     if(this.objExps[i].objectID === objID){
    //       this.users[userID].getExp(affectNum);
    //
    //       this.objExps.splice(i, 1);
    //       this.onNeedInformDeleteObj(objID);
    //       return;
    //     }
    //   }
    // }else
    if(objID.substr(0, 1) === gameConfig.PREFIX_OBJECT_SKILL){
      for(var i=0; i<this.objSkills.length; i++){
        if(this.objSkills[i].objectID === objID){
          this.users[userID].getSkill(affectNum);
          // var possessSkills = this.users[userID].getSkill(affectNum);
          // if(possessSkills){
          //   this.onNeedInformSkillData(this.users[userID].socketID, possessSkills);
          // }
          this.objSkills.splice(i, 1);
          break;
        }
      }
    }else if(objID.substr(0, 1) === gameConfig.PREFIX_OBJECT_GOLD){
      for(var i=0; i<this.objGolds.length; i++){
        if(this.objGolds[i].objectID === objID){
          this.users[userID].getGold(affectNum);
          // this.users[userID].getExp(serverConfig.OBJ_GOLD_EXP);
          this.objGolds.splice(i, 1);
          break;
        }
      }
    }else if(objID.substr(0, 1) === gameConfig.PREFIX_OBJECT_JEWEL){
      for(var i=0; i<this.objJewels.length; i++){
        if(this.objJewels[i].objectID === objID){
          this.users[userID].getJewel(affectNum);
          // this.users[userID].getExp(serverConfig.OBJ_JEWEL_EXP);
          this.objJewels.splice(i, 1);
          break;
        }
      }
    }
    removeOBJs.push(treeObj);
    this.onNeedInformDeleteObj(objID);
  }
};
GameManager.prototype.getBox = function(objID, box, userID, treeObj){
  if(userID in this.users && !this.users[userID].isDead){
    removeOBJs.push(treeObj);
    for(var i=0; i<this.objBoxs.length; i++){
      if(this.objBoxs[i].objectID === objID){
        // if(box.expAmount){
        //   this.users[userID].getExp(box.expAmount);
        // }
        if(box.goldAmount){
          this.users[userID].getGold(box.goldAmount);
        }
        if(box.jewelAmount){
          this.users[userID].getJewel(box.jewelAmount);
        }
        if(box.skillIndex){
          this.users[userID].getSkill(box.skillIndex);
          // var possessSkills = this.users[userID].getSkill(box.skillIndex);
          // if(possessSkills){
          //   this.onNeedInformSkillData(this.users[userID].socketID, possessSkills);
          // }
        }
        this.objBoxs.splice(i, 1);
        this.onNeedInformDeleteObj(objID);
        return;
      }
    }
  }
};
GameManager.prototype.getBuff = function(objID, buffGroupIndex, userID, treeObj){
  if(userID in this.users && !this.users[userID].isDead){
    removeOBJs.push(treeObj);
    for(var i=0; i<this.objBuffs.length; i++){
      if(this.objBuffs[i].objectID === objID){
        this.users[userID].addBuff(buffGroupIndex, userID);
        this.objBuffs.splice(i, 1);
        this.onNeedInformDeleteObj(objID);
        return;
      }
    }
  }
};
// GameManager.prototype.deleteObj = function(objID){
//   if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_EXP){
//     for(var i=0; i<this.objExps.length; i++){
//       if(this.objExps[i].objectID === objID){
//         this.objExps.splice(i, 1);
//
//         this.onNeedInformDeleteObj(objID);
//         return;
//       }
//     }
//   }
//   // else if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_SKILL){
//   //   for(var i=0; i<this.objSkills.length; i++){
//   //     if(this.objSkills[i].objectID === objID){
//   //       this.objSkills.splice(i, 1);
//   //       this.onNeedInformDeleteObj(objID);
//   //       return;
//   //     }
//   //   }
//   // }
//   else if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_GOLD){
//     for(var i=0; i<this.objGolds.length; i++){
//       if(this.objGolds[i].objectID === objID){
//         this.objGolds.splice(i, 1);
//
//         this.onNeedInformDeleteObj(objID);
//         return;
//       }
//     }
//   }
// };

// user join, kick, update
GameManager.prototype.joinUser = function(user){
  this.users[user.objectID] = user;
  this.users[user.objectID].onBuffExchange = SUtil.onUserBuffExchange.bind(this);
  this.users[user.objectID].onSkillUpgrade = SUtil.onUserSkillUpgrade.bind(this);
  // this.users[user.objectID].onMove = onMoveCalcCompelPos.bind(this);
  this.users[user.objectID].onChangePrivateStat = SUtil.onUserChangePrivateStat.bind(this);
  this.users[user.objectID].onChangeStat = SUtil.onUserChangeStat.bind(this);
  this.users[user.objectID].onTakeDamage = SUtil.onUserTakeDamage.bind(this);
  this.users[user.objectID].onReduceMP = SUtil.onUserReduceMP.bind(this);
  // this.users[user.objectID].onGetExp = SUtil.onUserGetExp.bind(this);
  this.users[user.objectID].onGetResource = SUtil.onUserGetResource.bind(this);
  this.users[user.objectID].onGetSkill = SUtil.onUserGetSkill.bind(this);
  this.users[user.objectID].onSkillChangeToResource = SUtil.onUserSkillChangeToResource.bind(this);
  this.users[user.objectID].onScoreChange = SUtil.onUserScoreChange.bind(this);
  // this.users[user.objectID].onLevelUP = SUtil.onUserLevelUP.bind(this);
  this.users[user.objectID].onDeath = SUtil.onUserDeath.bind(this);
  // this.setStartBuff(user);
  // this.objExpsCount += serverConfig.OBJ_EXP_ADD_PER_USER;
  // this.objGoldsCount += serverConfig.OBJ_GOLD_ADD_PER_USER;
  // console.log(user.conditions);
  // console.log(this.users);
};
GameManager.prototype.kickUser = function(user){
  if(user.objectID in this.users){
    // this.users[user.objectID].clearAll();
    delete this.users[user.objectID];
    // this.objGoldsCount -= serverConfig.OBJ_GOLD_ADD_PER_USER;
    // this.objExpsCount -= serverConfig.OBJ_EXP_ADD_PER_USER;
  }else{
    console.log("can`t find user`s ID. user already out of game");
  }
};
GameManager.prototype.kickAllUser = function(){
  for(var index in this.users){
    this.users[index].clearAll();
    delete this.users[index];
  }
};
GameManager.prototype.stopUser = function(user){
  user.clearAll();
};
GameManager.prototype.setStartBuff = function(user){
  this.users[user.objectID].addBuff(serverConfig.START_BUFF_INDEX, user.objectID);
};
//user initialize
GameManager.prototype.initializeUser = function(user, possessSkills){
  // check ID is unique
  var randomID = SUtil.generateRandomUniqueID(this.users, gameConfig.PREFIX_USER);
  //initialize variables;
  user.assignID(randomID);

  user.setSize(gameConfig.USER_BODY_SIZE, gameConfig.USER_BODY_SIZE);
  // user.setPosition(10, 10);
  // this.setUserPosition(user.objectID);

  user.setSkills(possessSkills);

  user.initEntityEle();
  user.startUpdate();
};
GameManager.prototype.applySkill = function(userID, skillData){
  if(userID in this.users && !this.users[userID].isDead){
    this.users[userID].applyCooldown(skillData);
    //check buff
    SUtil.checkUserBuff(this.users[userID], skillData);

    this.users[userID].consumeMP(skillData.consumeMP);
    if(skillData.buffToSelf){
      this.users[userID].addBuff(skillData.buffToSelf, userID);
    }
    if(skillData.additionalBuffToSelf){
      this.users[userID].addBuff(skillData.additionalBuffToSelf, userID);
    }

    //doDamageToSelf
    if(skillData.doDamageToSelf){
      var fireDamage = skillData.fireDamage * skillData.damageToSelfRate/100;
      var frostDamage = skillData.frostDamage * skillData.damageToSelfRate/100;
      var arcaneDamage = skillData.arcaneDamage * skillData.damageToSelfRate/100;
      var damageToMP = 0;
      this.users[userID].takeDamage(userID, fireDamage, frostDamage, arcaneDamage, damageToMP, skillData.hitBuffList, skillData.index);
      if(skillData.buffToTarget){
        this.users[userID].addBuff(skillData.buffToTarget, userID);
      }
    }

    //healHP, MP
    var healHPAmount = (util.isNumeric(skillData.healHP) ? skillData.healHP : 0) + this.users[userID].maxHP * (util.isNumeric(skillData.healHPRate) ? skillData.healHPRate : 0) / 100;
    var healMPAmount = (util.isNumeric(skillData.healMP) ? skillData.healMP : 0) + this.users[userID].maxMP * (util.isNumeric(skillData.healMPRate) ? skillData.healMPRate : 0) / 100;
    if(healHPAmount > 0 || healMPAmount > 0){
      this.users[userID].healHPMP(healHPAmount, healMPAmount);
    }
    if(skillData.type !== gameConfig.SKILL_TYPE_SELF && skillData.type !== gameConfig.SKILL_TYPE_TELEPORT){
      var skillCollider = new SkillCollider(this.users[userID], skillData);
      if(skillData.additionalBuffToTarget){
        skillCollider.additionalBuffToTarget = skillData.additionalBuffToTarget;
      }
      this.skills.push(skillCollider);
    }
  }else{
    // console.log('cant find user data');
  }
};
GameManager.prototype.applyProjectile = function(userID, projectileDatas){
  if(userID in this.users && !this.users[userID].isDead){
    this.users[userID].applyCooldown(projectileDatas[0]);
    //check buff
    SUtil.checkUserBuff(this.users[userID], projectileDatas[0]);

    this.users[userID].consumeMP(projectileDatas[0].consumeMP);
    if(projectileDatas[0].buffToSelf){
      this.users[userID].addBuff(projectileDatas[0].buffToSelf, userID);
    }
    if(projectileDatas[0].additionalBuffToSelf){
      this.users[userID].addBuff(projectileDatas[0].additionalBuffToSelf, userID);
    }
    //doDamageToSelf
    if(projectileDatas[0].doDamageToSelf){
      var fireDamage = projectileDatas[0].fireDamage * projectileDatas[0].damageToSelfRate/100;
      var frostDamage = projectileDatas[0].frostDamage * projectileDatas[0].damageToSelfRate/100;
      var arcaneDamage = projectileDatas[0].arcaneDamage * projectileDatas[0].damageToSelfRate/100;
      var damageToMP = 0;
      this.users[userID].takeDamage(userID, fireDamage, frostDamage, arcaneDamage, damageToMP, projectileDatas[0].hitBuffList, projectileDatas[0].index);
      if(projectileDatas[0].buffToTarget){
        this.users[userID].addBuff(projectileDatas[0].buffToTarget, userID);
      }
    }
    //healHP, MP
    var healHPAmount = (util.isNumeric(projectileDatas[0].healHP) ? projectileDatas[0].healHP : 0) + this.users[userID].maxHP * (util.isNumeric(projectileDatas[0].healHPRate) ? projectileDatas[0].healHPRate : 0) / 100;
    var healMPAmount = (util.isNumeric(projectileDatas[0].healMP) ? projectileDatas[0].healMP : 0) + this.users[userID].maxMP * (util.isNumeric(projectileDatas[0].healMPRate) ? projectileDatas[0].healMPRate : 0) / 100;
    if(healHPAmount > 0 || healMPAmount > 0){
      this.users[userID].healHPMP(healHPAmount, healMPAmount);
    }

    for(var i=0; i<projectileDatas.length; i++){
      var projectileCollider = new ProjectileCollider(this.users[userID], projectileDatas[i]);
      if(i !== 0){
        projectileCollider.fireDamage = projectileDatas[0].fireDamage;
        projectileCollider.frostDamage = projectileDatas[0].frostDamage;
        projectileCollider.arcaneDamage = projectileDatas[0].arcaneDamage;
        projectileCollider.damageToMP = projectileDatas[0].damageToMP;
      }
      if(projectileDatas[0].additionalBuffToTarget){
        projectileCollider.additionalBuffToTarget = projectileDatas[0].additionalBuffToTarget;
      }

      this.projectiles.push(projectileCollider);
    }
  }else{
    // console.log('cant find user data');
  }
};
GameManager.prototype.checkCheat = function(userData){
  if(userData.objectID in this.users && !this.users[userData.objectID].isDead &&
     !this.users[userData.objectID].isTeleported && !this.users[userData.objectID].isUsePortal &&
     !this.users[userData.objectID].conditions[gameConfig.USER_CONDITION_FREEZE] &&
     !this.users[userData.objectID].conditions[gameConfig.USER_CONDITION_CHILL]){
    var lastPositionIndex = this.users[userData.objectID].beforePositions.length;
    if(lastPositionIndex > 0){
      var lastPosition = this.users[userData.objectID].beforePositions[lastPositionIndex - 1];
      var timeSpan = (userData.time - lastPosition.time)/1000;
      var distX = Math.abs(userData.position.x - lastPosition.x);
      var distY = Math.abs(userData.position.y - lastPosition.y);
      var dist = Math.sqrt(Math.pow(distX,2) + Math.pow(distY,2));
      if(dist > this.users[userData.objectID].maxSpeed * timeSpan * serverConfig.TOLERANCE_LIMIT_RATE){
        return { x : Math.floor(lastPosition.x), y : Math.floor(lastPosition.y) };
      }
    }
    return false;
  }else{
    return false;
  }
};
GameManager.prototype.getLastPosition = function(userData) {
  if (userData.objectID in this.users && !this.users[userData.objectID].isDead) {
    var lastPositionIndex = this.users[userData.objectID].beforePositions.length;
    if (lastPositionIndex > 0) {
      var lastPosition = this.users[userData.objectID].beforePositions[lastPositionIndex - 1];
      return { x : Math.floor(lastPosition.x), y : Math.floor(lastPosition.y) };
    }
  }
  return false;
}
GameManager.prototype.userUseTeleport = function(userID){
  if(userID in this.users){
    this.users[userID].useTeleport();
  }
};
GameManager.prototype.updateUserData = function(userData){
  try {
    if(userData.objectID in this.users && !this.users[userData.objectID].isDead){
      if(util.isNumeric(userData.position.x) && util.isNumeric(userData.position.y)){
        if(userData.time){
          this.users[userData.objectID].beforePositions.push({
            x : this.users[userData.objectID].position.x,
            y : this.users[userData.objectID].position.y,
            time : this.users[userData.objectID].time
          });
          if(this.users[userData.objectID].beforePositions.length > 5){
            while(this.users[userData.objectID].beforePositions.length > 5){
              this.users[userData.objectID].beforePositions.splice(0, 1);
            }
          }
          // for(var i=0; i<this.users[userData.objectID].beforePositions.length; i++){
          //   // console.log(Date.now() - this.users[userData.objectID].beforePositions[i].time);
          //   if(Date.now() - this.users[userData.objectID].beforePositions[i].time > 300){
          //     this.users[userData.objectID].before300msPos.x = this.users[userData.objectID].beforePositions[i].x;
          //     this.users[userData.objectID].before300msPos.y = this.users[userData.objectID].beforePositions[i].y;
          //   }else if(Date.now() - this.users[userData.objectID].beforePositions[i].time > 150){
          //     this.users[userData.objectID].before150msPos.x = this.users[userData.objectID].beforePositions[i].x;
          //     this.users[userData.objectID].before150msPos.y = this.users[userData.objectID].beforePositions[i].y;
          //   }
          // }
          this.users[userData.objectID].time = userData.time;
        }
        this.users[userData.objectID].currentState = userData.currentState;
        this.users[userData.objectID].position = userData.position;
        this.users[userData.objectID].direction = userData.direction;

        this.users[userData.objectID].setCenter();
        if(userData.targetPosition){
          this.users[userData.objectID].targetPosition = userData.targetPosition;
        }
      }
    }else{
      if(!userData.objectID in this.users){
        console.log('cant find user data');
      }
    }
  } catch (e) {
    throw e;
  }
};
// GameManager.prototype.addUserExp = function(userID, exp){
//   if(userID in this.users){
//     this.users[userID].getExp(exp);
//   }
// };
// GameManager.prototype.addUserSkillTick = function(userID){
//   if(userID in this.users){
//     this.users[userID].addSkillTick();
//     if(this.users[userID].skillTick > serverConfig.TICK_COUNT_FOR_EXP){
//       this.users[userID].skillTick = 0;
//       return true;
//     }else{
//       return false;
//     }
//   }
//   return false;
// }
GameManager.prototype.getLevel = function(userID, charType){
  if(userID in this.users){
    return this.users[userID].getLevel(charType);
  }
};
GameManager.prototype.setUserStat = function(userID, userStat, userBase, exp){
  if(userID in this.users){
    this.users[userID].setStat(userStat, userBase, exp);
  }
};
// GameManager.prototype.setUserSkill = function(userID, charType, baseSkill, passiveSkill){
//   if(userID in this.users){
//     this.users[userID].setSkill(charType, baseSkill, passiveSkill);
//   }
// };
GameManager.prototype.setUserPosition = function(userID){
  if(userID in this.users){
    // var randomPos = SUtil.generateRandomPos(staticTree, 400, 400, gameConfig.CANVAS_MAX_SIZE.width - 400, gameConfig.CANVAS_MAX_SIZE.height - 400,
    //                                         this.users[userID].size.width/2, this.users[userID].size.width/2, userID);
    // if(randomPos){
    //   this.users[userID].setPosition(randomPos.x, randomPos.y);
    // }else{
    //   this.users[userID].setPosition(100, 100);
    // }
    // var randVal = Math.floor(Math.random() * 2);
    // var pos = {x : 0, y : 0};
    // if(randVal === 0){
    var pos = {
      x: serverConfig.USER_START_POSITION.x,
      y: serverConfig.USER_START_POSITION.y
    };
    // }else{
    //   pos.x = serverConfig.USER_START_POSITION_2.x;
    //   pos.y = serverConfig.USER_START_POSITION_2.y;
    // }
    var newPos = SUtil.generateInsidePos(pos, 50, staticTree, userID, 32);
    if(newPos){
      this.users[userID].setPosition(newPos.x, newPos.y);
    }else{
      this.users[userID].setPosition(pos.x, pos.y);
    }
  }
};
GameManager.prototype.startUserUpdate = function(userID){
  if(userID in this.users){
    this.users[userID].startUpdate();
  }
};
GameManager.prototype.setScore = function(userID){
  if(userID in this.users){
    this.users[userID].calcScore();
  }
};
GameManager.prototype.getUserName = function(userID){
  if(userID in this.users){
    return this.users[userID].name;
  }
};
GameManager.prototype.setUserName = function(userID, userName){
  if(userID in this.users){
    this.users[userID].setName(userName);
  }
};
GameManager.prototype.getBaseSkill = function(userID, charType){
  if(userID in this.users){
    return this.users[userID].getBaseSkill(charType);
  }
};
GameManager.prototype.getInherentPassiveSkill = function(userID, charType){
  if(userID in this.users){
    return this.users[userID].getInherentPassiveSkill(charType);
  }
};
GameManager.prototype.processUserDataSetting = function(user){
  return [
    user.objectID,
    user.type,
    user.name,

    user.currentState,
    user.position,
    user.targetPosition,
    Math.floor(user.maxSpeed),
    Math.floor(user.direction),
    Math.floor(user.rotateSpeed),

    user.level,
    user.exp,

    user.maxHP,
    user.maxMP,
    Math.floor(user.HP),
    Math.floor(user.MP),
    Math.floor(user.castSpeed),

    user.conditions
  ];
  // {
  //   oID : user.objectID,
  //   tp : user.type,
  //   nm : user.name,
  //
  //   cs : user.currentState,
  //   pos : user.position,
  //   tpos : user.targetPosition,
  //   msp : Math.floor(user.maxSpeed),
  //   dir : Math.floor(user.direction),
  //   rsp : Math.floor(user.rotateSpeed),
  //   // size : user.size,
  //
  //   lv : user.level,
  //   ep : user.exp,
  //
  //   mHP : user.maxHP,
  //   mMP : user.maxMP,
  //   HP : Math.floor(user.HP),
  //   MP : Math.floor(user.MP),
  //   csp : Math.floor(user.castSpeed),
  //
  //   cdt : user.conditions
  // };
};
// data setting for send to client
GameManager.prototype.processUserDataSettings = function(){
  var userData = [];

  for(var index in this.users){
    // var buffIndexList = [];
    // for(var i=0; i<this.users[index].buffList.length; i++){
    //   buffIndexList.push({index : this.users[index].buffList[i].index, startTime : this.users[index].buffList[i].startTime});
    // };
    if(!this.users[index].isDead){
      userData.push(this.processUserDataSetting(this.users[index]));
      // userData.push({
      //   oID : index,
      //   tp : this.users[index].type,
      //   nm : this.users[index].name,
      //
      //   // killScore : this.users[index].killScore,
      //   // totalScore : this.users[index].score,
      //
      //   cs : this.users[index].currentState,
      //   pos : this.users[index].position,
      //   tpos : this.users[index].targetPosition,
      //
      //   msp : this.users[index].maxSpeed,
      //   dir : this.users[index].direction,
      //   rsp :  this.users[index].rotateSpeed,
      //   // size : this.users[index].size,
      //
      //   lv : this.users[index].level,
      //   ep : this.users[index].exp,
      //
      //   mHP : this.users[index].maxHP,
      //   mMP : this.users[index].maxMP,
      //   HP : this.users[index].HP,
      //   MP : this.users[index].MP,
      //   csp : this.users[index].castSpeed,
      //
      //   cdt : this.users[index].conditions,
      //   // buffList : buffIndexList
      // });
    }
  };

  return userData;
};
// GameManager.prototype.processUserAllTypeLevels = function(userID){
//   if(userID in this.users){
//     return {
//       pLv : this.users[userID].pyroLevel,
//       fLv : this.users[userID].frosterLevel,
//       mLv :this.users[userID].mysterLevel
//     };
//   }
// };
// GameManager.prototype.processUserAllTypeSkillLevels = function(userID){
//   if(userID in this.users){
//     return {
//       pBS : this.users[userID].pyroBaseSkill,
//       pIPS : this.users[userID].pyroInherentPassiveSkill,
//       fBS : this.users[userID].frosterBaseSkill,
//       fIPS : this.users[userID].frosterInherentPassiveSkill,
//       mBS : this.users[userID].mysterBaseSkill,
//       mIPS : this.users[userID].mysterInherentPassiveSkill
//     };
//   }
// };
GameManager.prototype.processChangedUserStat = function(user){
  try {
    return [
      user.objectID,
      user.type,
      user.level,
      user.exp,
      user.maxHP,
      user.maxMP,
      Math.floor(user.HP),
      Math.floor(user.MP),
      Math.floor(user.castSpeed),
      Math.floor(user.maxSpeed),
      Math.floor(user.rotateSpeed),
      user.conditions
    ];
    // return {
    //   oID : user.objectID,
    //   tp : user.type,
    //   lv : user.level,
    //   ep : user.exp,
    //   mHP : user.maxHP,
    //   mMP : user.maxMP,
    //   HP : Math.floor(user.HP),
    //   MP : Math.floor(user.MP),
    //   csp : Math.floor(user.castSpeed),
    //   msp : Math.floor(user.maxSpeed),
    //   rsp : Math.floor(user.rotateSpeed),
    //
    //   cdt : user.conditions
    // };
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.processUserResource = function(user){
  try {
    return{
      // oID : user.objectID,
      g : user.gold,
      j : user.jewel
    };
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.processScoreDatas = function(exceptID){
  var datas = [];
  for(var i in this.users){
    if(!this.users[i].isDead){
      if(exceptID){
        //if user disconnect
        if(exceptID !== this.users[i].objectID){
          datas.push([
            this.users[i].objectID, this.users[i].name, this.users[i].level, this.users[i].killCount, this.users[i].score, this.users[i].totalKillCount
          ]);
            // {id : this.users[i].objectID, nm : this.users[i].name, lv: this.users[i].level, kS : this.users[i].killCount, tS : this.users[i].score, tK : this.users[i].totalKillCount});
        }
      }else{
        datas.push([
          this.users[i].objectID, this.users[i].name, this.users[i].level, this.users[i].killCount, this.users[i].score, this.users[i].totalKillCount
        ]);
          // {id : this.users[i].objectID, nm : this.users[i].name, lv: this.users[i].level, kS : this.users[i].killCount, tS : this.users[i].score, tK : this.users[i].totalKillCount});
      }
    }
  }
  return datas;
};
GameManager.prototype.processUserPrivateDataSetting = function(user){
  try {
    return [
      user.damageRate,
      user.fireDamageRate,
      user.frostDamageRate,
      user.arcaneDamageRate,
      user.resistAll,
      user.resistFire,
      user.resistFrost,
      user.resistArcane,
      user.level,
      user.statPower,
      user.statMagic,
      user.statSpeed,
      user.cooldownReduceRate
    ];
    // return {
    //   dR : user.damageRate,
    //   fiDR : user.fireDamageRate,
    //   frDR : user.frostDamageRate,
    //   acDR : user.arcaneDamageRate,
    //   rA : user.resistAll,
    //   rFi : user.resistFire,
    //   rFr : user.resistFrost,
    //   rAc : user.resistArcane,
    //
    //   lv : user.level,
    //
    //   sP : user.statPower,
    //   sM : user.statMagic,
    //   sS : user.statSpeed,
    //   cRR : user.cooldownReduceRate
    // };
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.processBuffDataSettings = function(){
  var userBuffDatas = [];
  for(var index in this.users){
    if(!this.users[index].isDead){
      userBuffDatas.push(this.processBuffDataSetting(this.users[index]));
      // var buffIndexList = [];
      // var passiveIndexList = [];
      // var auraIndexList = [];
      // for(var i=0; i<this.users[index].buffList.length; i++){
      //   buffIndexList.push({index : this.users[index].buffList[i].index, startTime : this.users[index].buffList[i].startTime});
      // }
      // for(var i=0; i<this.users[index].passiveList.length; i++){
      //   passiveIndexList.push(this.users[index].passiveList[i].index);
      // }
      // for(var i=0; i<this.users[index].auraList.length; i++){
      //   auraIndexList.push(this.users[index].auraList[i].index);
      // }
      // userBuffDatas.push({
      //   objectID : index,
      //   inherentPassive : this.users[index].inherentPassiveSkill,
      //   buffList : buffIndexList,
      //   passiveList : passiveIndexList,
      //   auraList : auraIndexList
      // });
    }
  }
  return userBuffDatas;
};
GameManager.prototype.processBuffDataSetting = function(user){
  try {
    var buffIndexList = [];
    var passiveIndexList = [];
    var auraIndexList = [];
    for(var i=0; i<user.buffList.length; i++){
      buffIndexList.push({id : user.buffList[i].index, st : user.buffList[i].startTime});
    }
    for(var i=0; i<user.passiveList.length; i++){
      passiveIndexList.push(user.passiveList[i].index);
    }
    for(var i=0; i<user.auraList.length; i++){
      auraIndexList.push(user.auraList[i].index);
    }
    return [
      user.objectID,
      user.inherentPassiveSkill,
      buffIndexList,
      passiveIndexList,
      auraIndexList
    ];
    // return{
    //   oID : user.objectID,
    //   iP : user.inherentPassiveSkill,
    //   bL : buffIndexList,
    //   pL : passiveIndexList,
    //   aL : auraIndexList
    // }
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.processCreatedMobDatas = function(mobs){
  var returnVal = [];
  for(var i=0; i<mobs.length; i++){
    returnVal.push(this.processMobData(mobs[i]));
  }
  return returnVal;
};
GameManager.prototype.processMobDatas = function(){
  var returnVal = [];
  for(var index in this.monsters){
    returnVal.push(this.processMobData(this.monsters[index]));
  }
  // for(var i=0; i<this.monsters.length; i++){
  //   returnVal.push(this.processMobData(this.monsters[i]));
  // }
  return returnVal;
};
GameManager.prototype.processMobData = function(mob){
  return [
    mob.index,
    mob.objectID,
    mob.currentState,
    { x : Math.floor(mob.position.x), y : Math.floor(mob.position.y) },
    { x : Math.floor(mob.targetPosition.x), y : Math.floor(mob.targetPosition.y) },
    Math.floor(mob.maxSpeed),
    Math.floor(mob.direction),
    Math.floor(mob.rotateSpeed),
    Math.floor(mob.attackTime),
    mob.maxHP,
    Math.floor(mob.HP),
    mob.conditions,
    mob.buffList
  ];
  // return {
  //   id : mob.index,
  //
  //   oID : mob.objectID,
  //   cs : mob.currentState,
  //   pos : { x : Math.floor(mob.position.x), y : Math.floor(mob.position.y) },
  //   tpos : { x : Math.floor(mob.targetPosition.x), y : Math.floor(mob.targetPosition.y) },
  //   msp : Math.floor(mob.maxSpeed),
  //   dir : Math.floor(mob.direction),
  //   rsp : Math.floor(mob.rotateSpeed),
  //   // size : mob.size,
  //   at : Math.floor(mob.attackTime),
  //
  //   mHP : mob.maxHP,
  //   HP : Math.floor(mob.HP),
  //   cdt : mob.conditions,
  //   bL : mob.buffList
  // };
};
GameManager.prototype.processMobStatData = function(mob){
  return [
    mob.objectID,
    { x : Math.floor(mob.position.x), y : Math.floor(mob.position.y) },
    Math.floor(mob.direction),
    Math.floor(mob.HP)
  ];
  // return {
  //   oID : mob.objectID,
  //   pos : { x : Math.floor(mob.position.x), y : Math.floor(mob.position.y) },
  //   dir : Math.floor(mob.direction),
  //   HP : Math.floor(mob.HP)
  // }
};
GameManager.prototype.processMobBuffData = function(mob){
  var buffList = [];
  for(var i=0; i<mob.buffList.length; i++){
    buffList.push(mob.buffList[i].index);
  }
  return [
    mob.objectID,
    buffList
  ];
  // return {
  //   oID : mob.objectID,
  //   bL : buffList
  // };
};
GameManager.prototype.addSkillData = function(userData){
  if(userData[0] in this.users){
    userData.push(
      this.users[userData[0]].baseSkill,
      this.users[userData[0]].possessSkills,
      this.users[userData[0]].inherentPassiveSkill);
    // userData.bS = this.users[userData.oID].baseSkill;
    // // userData.equipSkills = this.users[userData.objectID].equipSkills;
    // userData.pS = this.users[userData.oID].possessSkills;
    // userData.ipS= this.users[userData.oID].inherentPassiveSkill;
  }
};
GameManager.prototype.addPrivateData = function(userData){
  if(userData[0] in this.users){
    userData.push(
      this.users[userData[0]].damageRate,
      this.users[userData[0]].fireDamageRate,
      this.users[userData[0]].frostDamageRate,
      this.users[userData[0]].arcaneDamageRate,
      this.users[userData[0]].resistAll,
      this.users[userData[0]].resistFire,
      this.users[userData[0]].resistFrost,
      this.users[userData[0]].resistArcane,
      this.users[userData[0]].statPower,
      this.users[userData[0]].statMagic,
      this.users[userData[0]].statSpeed,
      this.users[userData[0]].cooldownReduceRate
    );
    // userData.dR = this.users[userData.oID].damageRate,
    // userData.fiDR = this.users[userData.oID].fireDamageRate,
    // userData.frDR = this.users[userData.oID].frostDamageRate,
    // userData.acDR = this.users[userData.oID].arcaneDamageRate,
    // userData.rA = this.users[userData.oID].resistAll,
    // userData.rFi = this.users[userData.oID].resistFire,
    // userData.rFr = this.users[userData.oID].resistFrost,
    // userData.rAc = this.users[userData.oID].resistArcane,
    //
    // userData.sP = this.users[userData.oID].statPower;
    // userData.sM = this.users[userData.oID].statMagic;
    // userData.sS = this.users[userData.oID].statSpeed;
    //
    // userData.cRR = this.users[userData.oID].cooldownReduceRate;
  }
};
// GameManager.prototype.addResourceData = function(userData) {
//   if (userData.oID in this.users) {
//     userData.g = this.users[userData.oID].gold;
//     userData.j = this.users[userData.oID].jewel;
//   }
// }
// GameManager.prototype.processSkillsDataSettings = function(){
//   var skillDatas = [];
//   for(var index in this.users){
//     if(this.users[index].currentState === gameConfig.OBJECT_STATE_CAST){
//       var skillData = {
//         userID : this.users[index].objectID,
//         index : this.users[index].currentSkill.index,
//         targetPosition : this.users[index].currentSkill.targetPosition,
//         direction : this.users[index].currentSkill.direction,
//         totalTime : this.users[index].currentSkill.totalTime - (Date.now() - this.users[index].currentSkill.startTime),
//         fireTime : this.users[index].currentSkill.fireTime - (Date.now() - this.users[index].currentSkill.startTime)
//       }
//     }
//   }
//   return skillDatas;
// };
// GameManager.prototype.processProjectilesDataSettings = function(){
//   var projectileDatas = [];
//   for(var i=0; i<this.projectiles; i++){
//     var projectile = {
//       index : this.projectiles[i].index,
//       objectID : this.projectiles[i].objectID,
//       position : this.projectiles[i].position,
//       speed : this.projectiles[i].speed,
//       radius : this.projectiles[i].radius,
//       lifeTime : this.projectiles[i].lifeTime - (Date.now() - this.projectiles[i].startTime),
//       explosionRadius : this.projectiles[i].explosionRadius,
//       explode : this.projectiles[i].colliderEle.isCollide,
//     }
//     projectileDatas.push(projectile);
//   }
//   return projectileDatas;
// };
GameManager.prototype.processOBJDataSetting = function(data){
  if(data.objectID.substr(0, 1) === gameConfig.PREFIX_OBJECT_GOLD){
    return [
      data.objectID,
      data.position,
      data.size.width/2
    ];
    // return {
    //   oID : data.objectID,
    //   pos : data.position,
    //   rad : data.size.width/2
    // };
  }else if(data.objectID.substr(0, 1) === gameConfig.PREFIX_OBJECT_JEWEL){
    return [
      data.objectID,
      data.position
    ];
    // return {
    //   oID : data.objectID,
    //   pos : data.position
    //   // radius : data.size.width/2
    // };
  }else if(data.objectID.substr(0, 1) === gameConfig.PREFIX_OBJECT_SKILL){
    return [
      data.objectID,
      data.position,
      data.skillProperty
    ];
    // return {
    //   oID : data.objectID,
    //   pos : data.position,
    //   // radius : data.size.width/2,
    //   pro : data.skillProperty
    // };
  }else if(data.objectID.substr(0, 1) === gameConfig.PREFIX_OBJECT_BOX){
    return [
      data.objectID,
      data.position
    ];
    // return {
    //   oID : data.objectID,
    //   pos : data.position
    //   // radius : data.size.width/2
    // }
  }else if(data.objectID.substr(0, 1) === gameConfig.PREFIX_OBJECT_BUFF){
    return [
      data.objectID,
      data.position,
      data.resourceIndex
    ];
    // return {
    //   oID : data.objectID,
    //   pos : data.position,
    //   // radius : data.size.width/2,
    //   rID : data.resourceIndex
    // }
  }
};
GameManager.prototype.processOBJDataSettings = function(){
  var objDatas = [];
  // for(var i=0; i<this.objExps.length; i++){
  //   var objExp = {
  //     objectID : this.objExps[i].objectID,
  //     position : this.objExps[i].position,
  //     radius : this.objExps[i].size.width/2
  //   }
  //   objDatas.push(objExp);
  // }
  for(var i=0; i<this.objGolds.length; i++){
    objDatas.push([
      this.objGolds[i].objectID,
      this.objGolds[i].position,
      this.objGolds[i].size.width/2
    ]);
    // objDatas.push({
    //   oID : this.objGolds[i].objectID,
    //   pos : this.objGolds[i].position,
    //   rad : this.objGolds[i].size.width/2
    // });
  }
  for(var i=0; i<this.objJewels.length; i++){
    objDatas.push([
      this.objJewels[i].objectID,
      this.objJewels[i].position
    ]);
    // objDatas.push({
    //   oID : this.objJewels[i].objectID,
    //   pos : this.objJewels[i].position
    //   // rad : this.objJewels[i].size.width/2
    // });
  }
  for(var i=0; i<this.objSkills.length; i++){
    objDatas.push([
      this.objSkills[i].objectID,
      this.objSkills[i].position,
      this.objSkills[i].skillProperty
    ]);
    // objDatas.push({
    //   oID : this.objSkills[i].objectID,
    //   pos : this.objSkills[i].position,
    //   // radius : this.objSkills[i].size.width/2,
    //   pro : this.objSkills[i].skillProperty
    // });
  }
  for(var i=0; i<this.objBoxs.length; i++){
    objDatas.push([
      this.objBoxs[i].objectID,
      this.objBoxs[i].position
    ]);
    // objDatas.push({
    //   oID : this.objBoxs[i].objectID,
    //   pos : this.objBoxs[i].position
    //   // radius : this.objBoxs[i].size.width/2
    // });
  }
  for(var i=0; i<this.objBuffs.length; i++){
    objDatas.push([
      this.objBuffs[i].objectID,
      this.objBuffs[i].position,
      this.objBuffs[i].resourceIndex
    ]);
    // objDatas.push({
    //   oID : this.objBuffs[i].objectID,
    //   pos : this.objBuffs[i].position,
    //   // radius : this.objBuffs[i].size.width/2,
    //   rID : this.objBuffs[i].resourceIndex
    // });
  }
  return objDatas;
};
GameManager.prototype.processChestDataSetting = function(data){
  return {
    oID : data.objectID,
    lID : data.locationID,
    gd : data.grade,

    mHP : data.maxHP,
    HP : Math.floor(data.HP)
  };
};
GameManager.prototype.processChestDataSettings = function(){
  var chestDatas = [];
  for(var i=0; i<this.chests.length; i++){
    chestDatas.push(this.processChestDataSetting(this.chests[i]));
    // chestDatas.push({
    //   objectID : this.chests[i].objectID,
    //   locationID : this.chests[i].locationID,
    //   grade : this.chests[i].grade,
    //
    //   maxHP : this.chests[i].maxHP,
    //   HP : this.chests[i].HP
    // });
  }
  return chestDatas;
};
GameManager.prototype.checkCreateChest = function(){
  if (Object.keys(this.users).length <= 10) {
    if (this.chests.length < 1) {
      return true;
    } else {
      return false;
    }
  } else if (this.chests.length < 2) {
    return true;
  }
  return false;
  // if(this.chests.length < 9){
  //   return true;
  // }
  // if(Object.keys(this.users).length <= 10){
  //   if(this.chests.length < 3){
  //     return true;
  //   }else{
  //     return false;
  //   }
  // }else if(Object.keys(this.users).length <= 20){
  //   if(this.chests.length < 4){
  //     return true;
  //   }else{
  //     return false;
  //   }
  // }else if(Object.keys(this.users).length <= 30){
  //   if(this.chests.length < 5){
  //     return true;
  //   }else{
  //     return false;
  //   }
  // }else{
  //   return false;
  // }
};
GameManager.prototype.upgradeSkill = function(user, skillIndex){
  try {
    if(user.objectID in this.users){
      user.upgradeSkill(skillIndex);
    }
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.exchangePassive = function(user, beforeBuffGID, afterBuffGID){
  try {
    if(user.objectID in this.users){
      user.exchangePassive(beforeBuffGID, afterBuffGID);
    }
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.equipPassives = function(userID, buffGroupIndexList){
  if(userID in this.users){
    this.users[userID].equipPassives(buffGroupIndexList);
  }
};
GameManager.prototype.equipPassive = function(user, buffGroupIndex){
  try {
    if(user.objectID in this.users){
      user.equipPassive(buffGroupIndex);
    }
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.unequipPassive = function(user, buffGroupIndex){
  try {
    if(user.objectID in this.users){
      user.unequipPassive(buffGroupIndex);
    }
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.checkSkillPossession = function(userID, skillIndex){
  if(userID in this.users){
    return this.users[userID].checkSkillPossession(skillIndex);
  }
};
GameManager.prototype.checkSkillCondition = function(userID, skillData){
  if(userID in this.users){
    if(Object.keys(skillData).length){
      if(!this.users[userID].conditions[gameConfig.USER_CONDITION_FREEZE] ||
         !this.users[userID].conditions[gameConfig.USER_CONDITION_SILENCE] ||
         !this.users[userID].conditions[gameConfig.USER_CONDITION_BLUR] ||
         this.users[userID].MP >= skillData.consumeMP){
           return true;
       }else{
         return false;
       }
    }else{
      return false;
    }
  }
};
GameManager.prototype.checkSkillCooldown = function(userID, skillData){
  if(userID in this.users){
    return this.users[userID].checkCooldown(skillData);
  }
};
// GameManager.prototype.cancelBlur = function(userID){
//   if(userID in this.users){
//     this.users[userID].cancelBlur();
//   }
// };
//cheat code
GameManager.prototype.killme = function(userID){
  if(userID in this.users){
    this.users[userID].death(userID);
  }
};
GameManager.prototype.giveExp = function(userID){
  if(userID in this.users){
    if(!this.users[userID].isDead){
      this.users[userID].addScore(500);
    }
  }
};
GameManager.prototype.giveResources = function(userID){
  if(userID in this.users){
    this.users[userID].getGold(10000);
    this.users[userID].getJewel(10);
  }
};
// GameManager.prototype.giveTwitterGold = function(userID, gold){
//   if(userID in this.users && !this.users[userID].isGetTwitterReward){
//     this.users[userID].isGetTwitterReward = true;
//     this.users[userID].getGold(gold);
//   }
// };
// GameManager.prototype.giveFacebookJewel = function(userID, jewel){
//   if(userID in this.users && !this.users[userID].isGetFacebookReward){
//     this.users[userID].isGetFacebookReward = true;
//     this.users[userID].getJewel(jewel);
//   }
// };
GameManager.prototype.giveAllSkill = function(userID, skills){
  if(userID in this.users){
    for(var i=0; i<skills.length; i++){
      this.users[userID].getSkill(skills[i]);
      // if(i === skills.length -1){
      //   var possessSkills = this.users[userID].getSkill(skills[i]);
      //   if(possessSkills){
      //     this.onNeedInformSkillData(this.users[userID].socketID, possessSkills);
      //   }
      // }else{
      //   this.users[userID].getSkill(skills[i]);
      // }
    }
  }
};
GameManager.prototype.updateUserTimeDiff = function(userID, timeDiff){
  if(userID in this.users){
    this.users[userID].setTimeDiff(timeDiff);
  }
};
GameManager.prototype.updateUserLatency = function(userID, latency){
  if(userID in this.users){
    this.users[userID].setLatency(latency);
  }
};
GameManager.prototype.getUserTimeDiff = function(userID){
  if(userID in this.users){
    return this.users[userID].timeDiff;
  }
};
GameManager.prototype.getUserLatency = function(userID){
  if(userID in this.users){
    return this.users[userID].latency;
  }
};
GameManager.prototype.getUserType = function(userID){
  if(userID in this.users){
    return this.users[userID].type;
  }
};
GameManager.prototype.calcKillFeedBackLevel = function(userID){
  if(userID in this.users){
    if(this.users[userID].killCount >= serverConfig.KILL_FEEDBACK_LEVEL_7_KILL_COUNT && this.users[userID].killScore >= serverConfig.KILL_FEEDBACK_LEVEL_7_KILL_SCORE){
      return gameConfig.KILL_FEEDBACK_LEVEL_7;
    }else if(this.users[userID].killCount >= serverConfig.KILL_FEEDBACK_LEVEL_6_KILL_COUNT && this.users[userID].killScore >= serverConfig.KILL_FEEDBACK_LEVEL_6_KILL_SCORE){
      return gameConfig.KILL_FEEDBACK_LEVEL_6;
    }else if(this.users[userID].killCount >= serverConfig.KILL_FEEDBACK_LEVEL_5_KILL_COUNT && this.users[userID].killScore >= serverConfig.KILL_FEEDBACK_LEVEL_5_KILL_SCORE){
      return gameConfig.KILL_FEEDBACK_LEVEL_5;
    }else if(this.users[userID].killCount >= serverConfig.KILL_FEEDBACK_LEVEL_4_KILL_COUNT && this.users[userID].killScore >= serverConfig.KILL_FEEDBACK_LEVEL_4_KILL_SCORE){
      return gameConfig.KILL_FEEDBACK_LEVEL_4;
    }else if(this.users[userID].killCount >= serverConfig.KILL_FEEDBACK_LEVEL_3_KILL_COUNT && this.users[userID].killScore >= serverConfig.KILL_FEEDBACK_LEVEL_3_KILL_SCORE){
      return gameConfig.KILL_FEEDBACK_LEVEL_3;
    }else if(this.users[userID].killCount >= serverConfig.KILL_FEEDBACK_LEVEL_2_KILL_COUNT && this.users[userID].killScore >= serverConfig.KILL_FEEDBACK_LEVEL_2_KILL_SCORE){
      return gameConfig.KILL_FEEDBACK_LEVEL_2;
    }else if(this.users[userID].killCount >= serverConfig.KILL_FEEDBACK_LEVEL_1_KILL_COUNT && this.users[userID].killScore >= serverConfig.KILL_FEEDBACK_LEVEL_1_KILL_SCORE){
      return gameConfig.KILL_FEEDBACK_LEVEL_1;
    }else{
      return gameConfig.KILL_FEEDBACK_LEVEL_0;
    }
  }
};
GameManager.prototype.moveUserToRandomPos = function(userID){
  if(userID in this.users){
    if(!this.users[userID].isEmitPortalPacket){
      this.users[userID].auraList = [];
      this.users[userID].doEmitPortalPacket();
      var randomPos = SUtil.generateRandomPos(staticTree, 400, 400, gameConfig.CANVAS_MAX_SIZE.width - 400, gameConfig.CANVAS_MAX_SIZE.height - 400,
        this.users[userID].size.width/2, this.users[userID].size.width/2, userID);
      this.onUserEnterPortal(userID, randomPos);
      this.users[userID].usePortal();
      this.users[userID].addBuff(serverConfig.ENV_PORTAL_BUFF_INDEX, userID);
    }
  }
};
GameManager.prototype.disableCheatCheck = function(userID){
  if(userID in this.users){
    this.users[userID].usePortal();
  }
};
// GameManager.prototype.setResource = function(userID, gold, jewel){
//   if(userID in this.users){
//     this.users[userID].setResource(gold, jewel);
//   }
// };
GameManager.prototype.initReconnectUser = function(user, baseSkill, passiveSkill, possessSkills){
  var randomID = SUtil.generateRandomUniqueID(this.users, gameConfig.PREFIX_USER);
  user.assignID(randomID);
  user.setSize(gameConfig.USER_BODY_SIZE, gameConfig.USER_BODY_SIZE);
  //set inherentPassiveSkill
  // user.setReconnectLevel(level, exp);
  user.setReconnectSkills(baseSkill, passiveSkill, possessSkills);

  user.initEntityEle();
  user.startUpdate();
};
GameManager.prototype.setReconnectUserScore = function(userID, killCount, totalKillCount){
  if(userID in this.users){
    this.users[userID].setReconnectScore(killCount, totalKillCount);
  }
};
// GameManager.prototype.setReconnectResource = function(userID, gold, jewel){
//   if(userID in this.users){
//     this.users[userID].setResource(gold, jewel);
//   }
// };
GameManager.prototype.setReconnectUserHPMP = function(userID, HP, MP){
  if(userID in this.users){
    this.users[userID].setReconnectHPMP(HP, MP);
  }
};
GameManager.prototype.setReconnectUserPosition = function(userID, position){
  if(userID in this.users){
    if(position && util.isNumeric(position.x) && util.isNumeric(position.y)){
      this.users[userID].setPosition(position.x, position.y);
    }else{
      this.setUserPosition(userID);
    }
  }
};
function longTimeIntervalHandler(){
  var additionalGoldCount = (serverConfig.OBJ_GOLD_COUNT + serverConfig.ADDITIONAL_GOLD_PER_USER * Object.keys(this.users).length) - this.objGolds.length;
  var additionalBoxCount = (serverConfig.OBJ_BOX_COUNT + Math.floor(serverConfig.ADDITIONAL_BOX_PER_USER * Object.keys(this.users).length)) - this.objBoxs.length;
  var additionalJewelCount = (serverConfig.OBJ_JEWEL_COUNT + Math.floor(serverConfig.ADDITIONAL_JEWEL_PER_USER * Object.keys(this.users).length)) - this.objJewels.length;
  var additionalBuffCount = (serverConfig.OBJ_BUFF_COUNT + Math.floor(serverConfig.AdDITIONAL_BUFF_PER_USER * Object.keys(this.users).length)) - this.objBuffs.length;

  if(additionalGoldCount > 0){
    this.createGoldsToRandomPosition(additionalGoldCount);
  }
  if(additionalBoxCount > 0){
    this.createBoxsToRandomPosition(additionalBoxCount);
  }
  if(additionalJewelCount > 0){
    this.createJewelsToRandomPosition(additionalJewelCount);
  }
  if(additionalBuffCount > 0){
    this.createBuffToRandomPosition(additionalBuffCount);
  }

  for(var i=this.objSkills.length - 1; i>= 0; i--){
    if(serverConfig.OBJS_LIFE_TIME <= Date.now() - this.objSkills[i].startTime){
      this.onNeedInformDeleteObj(this.objSkills[i].objectID);
      removeOBJs.push(this.objSkills[i].collectionEle);
      this.objSkills.splice(i, 1);
    }
  }
  for(var i=this.objGolds.length - 1; i>= 0; i--){
    if(serverConfig.OBJS_LIFE_TIME <= Date.now() - this.objGolds[i].startTime){
      this.onNeedInformDeleteObj(this.objGolds[i].objectID);
      removeOBJs.push(this.objGolds[i].collectionEle);
      this.objGolds.splice(i, 1);
    }
  }
  for(var i=this.objJewels.length - 1; i>= 0; i--){
    if(serverConfig.OBJS_LIFE_TIME <= Date.now() - this.objJewels[i].startTime){
      this.onNeedInformDeleteObj(this.objJewels[i].objectID);
      removeOBJs.push(this.objJewels[i].collectionEle);
      this.objJewels.splice(i, 1);
    }
  }
  for(var i=this.objBoxs.length - 1; i>=0; i--){
    if(serverConfig.OBJS_LIFE_TIME <= Date.now() - this.objBoxs[i].startTime){
      this.onNeedInformDeleteObj(this.objBoxs[i].objectID);
      removeOBJs.push(this.objBoxs[i].collectionEle);
      this.objBoxs.splice(i, 1);
    }
  }
  for(var i=this.objBuffs.length - 1; i>=0; i--){
    if(serverConfig.OBJS_LIFE_TIME <= Date.now() - this.objBuffs[i].startTime){
      this.onNeedInformDeleteObj(this.objBuffs[i].objectID);
      removeOBJs.push(this.objBuffs[i].collectionEle);
      this.objBuffs.splice(i, 1);
    }
  }
  // if(this.checkCreateChest()){
  setChestIndexAndDoCreateChest.call(this);
    // setTimeout(setChestIndexAndDoCreateChest.bind(this), serverConfig.CHEST_CHAIN_CREATE_TIME);
  // }
  var weakSurroundMobCount = 0, weakCenterMobCount = 0; //, weakChestMobCount = 0;
  var normalSurroundMobCount = 0, normalCenterMobCount = 0; //, normalChestMobCount = 0;
  var /* strongSurroundMobCount = 0, strongCenterMobCount = 0, */ strongChestMobCount = 0;
  for(var index in this.monsters){
    switch (this.monsters[index].mobGenType) {
      case serverConfig.MOB_GEN_TYPE_WEAK_SURROUND:
        weakSurroundMobCount++;
        break;
      case serverConfig.MOB_GEN_TYPE_WEAK_CENTER:
        weakCenterMobCount++;
        break;
      // case serverConfig.MOB_GEN_TYPE_WEAK_CHEST:
        // weakChestMobCount++;
        // break;
      case serverConfig.MOB_GEN_TYPE_NORMAL_SURROUND:
        normalSurroundMobCount++;
        break;
      case serverConfig.MOB_GEN_TYPE_NORMAL_CENTER:
        normalCenterMobCount++;
        break;
      // case serverConfig.MOB_GEN_TYPE_NORMAL_CHEST:
      //   normalChestMobCount++;
      //   break;
      // case serverConfig.MOB_GEN_TYPE_STRONG_SURROUND:
      //   strongSurroundMobCount++;
      //   break;
      // case serverConfig.MOB_GEN_TYPE_STRONG_CENTER:
      //   strongCenterMobCount++;
      //   break;
      case serverConfig.MOB_GEN_TYPE_STRONG_CHEST:
        strongChestMobCount++;
        break;
    }
  }
  var additionalWeakSurroundMobCount = (serverConfig.MOB_WEAK_SURROUND_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_WEAK_SURROUND_PER_USER) - weakSurroundMobCount);
  var additionalWeakCenterMobCount = (serverConfig.MOB_WEAK_CENTER_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_WEAK_CENTER_PER_USER) - weakCenterMobCount);
  // var additionalWeakChestMobCount = (serverConfig.MOB_WEAK_CHEST_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_WEAK_CHEST_PER_USER) - weakChestMobCount);
  var additionalNormalSurroundMobCount = (serverConfig.MOB_NORMAL_SURROUND_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_NORMAL_SURROUND_PER_USER) - normalSurroundMobCount);
  var additionalNormalCenterMobCount = (serverConfig.MOB_NORMAL_CENTER_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_NORMAL_CENTER_PER_USER) - normalCenterMobCount);
  // var additionalNormalChestMobCount = (serverConfig.MOB_NORMAL_CHEST_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_NORMAL_CHEST_PER_USER) - normalChestMobCount);
  // var additionalStrongSurroundMobCount = (serverConfig.MOB_STRONG_SURROUND_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_STRONG_SURROUND_PER_USER) - strongSurroundMobCount);
  // var additionalStrongCenterMobCount = (serverConfig.MOB_STRONG_CENTER_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_STRONG_CENTER_PER_USER) - strongCenterMobCount);
  var additionalStrongChestMobCount = (serverConfig.MOB_STRONG_CHEST_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_STRONG_CHEST_PER_USER) - strongChestMobCount);

  if(additionalWeakSurroundMobCount > 0){
    this.createMobs(additionalWeakSurroundMobCount, serverConfig.MOB_GEN_TYPE_WEAK_SURROUND);
  }
  if(additionalWeakCenterMobCount > 0){
    this.createMobs(additionalWeakCenterMobCount, serverConfig.MOB_GEN_TYPE_WEAK_CENTER);
  }
  // if(additionalWeakChestMobCount > 0){
  //   this.createMobs(additionalWeakChestMobCount, serverConfig.MOB_GEN_TYPE_WEAK_CHEST);
  // }
  if(additionalNormalSurroundMobCount > 0){
    this.createMobs(additionalNormalSurroundMobCount, serverConfig.MOB_GEN_TYPE_NORMAL_SURROUND);
  }
  if(additionalNormalCenterMobCount > 0){
    this.createMobs(additionalNormalCenterMobCount, serverConfig.MOB_GEN_TYPE_NORMAL_CENTER);
  }
  // if(additionalNormalChestMobCount > 0){
  //   this.createMobs(additionalNormalChestMobCount, serverConfig.MOB_GEN_TYPE_NORMAL_CHEST);
  // }
  // if(additionalStrongSurroundMobCount > 0){
  //   this.createMobs(additionalStrongSurroundMobCount, serverConfig.MOB_GEN_TYPE_STRONG_SURROUND);
  // }
  // if(additionalStrongCenterMobCount > 0){
  //   this.createMobs(additionalStrongCenterMobCount, serverConfig.MOB_GEN_TYPE_STRONG_CENTER);
  // }
  if(additionalStrongChestMobCount > 0){
    this.createMobs(additionalStrongChestMobCount, serverConfig.MOB_GEN_TYPE_STRONG_CHEST);
  }

  // var smallMobCount = 0;
  // var smallCenterMobCount = 0;
  // var mediumMobcount = 0;
  // for(var index in this.monsters){
  //   if(this.monsters[index].mobGenType === serverConfig.MOB_GEN_TYPE_SMALL){
  //     smallMobCount ++;
  //   }else if(this.monsters[index].mobGenType === serverConfig.MOB_GEN_TYPE_SMALL_CENTER){
  //     smallCenterMobCount ++;
  //   }else if(this.monsters[index].mobGenType === serverConfig.MOB_GEN_TYPE_MEDIUM){
  //     mediumMobcount ++;
  //   }
  // }
  // var additionalSmallMobCount = (serverConfig.MOB_SMALL_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_SMALL_PER_USER) - smallMobCount);
  // if(additionalSmallMobCount > 0){
  //   this.createMobs(additionalSmallMobCount, serverConfig.MOB_GEN_TYPE_SMALL);
  // }
  // var additionalCenterSmallMobCount = (serverConfig.MOB_SMALL_CENTER_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_SMALL_CENTER_PER_USER) - smallCenterMobCount);
  // if(additionalCenterSmallMobCount > 0){
  //   this.createMobs(additionalCenterSmallMobCount, serverConfig.MOB_GEN_TYPE_SMALL_CENTER);
  // }
  // var additionalMediumMobcount = (serverConfig.MOB_MEDIUM_COUNT + Math.floor(Object.keys(this.users).length * serverConfig.ADDITIONAL_MOB_MEDIUM_PER_USER) - mediumMobcount);
  // if( additionalMediumMobcount > 0){
  //   this.createMobs(additionalMediumMobcount, serverConfig.MOB_GEN_TYPE_MEDIUM);
  // }
};
var setChestIndexAndDoCreateChest = function(){
  if(this.checkCreateChest()){
    var isCreate = false;
    var repeatCount = 0;
    while(!isCreate){
      repeatCount++;
      var index = Math.floor(Math.random() * 2) + 1;
      var isExist = false;
      for(var i=0; i<this.chests.length; i++){
        if(this.chests[i].locationID === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND + index){
          isExist = true;
          break;
        }
      }
      if(!isExist){
        this.createChest(gameConfig.PREFIX_OBSTACLE_CHEST_GROUND + index);
        isCreate = true;
      }
      if(repeatCount >= 20){
        isCreate = true;
      }
    }
    setTimeout(setChestIndexAndDoCreateChest.bind(this), serverConfig.CHEST_CHAIN_CREATE_TIME);
  }
}
function updateIntervalHandler(){
  //check collision user with skill
  //colliderEle : skill, collisionObj : user, chest
  for(var i=0; i<colliderEles.length; i++){
    //tempCollider == skill and projectile
    var tempCollider = colliderEles[i];
    collisionObjs = util.checkCircleCollision(entityTree, tempCollider.x, tempCollider.y, tempCollider.width/2, tempCollider.id);
    if(collisionObjs.length > 0){
      for(var j = 0; j<collisionObjs.length; j++){
        if(tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE || tempCollider.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
          if(!tempCollider.isCollide){
            tempCollider.isCollide = true;
            if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_USER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_CHEST){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_MONSTER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_MONSTER));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
          }
        }else if(tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION){
          if(!tempCollider.isCollide){
            tempCollider.isCollide = true;
            tempCollider.collisionPosition = collisionObjs.collisionPosition;
          }else if(tempCollider.isCollide){
            if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_USER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_CHEST){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_MONSTER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_MONSTER));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
          }
        }else if((tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION)){
          if(!tempCollider.isCollide){
            if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_USER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_CHEST){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_MONSTER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_MONSTER));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
            if(collisionObjs.length - 1 === j){
              tempCollider.isCollide = true;
            }
          }
        }else{
          if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_USER){
            affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
          }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_CHEST){
            affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
          }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_MONSTER){
            affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_MONSTER));
          }else{
            console.log('check id' + collisionObjs[j].id);
          }
        }
      }
    }
  }
  //check collision user with object(exp, skill, etc)
  //userEle : user, collisionObj : objExp, objSkill
  // var removeOBJs = [];
  var isCheckAura = false;
  if(Date.now() - auraCheckTimer > 500){
    isCheckAura = true;
    auraCheckTimer = Date.now();
  }
  for(var i=0; i<userEles.length; i++){
    var tempUser = userEles[i];
    //collisionObj : exp or skill object
    var collisionObjs = util.checkCircleCollision(collectionTree, tempUser.x, tempUser.y, tempUser.width/2, tempUser.id);
    for(var j=0; j<collisionObjs.length;j++){
      // if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBJECT_EXP){
      //   //case objExp
      //   affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_EXP));
      //   // affectedEles.push({type : 'getExpObj',user : tempUser.id, colObj : collisionObjs[j].id, addExp : collisionObjs[j].exp});
      // }else
      if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBJECT_SKILL){
        //case objSkill
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_SKILL));
        // affectedEles.push({type : 'getSkillObj',user : tempUser.id, colObj : collisionObjs[j].id, skillIndex : collisionObjs[j].skillIndex});
      }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBJECT_GOLD){
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_GOLD));
      }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBJECT_JEWEL){
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_JEWEL));
      }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBJECT_BOX){
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_BOX));
      }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBJECT_BUFF){
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_BUFF));
      }else{
        console.log('check id' + collisionObjs[j].id);
      }
      // removeOBJs.push(collisionObjs[j]);
    }
    //check user with env
    //clear auraList of user

    if(isCheckAura){
      // auraCheckTimer = Date.now();
      if(tempUser.id in this.users){
        var hadImmortalAura = false;
        for(var j=0; j<this.users[tempUser.id].auraList.length; j++){
          if(this.users[tempUser.id].auraList[j].index === serverConfig.ENV_IMMORTAL_BUFF_INDEX){
            hadImmortalAura = true;
            break;
          }
        }
        var isInImmortalZone = false;
        collisionObjs = util.checkCircleCollision(staticTree, tempUser.x, tempUser.y, tempUser.width/2, tempUser.id);
        if(collisionObjs.length > 0){
          for(var j=0; j<collisionObjs.length; j++){
            if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_ENVIRONMENT_IMMORTAL_GROUND){
              isInImmortalZone = true;
              if(!hadImmortalAura){
                affectedEles.push(SUtil.setAffectedEleColUserWithEnvironment(tempUser.id, gameConfig.PREFIX_ENVIRONMENT_IMMORTAL_GROUND, serverConfig.COLLISION_USER_WITH_ENVIRONMENT_IMMORTAL));
              }
            }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_ENVIRONMENT_PORTAL){
              affectedEles.push(SUtil.setAffectedEleColUserWithEnvironment(tempUser.id, gameConfig.PREFIX_ENVIRONMENT_PORTAL, serverConfig.COLLISION_USER_WITH_ENVIRONMENT_PORTAL));
            }
          }
        }
        if(hadImmortalAura && !isInImmortalZone){
          this.users[tempUser.id].auraList = [];
          this.users[tempUser.id].onBuffExchange(this.users[tempUser.id]);
        }
      }
    }
  }

  //clear tree and treeArray
  for(var i=0; i<userEles.length; i++){
    entityTree.remove(userEles[i]);
  }
  for(var i=0; i<mobEles.length; i++){
    entityTree.remove(mobEles[i]);
  }
  for(var i=0; i<chestEles.length; i++){
    entityTree.remove(chestEles[i]);
  }

  for(var i=0; i<removeOBJs.length; i++){
    collectionTree.remove(removeOBJs[i]);
    var index = collectionEles.indexOf(removeOBJs[i]);
    if(index >= 0){
      collectionEles.splice(index, 1);
    }
  }

  userEles = [];
  mobEles = [];
  chestEles = [];
  colliderEles = [];
  removeOBJs = [];
  // collectionEles = [];

  //updateUserArray
  for(var index in this.users){
    if(!this.users[index].isDead){
      this.users[index].setEntityEle();
      userEles.push(this.users[index].entityTreeEle);
    }
  }
  for(var index in this.monsters){
    this.monsters[index].setEntityEle();
    mobEles.push(this.monsters[index].entityTreeEle);
  }
  // for(var i=0; i<this.monsters.length; i++){
  //   this.monsters[i].setEntityEle();
  //   mobEles.push(this.monsters[i].entityTreeEle);
  // }
  for(var i=0; i<this.chests.length; i++){
    chestEles.push(this.chests[i].entityTreeEle);
  }

  var addedObjEles = [];
  // for(var i=0; i<this.addedObjExps.length; i++){
  //   addedObjEles.push(this.addedObjExps[i].collectionEle);
  // }
  for(var i=0; i<this.addedObjSkills.length; i++){
    addedObjEles.push(this.addedObjSkills[i].collectionEle);
  }
  for(var i=0; i<this.addedObjGolds.length; i++){
    addedObjEles.push(this.addedObjGolds[i].collectionEle);
  }
  for(var i=0; i<this.addedObjJewels.length; i++){
    addedObjEles.push(this.addedObjJewels[i].collectionEle);
  }
  for(var i=0; i<this.addedObjBoxs.length; i++){
    addedObjEles.push(this.addedObjBoxs[i].collectionEle);
  }
  for(var i=0; i<this.addedObjBuffs.length; i++){
    addedObjEles.push(this.addedObjBuffs[i].collectionEle);
  }
  // this.addedObjExps = [];
  this.addedObjSkills = [];
  this.addedObjGolds = [];
  this.addedObjJewels = [];
  this.addedObjBoxs = [];
  this.addedObjBuffs = [];

  for(var i=0; i<addedObjEles.length; i++){
    // console.log(addedObjEles);
    collectionEles.push(addedObjEles[i]);
  }

  //update projectiles array
  var i = this.projectiles.length;
  if(i > 0){
    while(i--){
      if(this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE || this.projectiles[i].type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
        if(this.projectiles[i].isExpired() || this.projectiles[i].isCollide){
          this.onNeedInformProjectileDelete(this.projectiles[i]);
          this.projectiles.splice(i, 1);
        }else{
          this.projectiles[i].move();
          colliderEles.push(this.projectiles[i]);
        }
      }else if(this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION){
        if(this.projectiles[i].isExpired() || this.projectiles[i].isCollide){
          if(this.projectiles[i].collisionPosition){
            this.projectiles[i].explode(this.projectiles[i].collisionPosition);
          }else{
            this.projectiles[i].explode();
          }
          this.skills.push(this.projectiles[i]);
          this.onNeedInformProjectileExplode(this.projectiles[i]);
          this.projectiles.splice(i, 1);
        }else{
          this.projectiles[i].move();
          colliderEles.push(this.projectiles[i]);
        }
      }else if(this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE_TICK){
        if(this.projectiles[i].isExpired()){
          this.onNeedInformProjectileDelete(this.projectiles[i]);
          this.projectiles.splice(i, 1);
        }else{
          this.projectiles[i].move();
          colliderEles.push(this.projectiles[i]);
        }
      }else if(this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){
        if(this.projectiles[i].isExpired()){
          this.projectiles[i].explode();
          this.skills.push(this.projectiles[i]);
          this.onNeedInformProjectileExplode(this.projectiles[i]);
          this.projectiles.splice(i, 1);
        }else{
          this.projectiles[i].move();
          colliderEles.push(this.projectiles[i]);
        }
      }
    }
  }
  //update skills array
  var skillsIndex = this.skills.length;
  if(skillsIndex > 0){
    while(skillsIndex--){
      colliderEles.push(this.skills[skillsIndex]);
      this.skills.splice(skillsIndex, 1);
    }
  }
  //put users data to tree
  entityTree.pushAll(userEles);
  entityTree.pushAll(mobEles);
  entityTree.pushAll(chestEles);

  collectionTree.pushAll(addedObjEles);
};
function staticIntervalHandler(){
  for(var i=0; i<colliderEles.length; i++){
    //tempCollider == skill and projectile
    var tempCollider = colliderEles[i];
    var collisionObjs = util.checkCircleCollision(staticTree, tempCollider.x, tempCollider.y, tempCollider.width/2, tempCollider.id);
    //collision with tree or stone
    if(collisionObjs.length > 0){
      for(var j = 0; j<collisionObjs.length; j++){
        if(collisionObjs[j].id.substr(0, 1) !== gameConfig.PREFIX_ENVIRONMENT_IMMORTAL_GROUND && collisionObjs[j].id.substr(0, 1) !== gameConfig.PREFIX_ENVIRONMENT_PORTAL
           && collisionObjs[j].id.substr(0, 1) !== gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
          if(tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE || tempCollider.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
            if(!tempCollider.isCollide){
              tempCollider.isCollide = true;
              if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBSTACLE_TREE){
                affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_TREE));
              }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBSTACLE_ROCK){
                affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_ROCK));
              }
              // else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
              //   affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND));
              // }
            }
          }else if(tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION){
            if(!tempCollider.isCollide){
              tempCollider.isCollide = true;
              tempCollider.collisionPosition = collisionObjs.collisionPosition;
            }else if(tempCollider.isCollide){
              if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBSTACLE_TREE){
                affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_TREE));
              }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBSTACLE_ROCK){
                affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_ROCK));
              }
              // else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
              //   affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND));
              // }
            }
          }else if((tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION)){
            if(!tempCollider.isCollide){
              if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBSTACLE_TREE){
                affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_TREE, true));
              }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBSTACLE_ROCK){
                affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_ROCK, true));
              }
              // else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
              //   affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND, true));
              // }
            }
          }else{
            if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBSTACLE_TREE){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_TREE));
            }else if(collisionObjs[j].id.substr(0,1) === gameConfig.PREFIX_OBSTACLE_ROCK){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_ROCK));
            }
            // else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
            //   affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND));
            // }
          }
        }
      }
    }
  }
};

function affectedIntervalHandler(){
  var i = affectedEles.length;
  if(i > 0){
    while(i--){
      if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_USER){
        if(affectedEles[i].affectedID in this.users){
          this.users[affectedEles[i].affectedID].takeDamage(affectedEles[i].actorID, affectedEles[i].fireDamage, affectedEles[i].frostDamage,
                                                  affectedEles[i].arcaneDamage, affectedEles[i].damageToMP, affectedEles[i].hitBuffList, affectedEles[i].skillIndex);
          if(affectedEles[i].buffToTarget){
            this.users[affectedEles[i].affectedID].addBuff(affectedEles[i].buffToTarget, affectedEles[i].actorID);
          }
          if(affectedEles[i].additionalBuffToTarget){
            this.users[affectedEles[i].affectedID].addBuff(affectedEles[i].additionalBuffToTarget, affectedEles[i].actorID);
          }
        }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_CHEST){
        for(var j=0; j<this.chests.length; j++){
          if(this.chests[j].objectID === affectedEles[i].affectedID){
            var dmg = 0;
            if(affectedEles[i].fireDamage){
              dmg += affectedEles[i].fireDamage;
            }
            if(affectedEles[i].frostDamage){
              dmg += affectedEles[i].frostDamage;
            }
            if(affectedEles[i].arcaneDamage){
              dmg += affectedEles[i].arcaneDamage;
            }
            this.chests[j].takeDamage(affectedEles[i].actorID, dmg);
            //
            // if(affectedEles[i].actorID in this.users){
            //   if(dmg){
            //     this.users[affectedEles[i].actorID].getExp(serverConfig.OBSTACLE_CHEST_EXP);
            //   }
            // }
            break;
          }
        }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_MONSTER){
        if(affectedEles[i].affectedID in this.monsters){
          var dmg = 0;
          if(affectedEles[i].fireDamage){
            dmg += affectedEles[i].fireDamage;
          }
          if(affectedEles[i].frostDamage){
            dmg += affectedEles[i].frostDamage;
          }
          if(affectedEles[i].arcaneDamage){
            dmg += affectedEles[i].arcaneDamage;
          }
          this.monsters[affectedEles[i].affectedID].takeDamage(affectedEles[i].actorID, dmg, affectedEles[i].skillIndex);
          if(affectedEles[i].buffToTarget){
            if(this.monsters[affectedEles[i].affectedID]){
              this.monsters[affectedEles[i].affectedID].addBuff(affectedEles[i].buffToTarget, affectedEles[i].actorID);
            }
          }
          if(affectedEles[i].additionalBuffToTarget){
            if(this.monsters[affectedEles[i].affectedID]){
              this.monsters[affectedEles[i].affectedID].addBuff(affectedEles[i].additionalBuffToTarget, affectedEles[i].actorID);
            }
          }
        }
        // for(var j=0; j<this.monsters.length; j++){
        //   if(this.monsters[j].objectID === affectedEles[i].affectedID){
        //     var dmg = 0;
        //     if(affectedEles[i].fireDamage){
        //       dmg += affectedEles[i].fireDamage;
        //     }
        //     if(affectedEles[i].frostDamage){
        //       dmg += affectedEles[i].frostDamage;
        //     }
        //     if(affectedEles[i].arcaneDamage){
        //       dmg += affectedEles[i].arcaneDamage;
        //     }
        //     this.monsters[j].takeDamage(affectedEles[i].actorID, dmg, affectedEles[i].skillIndex);
        //     if(affectedEles[i].buffToTarget){
        //       if(this.monsters[j]){
        //         this.monsters[j].addBuff(affectedEles[i].buffToTarget, affectedEles[i].actorID);
        //       }
        //     }
        //     if(affectedEles[i].additionalBuffToTarget){
        //       if(this.monsters[j]){
        //         this.monsters[j].addBuff(affectedEles[i].additionalBuffToTarget, affectedEles[i].actorID);
        //       }
        //     }
        //     break;
        //   }
        // }
      }
      // else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_EXP){
      //   this.getObj(affectedEles[i].affectedID, affectedEles[i].expAmount, affectedEles[i].actorID);
      // }
      else if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_TREE){
        // if(affectedEles[i].actorID in this.users){
        //   if(affectedEles[i].fireDamage || affectedEles[i].frostDamage || affectedEles[i].arcaneDamage){
        //     if(affectedEles[i].isTick){
        //       var isMeetCondition = this.addUserSkillTick(affectedEles[i].actorID);
        //       if(isMeetCondition){
        //         this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_TREE_EXP);
        //         this.createBoxWhenHitTree(affectedEles[i].affectedID);
        //       }
        //     }else{
        //       this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_TREE_EXP);
        //       // this.users[affectedEles[i].actorID].getExp(serverConfig.OBSTACLE_TREE_EXP);
        //       this.createBoxWhenHitTree(affectedEles[i].affectedID);
        //     }
        //   }
        // }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_ROCK){
        // if(affectedEles[i].actorID in this.users){
        //   if(affectedEles[i].fireDamage || affectedEles[i].frostDamage || affectedEles[i].arcaneDamage){
        //     if(affectedEles[i].isTick){
        //       var isMeetCondition = this.addUserSkillTick(affectedEles[i].actorID);
        //       if(isMeetCondition){
        //         this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_STONE_EXP);
        //         this.createOBJsWhenHitStone(affectedEles[i].affectedID);
        //       }
        //     }else{
        //       this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_STONE_EXP);
        //       // this.users[affectedEles[i].actorID].getExp(serverConfig.OBSTACLE_STONE_EXP);
        //       this.createOBJsWhenHitStone(affectedEles[i].affectedID);
        //     }
        //   }
        // }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND){
        // if(affectedEles[i].actorID in this.users){
          // if(affectedEles[i].fireDamage || affectedEles[i].frostDamage || affectedEles[i].arcaneDamage){
            // if(affectedEles[i].isTick){
              // var isMeetCondition = this.addUserSkillTick(affectedEles[i].actorID);
              // if(isMeetCondition){
              //   this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_CHEST_GROUND_EXP);
              // }
            // }else{
              // this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_CHEST_GROUND_EXP);
              // this.users[affectedEles[i].actorID].getExp(serverConfig.OBSTACLE_CHEST_GROUND_EXP);
            // }
          // }
        // }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_SKILL){
        this.getObj(affectedEles[i].affectedID, affectedEles[i].skillIndex, affectedEles[i].actorID, affectedEles[i].affectedObj);
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_GOLD){
        this.getObj(affectedEles[i].affectedID, affectedEles[i].goldAmount, affectedEles[i].actorID, affectedEles[i].affectedObj);
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_JEWEL){
        this.getObj(affectedEles[i].affectedID, affectedEles[i].jewelAmount, affectedEles[i].actorID, affectedEles[i].affectedObj);
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_BOX){
        this.getBox(affectedEles[i].affectedID, affectedEles[i], affectedEles[i].actorID, affectedEles[i].affectedObj);
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_BUFF){
        this.getBuff(affectedEles[i].affectedID, affectedEles[i].buffGroupIndex, affectedEles[i].actorID, affectedEles[i].affectedObj)
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_ENVIRONMENT_IMMORTAL){
        if(affectedEles[i].affectedID in this.users){
          this.users[affectedEles[i].affectedID].addAura(serverConfig.ENV_IMMORTAL_BUFF_INDEX);
        }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_ENVIRONMENT_PORTAL){
        if(affectedEles[i].affectedID in this.users){
          this.moveUserToRandomPos(affectedEles[i].affectedID);
        }
      }else{
        console.log('affectedEle is not specified');
        console.log(affectedEles[i]);
      }
      affectedEles.splice(i, 1);
    }
  }
};

var onMoveCalcCompelPos = function(){
  var collisionObjs = util.checkCircleCollision(staticTree, this.entityTreeEle.x, this.entityTreeEle.y, this.entityTreeEle.width/2, this.entityTreeEle.id);
  for(var i=collisionObjs.length - 1; i>=0; i--){
    if(collisionObjs[i].id.substr(0, 1) === gameConfig.PREFIX_ENVIRONMENT_PORTAL ||
    collisionObjs[i].id.substr(0, 1) === gameConfig.PREFIX_ENVIRONMENT_IMMORTAL_GROUND){
      collisionObjs.splice(i, 1);
    }
  }
  if(collisionObjs.length > 0 ){
    var addPos = util.calcCompelPos(this.entityTreeEle, collisionObjs);
  }
  return addPos;
};
var getMobTarget = function(mob, range){
  var collisionObjs = util.checkCircleCollision(entityTree, mob.entityTreeEle.x + mob.entityTreeEle.width/2 - range/2, mob.entityTreeEle.y + mob.entityTreeEle.width/2 - range/2, mob.entityTreeEle.width/2 + range/2, mob.entityTreeEle.id);
  for(var i=collisionObjs.length - 1; i>=0; i--){
    if(collisionObjs[i].id.substr(0, 1) !== gameConfig.PREFIX_USER){
      collisionObjs.splice(i, 1);
    }
  }
  if(collisionObjs.length){
    return collisionObjs[0].id;
  }
  return false;
}

module.exports = GameManager;
