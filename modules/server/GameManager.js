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

var dataJson = require('../public/data.json');

var skillTable = csvJson.toObject(dataJson.skillData, {delimiter : ',', quote : '"'});
var chestTable = csvJson.toObject(dataJson.chestData, {delimiter : ',', quote : '"'});
var obstacleTable = csvJson.toObject(dataJson.obstacleData, {delimiter : ',', quote : '"'});
// var map = require('../public/map.json');

var OBJs = require('./OBJs.js');
// var OBJExp = OBJs.OBJExp;
var OBJSkill = OBJs.OBJSkill;
var OBJGold = OBJs.OBJGold;
var OBJJewel = OBJs.OBJJewel;
var OBJChest = OBJs.OBJChest;
var OBJBox = OBJs.OBJBox;

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

function GameManager(){
  this.users = [];

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

  // this.objExpsCount = serverConfig.OBJ_EXP_MIN_COUNT;
  // this.objSkillsCount = serverConfig.OBJ_SKILL_MIN_COUNT;
  // this.objBoxsCount = serverConfig.OBJ_BOX_COUNT;
  // this.objGoldsCount = serverConfig.OBJ_GOLD_COUNT;
  // this.objJewelsCount = serverConfig.OBJ_JEWEL_MIN_COUNT;

  this.longTimeInterval = false;
  this.updateInteval = false;
  this.staticInterval = false;
  this.affectInterval = false;

  this.onNeedInformBuffUpdate = new Function();
  this.onNeedInformSkillUpgrade = new Function();
  this.onNeedInformUserChangePrivateStat = new Function();
  this.onNeedInformUserChangeStat = new Function();
  this.onNeedInformUserTakeDamage = new Function();
  this.onNeedInformUserReduceMP = new Function();
  this.onNeedInformUserGetExp = new Function();
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

  this.onNeedInformSkillData = new Function();
  this.onNeedInformProjectileDelete = new Function();
  this.onNeedInformProjectileExplode = new Function();
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
      thisManager.affectInterval = setInterval(affectIntervalHandler.bind(thisManager), INTERVAL_TIMER);
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
GameManager.prototype.setChestsLocation = function(){
  var chestGrounds = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
  for(var i=0; i<Object.keys(chestGrounds).length; i++){
    var tempGround = new Obstacle(chestGrounds[i].posX, chestGrounds[i].posY, chestGrounds[i].radius, chestGrounds[i].id);

    this.chestLocations.push(tempGround);
    // staticEles.push(tempGround.staticEle);
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
        randomPos = SUtil.generateRandomPos(collectionTree, 400, 400, gameConfig.CANVAS_MAX_SIZE.width - 400, gameConfig.CANVAS_MAX_SIZE.height - 400,
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
        randomPos = SUtil.generateRandomPos(collectionTree, 400, 400, gameConfig.CANVAS_MAX_SIZE.width - 400, gameConfig.CANVAS_MAX_SIZE.height - 400,
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
        randomPos = SUtil.generateRandomPos(collectionTree, 400, 400, gameConfig.CANVAS_MAX_SIZE.width - 400, gameConfig.CANVAS_MAX_SIZE.height - 400,
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
        randomPos = SUtil.generateRandomPos(collectionTree, 0, 0, gameConfig.CANVAS_MAX_SIZE.width - radius, gameConfig.CANVAS_MAX_SIZE.height - radius,
                                            radius, serverConfig.OBJ_GOLD_RANGE_WITH_OTHERS, randomID, staticTree);
      }
      if(randomPos){
        objBox.initOBJBox(randomPos, radius, objDrops.exp, objDrops.gold, objDrops.jewel, objDrops.skillIndex);
        objBox.setCollectionEle();

        this.objBoxs.push(objBox);
        this.addedObjBoxs.push(objBox);
        createdObjs.push(objBox);
      }
    }
  }else{
    console.log('check objs prefix : ' + type);
  }
  return createdObjs;
};
GameManager.prototype.createOBJsWhenHitStone = function(stoneID){
  for(var i=0; i<this.obstacles.length; i++){
    if(this.obstacles[i].objectID === stoneID){
      var randVal = Math.floor(Math.random() * serverConfig.OBSTACLE_STONE_GOLD_RATE);
      var createdObjs = [];
      if(randVal === 5){
        var amount = Math.floor(Math.random() * (serverConfig.OBSTACLE_STONE_GOLD_MAX - serverConfig.OBSTACLE_STONE_GOLD_MIN + 1) + serverConfig.OBSTACLE_STONE_GOLD_MIN);
        var objGold = this.createOBJs(1, gameConfig.PREFIX_OBJECT_GOLD, amount, this.obstacles[i].center, this.obstacles[i].size.width / 2 + 40);
        if(objGold.length){
          createdObjs.push(objGold[0]);
        }
      }
      randVal = Math.floor(Math.random() * serverConfig.OBSTACLE_STONE_JEWEL_RATE);
      if(randVal === 13){
        var objJewel = this.createOBJs(1, gameConfig.PREFIX_OBJECT_JEWEL, 1, this.obstacles[i].center, this.obstacles[i].size.width / 2 + 40);
        if(objJewel.length){
          createdObjs.push(objJewel[0]);
        }
      }
      if(createdObjs.length){
        this.onNeedInformCreateObjs(createdObjs);
      }
      break;
    }
  }
};
GameManager.prototype.createBoxWhenHitTree = function(treeID){
  for(var i=0; i<this.obstacles.length; i++){
    if(this.obstacles[i].objectID === treeID){
      var randVal = Math.floor(Math.random() * serverConfig.OBSTACLE_TREE_BOX_RATE);
      if(randVal === 9){
        var objBox = this.createOBJs(1, gameConfig.PREFIX_OBJECT_BOX, 1, this.obstacles[i].center, this.obstacles[i].size.width / 2 + 40);
        if(objBox.length){
          this.onNeedInformCreateObjs(objBox);
        }
      }
      break;
    }
  }
};
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
    if(objID.substr(0, 3) === gameConfig.PREFIX_OBJECT_SKILL){
      for(var i=0; i<this.objSkills.length; i++){
        if(this.objSkills[i].objectID === objID){
          var possessSkills = this.users[userID].getSkill(affectNum);
          if(possessSkills){
            this.onNeedInformSkillData(this.users[userID].socketID, possessSkills);
          }
          this.objSkills.splice(i, 1);
          break;
        }
      }
    }else if(objID.substr(0, 3) === gameConfig.PREFIX_OBJECT_GOLD){
      for(var i=0; i<this.objGolds.length; i++){
        if(this.objGolds[i].objectID === objID){
          this.users[userID].getGold(affectNum);
          this.objGolds.splice(i, 1);
          break;
        }
      }
    }else if(objID.substr(0, 3) === gameConfig.PREFIX_OBJECT_JEWEL){
      for(var i=0; i<this.objJewels.length; i++){
        if(this.objJewels[i].objectID === objID){
          this.users[userID].getJewel(affectNum);
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
        if(box.expAmount){
          this.users[userID].getExp(box.expAmount);
        }
        if(box.goldAmount){
          this.users[userID].getGold(box.goldAmount);
        }
        if(box.jewelAmount){
          this.users[userID].getJewel(box.jewelAmount);
        }
        if(box.skillIndex){
          var possessSkills = this.users[userID].getSkill(box.skillIndex);
          if(possessSkills){
            this.onNeedInformSkillData(this.users[userID].socketID, possessSkills);
          }
        }
        this.objBoxs.splice(i, 1);
        this.onNeedInformDeleteObj(objID);
        return;
      }
    }
  }
}
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
//     for(var i=0; i<this.objGolds.lengthl i++){
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
  this.users[user.objectID].onMove = onMoveCalcCompelPos.bind(this);
  this.users[user.objectID].onChangePrivateStat = SUtil.onUserChangePrivateStat.bind(this);
  this.users[user.objectID].onChangeStat = SUtil.onUserChangeStat.bind(this);
  this.users[user.objectID].onTakeDamage = SUtil.onUserTakeDamage.bind(this);
  this.users[user.objectID].onReduceMP = SUtil.onUserReduceMP.bind(this);
  this.users[user.objectID].onGetExp = SUtil.onUserGetExp.bind(this);
  this.users[user.objectID].onGetResource = SUtil.onUserGetResource.bind(this);
  this.users[user.objectID].onGetSkill = SUtil.onUserGetSkill.bind(this);
  this.users[user.objectID].onSkillChangeToResource = SUtil.onUserSkillChangeToResource.bind(this);
  this.users[user.objectID].onScoreChange = SUtil.onUserScoreChange.bind(this);
  this.users[user.objectID].onLevelUP = SUtil.onUserLevelUP.bind(this);
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
GameManager.prototype.initializeUser = function(user, baseSkill, possessSkills, inherentPassiveSkill){
  // check ID is unique
  var randomID = SUtil.generateRandomUniqueID(this.users, gameConfig.PREFIX_USER);
  //initialize variables;
  user.assignID(randomID);

  user.setSize(serverConfig.USER_BODY_SIZE, serverConfig.USER_BODY_SIZE);
  // user.setPosition(10, 10);
  // this.setUserPosition(user.objectID);

  user.setSkills(baseSkill, possessSkills, inherentPassiveSkill);

  user.initEntityEle();
  user.startUpdate();
};
GameManager.prototype.applySkill = function(userID, skillData){
  if(userID in this.users && !this.users[userID].isDead){
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
    var skillCollider = new SkillCollider(this.users[userID], skillData);
    if(skillData.additionalBuffToTarget){
      skillCollider.additionalBuffToTarget = skillData.additionalBuffToTarget;
    }
    this.skills.push(skillCollider);
  }else{
    // console.log('cant find user data');
  }
};
GameManager.prototype.applyProjectile = function(userID, projectileDatas){
  if(userID in this.users && !this.users[userID].isDead){
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
  if(userData.objectID in this.users && !this.users[userData.objectID].isDead){
    var lastPositionIndex = this.users[userData.objectID].beforePositions.length;
    if(lastPositionIndex > 0){
      var lastPosition = this.users[userData.objectID].beforePositions[lastPositionIndex - 1];
      var timeSpan = (userData.time - lastPosition.time)/1000;
      var distX = Math.abs(userData.position.x - lastPosition.x);
      var distY = Math.abs(userData.position.y - lastPosition.y);
      var dist = Math.sqrt(Math.pow(distX,2) + Math.pow(distY,2));
      if(dist > this.users[userData.objectID].maxSpeed * timeSpan * serverConfig.TOLERANCE_LIMIT_RATE){
        return false;
      }
    }
    return true;
  }else{
    return true;
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
GameManager.prototype.addUserExp = function(userID, exp){
  if(userID in this.users){
    this.users[userID].getExp(exp);
  }
};
GameManager.prototype.addUserSkillTick = function(userID){
  if(userID in this.users){
    this.users[userID].addSkillTick();
    if(this.users[userID].skillTick > serverConfig.TICK_COUNT_FOR_EXP){
      this.users[userID].skillTick = 0;
      return true;
    }else{
      return false;
    }
  }
  return false;
}
GameManager.prototype.getLevel = function(userID, charType){
  if(userID in this.users){
    return this.users[userID].getLevel(charType);
  }
};
GameManager.prototype.setUserStat = function(userID, userStat, userBase){
  if(userID in this.users){
    this.users[userID].setStat(userStat, userBase);
  }
};
GameManager.prototype.setUserSkill = function(userID, charType, baseSkill, passiveSkill){
  if(userID in this.users){
    this.users[userID].setSkill(charType, baseSkill, passiveSkill);
  }
};
GameManager.prototype.setUserPosition = function(userID){
  if(userID in this.users){
    var randomPos = SUtil.generateRandomPos(staticTree, 400, 400, gameConfig.CANVAS_MAX_SIZE.width - 400, gameConfig.CANVAS_MAX_SIZE.height - 400,
                                            this.users[userID].size.width/2, this.users[userID].size.width/2, userID);
    this.users[userID].setPosition(randomPos.x, randomPos.y);
  }
};
GameManager.prototype.startUserUpdate = function(userID){
  if(userID in this.users){
    this.users[userID].startUpdate();
  }
};
GameManager.prototype.setScore = function(userID){
  if(userID in this.users){
    this.users[userID].calcUserScore();
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
  try {
    return {
      objectID : user.objectID,
      type : user.type,
      name : user.name,

      currentState : user.currentState,
      position : user.position,
      targetPosition : user.targetPosition,
      maxSpeed : user.maxSpeed,
      direction : user.direction,
      rotateSpeed : user.rotateSpeed,
      size : user.size,

      level : user.level,
      exp : user.exp,

      maxHP : user.maxHP,
      maxMP : user.maxMP,
      HP : user.HP,
      MP : user.MP,
      castSpeed : user.castSpeed,

      conditions : user.conditions
    };
  } catch (e) {
    throw e;
  }
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
      userData.push({
        objectID : index,
        type : this.users[index].type,
        name : this.users[index].name,

        killScore : this.users[index].killScore,
        totalScore : this.users[index].score,

        currentState : this.users[index].currentState,
        position : this.users[index].position,
        targetPosition : this.users[index].targetPosition,

        maxSpeed : this.users[index].maxSpeed,
        direction : this.users[index].direction,
        rotateSpeed :  this.users[index].rotateSpeed,
        size : this.users[index].size,

        level : this.users[index].level,
        exp : this.users[index].exp,

        maxHP : this.users[index].maxHP,
        maxMP : this.users[index].maxMP,
        HP : this.users[index].HP,
        MP : this.users[index].MP,
        castSpeed : this.users[index].castSpeed,

        conditions : this.users[index].conditions,
        // buffList : buffIndexList
      });
    }
  };

  return userData;
};
GameManager.prototype.processUserAllTypeLevels = function(userID){
  if(userID in this.users){
    return {
      pyroLevel : this.users[userID].pyroLevel,
      frosterLevel : this.users[userID].frosterLevel,
      mysterLevel :this.users[userID].mysterLevel
    };
  }
};
GameManager.prototype.processChangedUserStat = function(user){
  try {
    return {
      objectID : user.objectID,
      type : user.type,
      level : user.level,
      exp : user.exp,
      maxHP : user.maxHP,
      maxMP : user.maxMP,
      HP : user.HP,
      MP : user.MP,
      castSpeed : user.castSpeed,
      maxSpeed : user.maxSpeed,
      rotateSpeed : user.rotateSpeed,

      conditions : user.conditions
    };
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.processUserResource = function(user){
  try {
    return{
      objectID : user.objectID,
      gold : user.gold,
      jewel : user.jewel
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
          datas.push({id : this.users[i].objectID, name : this.users[i].name, level: this.users[i].level, killScore : this.users[i].killCount, totalScore : this.users[i].score});
        }
      }else{
        datas.push({id : this.users[i].objectID, name : this.users[i].name, level: this.users[i].level, killScore : this.users[i].killCount, totalScore : this.users[i].score});
      }
    }
  }
  return datas;
};
GameManager.prototype.processUserPrivateDataSetting = function(user){
  try {
    return {
      damageRate : user.damageRate,
      fireDamageRate : user.fireDamageRate,
      frostDamageRate : user.frostDamageRate,
      arcaneDamageRate : user.arcaneDamageRate,
      resistAll : user.resistAll,
      resistFire : user.resistFire,
      resistFrost : user.resistFrost,
      resistArcane : user.resistArcane,

      level : user.level,

      statPower : user.statPower,
      statMagic : user.statMagic,
      statSpeed : user.statSpeed,
      cooldownReduceRate : user.cooldownReduceRate
    };
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.processBuffDataSettings = function(){
  var userBuffDatas = [];
  for(var index in this.users){
    if(!this.users[index].isDead){
      var buffIndexList = [];
      var passiveIndexList = [];
      for(var i=0; i<this.users[index].buffList.length; i++){
        buffIndexList.push({index : this.users[index].buffList[i].index, startTime : this.users[index].buffList[i].startTime});
      }
      for(var i=0; i<this.users[index].passiveList.length; i++){
        passiveIndexList.push(this.users[index].passiveList[i].index);
      }
      userBuffDatas.push({
        objectID : index,
        inherentPassive : this.users[index].inherentPassiveSkill,
        buffList : buffIndexList,
        passiveList : passiveIndexList
      });
    }
  }
  return userBuffDatas;
};
GameManager.prototype.processBuffDataSetting = function(user){
  try {
    var buffIndexList = [];
    var passiveIndexList = [];
    for(var i=0; i<user.buffList.length; i++){
      buffIndexList.push({index : user.buffList[i].index, startTime : user.buffList[i].startTime});
    }
    for(var i=0; i<user.passiveList.length; i++){
      passiveIndexList.push(user.passiveList[i].index);
    }
    return{
      objectID : user.objectID,
      inherentPassive : user.inherentPassiveSkill,
      buffList : buffIndexList,
      passiveList : passiveIndexList
    }
  } catch (e) {
    throw e;
  }
};
GameManager.prototype.addSkillData = function(userData){
  if(userData.objectID in this.users){
    userData.baseSkill = this.users[userData.objectID].baseSkill;
    // userData.equipSkills = this.users[userData.objectID].equipSkills;
    userData.possessSkills = this.users[userData.objectID].possessSkills;
    userData.inherentPassiveSkill= this.users[userData.objectID].inherentPassiveSkill;
  }
};
GameManager.prototype.addPrivateData = function(userData){
  if(userData.objectID in this.users){
    userData.damageRate = this.users[userData.objectID].damageRate,
    userData.fireDamageRate = this.users[userData.objectID].fireDamageRate,
    userData.frostDamageRate = this.users[userData.objectID].frostDamageRate,
    userData.arcaneDamageRate = this.users[userData.objectID].arcaneDamageRate,
    userData.resistAll = this.users[userData.objectID].resistAll,
    userData.resistFire = this.users[userData.objectID].resistFire,
    userData.resistFrost = this.users[userData.objectID].resistFrost,
    userData.resistArcane = this.users[userData.objectID].resistArcane,

    userData.statPower = this.users[userData.objectID].statPower;
    userData.statMagic = this.users[userData.objectID].statMagic;
    userData.statSpeed = this.users[userData.objectID].statSpeed;

    userData.cooldownReduceRate = this.users[userData.objectID].cooldownReduceRate;
  }
};
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
  if(data.objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_GOLD){
    return {
      objectID : data.objectID,
      position : data.position,
      radius : data.size.width/2
    };
  }else if(data.objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_JEWEL){
    return {
      objectID : data.objectID,
      position : data.position,
      radius : data.size.width/2
    };
  }else if(data.objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_SKILL){
    return {
      objectID : data.objectID,
      position : data.position,
      radius : data.size.width/2,
      property : data.skillProperty
    };
  }else if(data.objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_BOX){
    return {
      objectID : data.objectID,
      position : data.position,
      radius : data.size.width/2
    }
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
    objDatas.push({
      objectID : this.objGolds[i].objectID,
      position : this.objGolds[i].position,
      radius : this.objGolds[i].size.width/2
    });
  }
  for(var i=0; i<this.objJewels.length; i++){
    objDatas.push({
      objectID : this.objJewels[i].objectID,
      position : this.objJewels[i].position,
      radius : this.objJewels[i].size.width/2
    });
  }
  for(var i=0; i<this.objSkills.length; i++){
    objDatas.push({
      objectID : this.objSkills[i].objectID,
      position : this.objSkills[i].position,
      radius : this.objSkills[i].size.width/2,
      property : this.objSkills[i].skillProperty
    });
  }
  for(var i=0; i<this.objBoxs.length; i++){
    objDatas.push({
      objectID : this.objBoxs[i].objectID,
      position : this.objBoxs[i].position,
      radius : this.objBoxs[i].size.width/2
    })
  }
  return objDatas;
};
GameManager.prototype.processChestDataSetting = function(data){
  return {
    objectID : data.objectID,
    locationID : data.locationID,
    grade : data.grade,

    maxHP : data.maxHP,
    HP : data.HP
  };
};
GameManager.prototype.processChestDataSettings = function(){
  var chestDatas = [];
  for(var i=0; i<this.chests.length; i++){
    chestDatas.push({
      objectID : this.chests[i].objectID,
      locationID : this.chests[i].locationID,
      grade : this.chests[i].grade,

      maxHP : this.chests[i].maxHP,
      HP : this.chests[i].HP
    });
  }
  return chestDatas;
};
GameManager.prototype.checkCreateChest = function(){
  // if(this.chests.length < 9){
  //   return true;
  // }
  if(this.users.length < 5){
    if(this.chests.length < 2){
      return true;
    }else{
      return false;
    }
  }else if(this.users.length > 40){
    if(this.chest.length < 9){
      return true;
    }else{
      return false;
    }
  }else if(this.users.length / 4 > this.chests.length){
    return true;
  }else{
    return false;
  }
  return false;
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
GameManager.prototype.cancelBlur = function(userID){
  if(userID in this.users){
    this.users[userID].cancelBlur();
  }
};
//cheat code
GameManager.prototype.killme = function(userID){
  if(userID in this.users){
    this.users[userID].death(userID);
  }
};
GameManager.prototype.giveExp = function(userID){
  if(userID in this.users){
    if(!this.users[userID].isDead){
      this.users[userID].getExp(500);
    }
  }
};
GameManager.prototype.giveResources = function(userID){
  if(userID in this.users){
    this.users[userID].getGold(10000);
    this.users[userID].getJewel(10);
  }
};
GameManager.prototype.giveTwitterGold = function(userID, gold){
  if(userID in this.users && !this.users[userID].isGetTwitterReward){
    this.users[userID].isGetTwitterReward = true;
    this.users[userID].getGold(gold);
  }
};
GameManager.prototype.giveFacebookJewel = function(userID, jewel){
  if(userID in this.users && !this.users[userID].isGetFacebookReward){
    this.users[userID].isGetFacebookReward = true;
    this.users[userID].getJewel(jewel);
  }
};
GameManager.prototype.giveAllSkill = function(userID, skills){
  if(userID in this.users){
    for(var i=0; i<skills.length; i++){
      if(i === skills.length -1){
        var possessSkills = this.users[userID].getSkill(skills[i]);
        this.onNeedInformSkillData(this.users[userID].socketID, possessSkills);
      }else{
        this.users[userID].getSkill(skills[i]);
      }
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
function longTimeIntervalHandler(){
  var additionalGoldCount = serverConfig.OBJ_GOLD_COUNT - this.objGolds.length;
  var additionalBoxCount = serverConfig.OBJ_BOX_COUNT - this.objBoxs.length;
  var additionalJewelCount = serverConfig.OBJ_JEWEL_COUNT - this.objJewels.length;
  if(additionalGoldCount > 0){
    this.createGoldsToRandomPosition(additionalGoldCount);
  }
  if(additionalBoxCount > 0){
    this.createBoxsToRandomPosition(additionalBoxCount);
  }
  if(additionalJewelCount > 0){
    this.createJewelsToRandomPosition(additionalJewelCount);
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
  if(this.checkCreateChest()){
    setChestIndexAndDoCreateChest.call(this);
    setTimeout(setChestIndexAndDoCreateChest.bind(this), serverConfig.CHEST_CHAIN_CREATE_TIME);
  }
};
var setChestIndexAndDoCreateChest = function(){
  if(this.checkCreateChest()){
    var isCreate = false;
    var repeatCount = 0;
    while(!isCreate){
      repeatCount++;
      var index = Math.floor(Math.random() * 9) + 1;
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
  }
}
function updateIntervalHandler(){
  //check collision user with skill
  //colliderEle : skill, collisionObj : user, chest
  for(var i=0; i<colliderEles.length; i++){
    //tempCollider == skill and projectile
    var tempCollider = colliderEles[i];
    //collision with user or chest
    // if(tempCollider.latency >= 225){
    //   var collisionObjs = util.checkCircleCollision(entityBefore300msTree, tempCollider.x, tempCollider.y, tempCollider.width/2, tempCollider.id);
    //   // console.log('check collision to entityBefore300msTree');
    // }else if(tempCollider.latency >= 75){
    //   collisionObjs = util.checkCircleCollision(entityBefore150msTree, tempCollider.x, tempCollider.y, tempCollider.width/2, tempCollider.id);
    //   // console.log('check collision to entityBefore150msTree');
    // }else {
    collisionObjs = util.checkCircleCollision(entityTree, tempCollider.x, tempCollider.y, tempCollider.width/2, tempCollider.id);
    // }
    if(collisionObjs.length > 0){
      for(var j = 0; j<collisionObjs.length; j++){
        if(tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE || tempCollider.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
          if(!tempCollider.isCollide){
            tempCollider.isCollide = true;
            if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_USER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_CHEST){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
          }
        }else if(tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION){
          if(!tempCollider.isCollide){
            tempCollider.isCollide = true;
            tempCollider.collisionPosition = collisionObjs.collisionPosition;
          }else if(tempCollider.isCollide){
            if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_USER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_CHEST){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
          }
        }else if((tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION)){
          if(!tempCollider.isCollide){
            if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_USER){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_CHEST){
              affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
            if(collisionObjs.length - 1 === j){
              tempCollider.isCollide = true;
            }
          }
        }else{
          if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_USER){
            affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
          }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_CHEST){
            affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
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
      if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBJECT_SKILL){
        //case objSkill
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_SKILL));
        // affectedEles.push({type : 'getSkillObj',user : tempUser.id, colObj : collisionObjs[j].id, skillIndex : collisionObjs[j].skillIndex});
      }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBJECT_GOLD){
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_GOLD));
      }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBJECT_JEWEL){
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_JEWEL));
      }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBJECT_BOX){
        affectedEles.push(SUtil.setAffectedEleColUserWithCollection(tempUser.id, collisionObjs[j], serverConfig.COLLISION_USER_WITH_COLLECTION_BOX));
      }else{
        console.log('check id' + collisionObjs[j].id);
      }
      // removeOBJs.push(collisionObjs[j]);
    }
  }

  //clear tree and treeArray
  for(var i=0; i<userEles.length; i++){
    entityTree.remove(userEles[i]);
  }
  // for(var i=0; i<userBefore150msEles.length; i++){
  //   entityBefore150msTree.remove(userBefore150msEles[i]);
  // }
  // for(var i=0; i<userBefore300msEles.length; i++){
  //   entityBefore300msTree.remove(userBefore300msEles[i]);
  // }
  for(var i=0; i<chestEles.length; i++){
    entityTree.remove(chestEles[i]);
    // entityBefore150msTree.remove(chestEles[i]);
    // entityBefore300msTree.remove(chestEles[i]);
  }

  for(var i=0; i<removeOBJs.length; i++){
    collectionTree.remove(removeOBJs[i]);
    var index = collectionEles.indexOf(removeOBJs[i]);
    if(index >= 0){
      collectionEles.splice(index, 1);
    }
  }

  userEles = [];
  // userBefore150msEles = [];
  // userBefore300msEles = [];
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
    // this.users[index].setBefore150msEntitiyEle();
    // userBefore150msEles.push(this.users[index].entityBefore150msTreeEle);

    // this.users[index].setBefore300msEntityEle();
    // userBefore300msEles.push(this.users[index].entityBefore300msTreeEle);
  }
  for(var i=0; i<this.chests.length; i++){
    chestEles.push(this.chests[i].entityTreeEle);
  }
  //update collectable objects array
  // var addExpCounts = this.objExpsCount -this.objExps.length;
  // var addSkillCounts = this.objSkillsCount - this.objSkills.length;
  // var addGoldCounts = this.objGoldsCount - this.objGolds.length;
  // if(addExpCounts > 0){
  //   var createdObjs = this.createOBJs(addExpCounts, gameConfig.PREFIX_OBJECT_EXP);
  //   this.onNeedInformCreateObjs(createdObjs);
  // }
  // if(addSkillCounts > 0){
  //   var createdObjs = this.createOBJs(addSkillCounts, gameConfig.PREFIX_OBJECT_SKILL);
  //   this.onNeedInformCreateObjs(createdObjs);
  // }
  // if(addGoldCounts > 0){
  //   var createdObjs = this.createOBJs(addGoldCounts, gameConfig.PREFIX_OBJECT_GOLD);
  //   if(createdObjs.length){
  //     this.onNeedInformCreateObjs(createdObjs);
  //   }
  // }

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
  // this.addedObjExps = [];
  this.addedObjSkills = [];
  this.addedObjGolds = [];
  this.addedObjJewels = [];
  this.addedObjBoxs = [];

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
      // }else{
      //   this.projectiles[i].move();
      //   colliderEles.push(this.projectiles[i]);
      // }
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
  entityTree.pushAll(chestEles);

  // entityBefore150msTree.pushAll(userBefore150msEles);
  // entityBefore150msTree.pushAll(chestEles);

  // entityBefore300msTree.pushAll(userBefore300msEles);
  // entityBefore300msTree.pushAll(chestEles);

  // collectionTree.pushAll(collectionEles);
  collectionTree.pushAll(addedObjEles);
};
function staticIntervalHandler(){
  //explode when projectile collide with obstacle
  // for(var i=0; i<this.projectiles.length; i++){
  //   var projectileCollider = this.projectiles[i];
  //   var collisionObjs = util.checkCircleCollision(staticTree, projectileCollider.x, projectileCollider.y, projectileCollider.width/2, projectileCollider.id);
  //   if(collisionObjs.length > 0 ){
  //     if(projectileCollider.type === gameConfig.SKILL_TYPE_PROJECTILE || projectileCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION
  //         || projectileCollider.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
  //       if(!projectileCollider.isCollide){
  //         projectileCollider.isCollide = true;
  //       }
  //     }
  //   }
  // }

  for(var i=0; i<colliderEles.length; i++){
    //tempCollider == skill and projectile
    var tempCollider = colliderEles[i];
    var collisionObjs = util.checkCircleCollision(staticTree, tempCollider.x, tempCollider.y, tempCollider.width/2, tempCollider.id);
    //collision with tree or stone
    if(collisionObjs.length > 0){
      for(var j = 0; j<collisionObjs.length; j++){
        if(tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE || tempCollider.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
          if(!tempCollider.isCollide){
            tempCollider.isCollide = true;
            if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_TREE){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_TREE));
              // affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_ROCK){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_ROCK));
              // affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
          }
        }else if(tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION){
          if(!tempCollider.isCollide){
            tempCollider.isCollide = true;
            tempCollider.collisionPosition = collisionObjs.collisionPosition;
          }else if(tempCollider.isCollide){
            if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_TREE){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_TREE));
              // affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_ROCK){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_ROCK));
              // affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
          }
        }else if((tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || tempCollider.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION)){
          if(!tempCollider.isCollide){
            if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_TREE){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_TREE, true));
              // affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_ROCK){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_ROCK, true));
              // affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
            }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
              affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND, true));
            }else{
              console.log('check id' + collisionObjs[j].id);
            }
            // if(collisionObjs.length - 1 === j){
            //   tempCollider.isCollide = true;
            // }
          }
        }else{
          if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_TREE){
            affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_TREE));
            // affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_USER));
          }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_ROCK){
            affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_ROCK));
            // affectedEles.push(SUtil.setAffectedEleColSkillWithEntity(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST));
          }else if(collisionObjs[j].id.substr(0,3) === gameConfig.PREFIX_OBSTACLE_CHEST_GROUND){
            affectedEles.push(SUtil.setAffectedEleColSkillWithObject(tempCollider, collisionObjs[j].id, serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND));
          }else{
            console.log('check id' + collisionObjs[j].id);
          }
        }
      }
    }
  }
};

function affectIntervalHandler(){
  var i = affectedEles.length;
  // console.log('affectedEles.length');
  // console.log(affectedEles.length);
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
            console.log('additionalBuffToTarget!!!');
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
      }
      // else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_EXP){
      //   this.getObj(affectedEles[i].affectedID, affectedEles[i].expAmount, affectedEles[i].actorID);
      // }
      else if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_TREE){
        if(affectedEles[i].actorID in this.users){
          if(affectedEles[i].fireDamage || affectedEles[i].frostDamage || affectedEles[i].arcaneDamage){
            if(affectedEles[i].isTick){
              var isMeetCondition = this.addUserSkillTick(affectedEles[i].actorID);
              if(isMeetCondition){
                this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_TREE_EXP);
                this.createBoxWhenHitTree(affectedEles[i].affectedID);
              }
            }else{
              this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_TREE_EXP);
              // this.users[affectedEles[i].actorID].getExp(serverConfig.OBSTACLE_TREE_EXP);
              this.createBoxWhenHitTree(affectedEles[i].affectedID);
            }
          }
        }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_ROCK){
        if(affectedEles[i].actorID in this.users){
          if(affectedEles[i].fireDamage || affectedEles[i].frostDamage || affectedEles[i].arcaneDamage){
            if(affectedEles[i].isTick){
              var isMeetCondition = this.addUserSkillTick(affectedEles[i].actorID);
              if(isMeetCondition){
                this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_STONE_EXP);
                this.createOBJsWhenHitStone(affectedEles[i].affectedID);
              }
            }else{
              this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_STONE_EXP);
              // this.users[affectedEles[i].actorID].getExp(serverConfig.OBSTACLE_STONE_EXP);
              this.createOBJsWhenHitStone(affectedEles[i].affectedID);
            }
          }
        }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_SKILL_WITH_CHEST_GROUND){
        if(affectedEles[i].actorID in this.users){
          if(affectedEles[i].fireDamage || affectedEles[i].frostDamage || affectedEles[i].arcaneDamage){
            if(affectedEles[i].isTick){
              // var isMeetCondition = this.addUserSkillTick(affectedEles[i].actorID);
              // if(isMeetCondition){
              //   this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_CHEST_GROUND_EXP);
              // }
            }else{
              // this.addUserExp(affectedEles[i].actorID, serverConfig.OBSTACLE_CHEST_GROUND_EXP);
              // this.users[affectedEles[i].actorID].getExp(serverConfig.OBSTACLE_CHEST_GROUND_EXP);
            }
          }
        }
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_SKILL){
        this.getObj(affectedEles[i].affectedID, affectedEles[i].skillIndex, affectedEles[i].actorID, affectedEles[i].affectedObj);
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_GOLD){
        this.getObj(affectedEles[i].affectedID, affectedEles[i].goldAmount, affectedEles[i].actorID, affectedEles[i].affectedObj);
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_JEWEL){
        this.getObj(affectedEles[i].affectedID, affectedEles[i].jewelAmount, affectedEles[i].actorID, affectedEles[i].affectedObj);
      }else if(affectedEles[i].collisionType === serverConfig.COLLISION_USER_WITH_COLLECTION_BOX){
        this.getBox(affectedEles[i].affectedID, affectedEles[i], affectedEles[i].actorID, affectedEles[i].affectedObj);
      }else{
        console.log('affectedEle is not specified');
        console.log(affectedEles[i]);
      }
      // if(affectedEles[i].type === 'hitObj'){
      //   if(affectedEles[i].hitObj.substr(0, 3) === gameConfig.PREFIX_USER){
      //     if(affectedEles[i].hitObj in this.users){
      //       //case hit user
      //       this.users[affectedEles[i].hitObj].takeDamage(affectedEles[i].attackUser, affectedEles[i].damage);
      //       //buff and debuff apply
      //       this.users[affectedEles[i].hitObj].addBuff(affectedEles[i].buffsToTarget);
      //     }
      //   }else if(affectedEles[i].hitObj.substr(0, 3) === gameConfig.PREFIX_CHEST){
      //     //case hit chest
      //     for(var i=0; i<this.chests.length; i++){
      //       if(this.chests[i].objectID === affectedEles[i].hitObj){
      //         SUtil.handlingAffectedEleColSkillWithChest();
      //         this.chests[i].takeDamage(affectedEles[i].attackUser, affectedEles[i].damage);
      //         break;
      //       }
      //     }
      //   }
      // }else{
      //   this.getObj(affectedEles[i]);
      // }
      affectedEles.splice(i, 1);
    }
  }
};

var onMoveCalcCompelPos = function(user){
  var collisionObjs = util.checkCircleCollision(staticTree, user.entityTreeEle.x, user.entityTreeEle.y, user.entityTreeEle.width/2, user.entityTreeEle.id);
  if(collisionObjs.length > 0 ){
    var addPos = util.calcCompelPos(user.entityTreeEle, collisionObjs);
  }
  return addPos;
};

module.exports = GameManager;
