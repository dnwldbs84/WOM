var serverConfig = require('./serverConfig.json');
var gameConfig = require('../public/gameConfig.json');
var util = require('../public/util.js');
var csvJson = require('../public/csvjson.js')
var dataJson = require('../public/data.json');
var serverDataJson = require('./serverData.json');

var csvJsonOption = {delimiter : ',', quote : '"'};
var skillTable = csvJson.toObject(dataJson.skillData, csvJsonOption);
var buffGroupTable = csvJson.toObject(dataJson.buffGroupData, csvJsonOption);
var buffTable = csvJson.toObject(serverDataJson.buffData, csvJsonOption);
var charDropTable = csvJson.toObject(serverDataJson.charDrop, csvJsonOption);
var boxDropTable = csvJson.toObject(serverDataJson.boxDrop, csvJsonOption);
var objectAssign = require('../public/objectAssign');

exports.generateRandomUniqueID = function(uniqueCheckArray, prefix){
  var IDisUnique = false;
  while(!IDisUnique){
    var randomID = generateRandomID(prefix);
    IDisUnique = true;
    for(var index in uniqueCheckArray){
      if(randomID == uniqueCheckArray[index].objectID){
        IDisUnique = false;
      }
    }
  }
  return randomID;
};
function generateRandomID(prefix){
  var output = prefix;
  for(var i=0; i<6; i++){
    output += Math.floor(Math.random()*16).toString(16);
  }
  return output;
};

exports.generateRandomPos = function(checkTree, minX, minY, maxX, maxY, radius, diffRangeWithOthers, objID, checkTree2){
  var isCollision = true;
  var repeatCount = 1;

  while(isCollision){
    if (repeatCount > 20){
      isCollision = false;
    }else{
      isCollision = false;
      var pos = {
        x : Math.floor(Math.random()*(maxX - minX) + minX),
        y : Math.floor(Math.random()*(maxY - minY) + minY)
      }
      var collisionObjs = util.checkCircleCollision(checkTree, pos.x, pos.y, radius + diffRangeWithOthers, objID);
      if(collisionObjs.length > 0){
        isCollision = true;
      }else if(checkTree2){
        var collisionObjs = util.checkCircleCollision(checkTree2, pos.x, pos.y, radius + diffRangeWithOthers, objID);
        if(collisionObjs.length >0){
          isCollision = true;
        }
      }
    }
    repeatCount++;
  }
  return pos;
};
exports.generateNearPos = function(position, range, tree, id, radius){
  var isCollision = true;
  var repeatCount = 1;
  while (isCollision) {
    repeatCount++;
    isCollision = false;

    var addPosX = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * (range + 1));
    var addPosY = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.sqrt(Math.pow(range, 2) - Math.pow(addPosX, 2)));
    var randomPos = {x : position.x + addPosX, y : position.y + addPosY};

    var collisionObjs = util.checkCircleCollision(tree, randomPos.x - radius, randomPos.y - radius, radius, id);
    if(collisionObjs.length){
      isCollision = true;
    }else if(randomPos.x < radius || randomPos.y < radius || randomPos.x + radius > gameConfig.CANVAS_MAX_SIZE.width || randomPos.y + radius > gameConfig.CANVAS_MAX_SIZE.height){
      isCollision = true;
    }
    if(repeatCount > 20){
      isCollision = false;
      randomPos = 0;
    }
  }
  return randomPos;

  // var addPosX = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * range + 1);
  // var addPosY = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.sqrt(Math.pow(range, 2) - Math.pow(addPosX, 2)));
  // // var randVal = Math.random();
  // // var addPosX = (Math.random() < 0.5 ? -1 : 1) * Math.floor((randVal < 0.8 ? 0.8 : randVal)*range);
  // // randVal = Math.random();
  // // var addPosY = (Math.random() < 0.5 ? -1 : 1) * Math.floor((randVal < 0.8 ? 0.8 : randVal)*range);
  // //
  // return {x : position.x + addPosX, y : position.y + addPosY};
};
exports.generateInsidePos = function(position, range, tree, id, radius, isCheckCollision){
  var isCollision = true;
  var repeatCount = 1;
  while(isCollision){
    repeatCount ++;
    isCollision = false;

    var addPosX = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * (range + 1));
    var addPosY = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * (range + 1));
    var randomPos = {x : position.x + addPosX, y : position.y + addPosY};

    if(isCheckCollision){
      var collisionObjs = util.checkCircleCollision(tree, randomPos.x - radius, randomPos.y - radius, radius, id);
      if(collisionObjs.length){
        isCollision = true;
      }else if(randomPos.x < radius || randomPos.y < radius || randomPos.x + radius > gameConfig.CANVAS_MAX_SIZE.width || randomPos.y + radius > gameConfig.CANVAS_MAX_SIZE.height){
        isCollision = true;
      }
      if(repeatCount > 20){
        isCollision = false;
        randomPos = 0;
      }
    }
  }
  return randomPos;
};
exports.findAndSetBuffs = function(buffGroupData, actorID){
  var returnVal = [];
  for(var i=0; i<10; i++){
    var buffIndex = buffGroupData['buff' + (i + 1)];
    if(buffIndex){
      var buffData = objectAssign({}, util.findData(buffTable, 'index', buffIndex));
      buffData.actorID = actorID;
      returnVal.push(buffData);
    }else{
      return returnVal;
    }
  }
  return returnVal;
};
exports.getRandomNum = function(minVal, maxVal){
  return Math.floor(Math.random()*(maxVal - minVal) + minVal);
};
exports.goldToRadius = function(gold){
  return 15 + Math.floor(Math.sqrt(gold) / 2);
};
exports.onUserBuffExchange = function(user){
  this.onNeedInformBuffUpdate(user);
};
exports.onUserSkillUpgrade = function(user, beforeSkillIndex, afterSkillIndex){
  var resourceData = this.processUserResource(user);
  this.onNeedInformSkillUpgrade(user.socketID, beforeSkillIndex, afterSkillIndex, resourceData);
};
exports.onUserChangePrivateStat = function(user){
  this.onNeedInformUserChangePrivateStat(user);
};
exports.onUserChangeStat = function(user){
  this.onNeedInformUserChangeStat(user);
};
exports.onUserTakeDamage = function(user, skillIndex){
  this.onNeedInformUserTakeDamage(user, skillIndex);
};
exports.onUserReduceMP = function(user){
  this.onNeedInformUserReduceMP(user);
};
exports.onUserGetExp = function(user, resource){
  this.onNeedInformUserGetExp(user, resource);
};
exports.onUserGetResource = function(user, resource){
  this.onNeedInformUserGetResource(user, resource);
};
exports.onUserGetSkill = function(user, skillIndex){
  this.onNeedInformUserGetSkill(user.socketID, skillIndex);
};
exports.onUserSkillChangeToResource = function(user, skillIndex){
  this.onNeedInformUserSkillChangeToResource(user.socketID, skillIndex);
};
exports.onUserScoreChange = function(){
  this.onNeedInformScoreData();
};
exports.onUserLevelUP = function(user){
  this.onNeedInformUserLevelUp(user);
};
exports.onUserDeath = function(user, attackUserID, deadUserID, deadUserName){
  var dropData = objectAssign({}, util.findDataWithTwoColumns(charDropTable, 'level', user.level, 'type', user.type));

  user.decreaseLevel(dropData.levelTo);
  var skillIndexes = user.lossSkills(dropData.lossSkillRate);
  user.updateCharTypeLevel();
  user.updateCharTypeSkill();
  var loseResource = user.decreaseResource(dropData.resourceReductionRate, dropData.goldReductionMin, dropData.jewelReductionMin);

  //give resource to kill user
  if(attackUserID !== deadUserID && attackUserID.substr(0, 3) === gameConfig.PREFIX_USER){
    if(attackUserID in this.users){
      this.users[attackUserID].getExp(dropData.provideExp, dropData.provideScore);
      if(dropData.provideGold){
        this.users[attackUserID].getGold(dropData.provideGold);
      }
      if(dropData.provideJewel){
        this.users[attackUserID].getJewel(dropData.provideJewel);
      }
      if(skillIndexes.attackUserSkill){
        var possessSkills = this.users[attackUserID].getSkill(skillIndexes.attackUserSkill);
        if(possessSkills){
          this.onNeedInformSkillData(this.users[attackUserID].socketID, possessSkills);
        }
      }
    }else{
      console.log(attackUserID + ' is not exists');
    }
  }
  if(skillIndexes){
    delete skillIndexes.attackUserSkill;
  }
  //set drop resources
  var golds = [], jewels = [], skills = [];
  var goldCount = Math.floor(Math.random() * (dropData.goldDropMaxCount - dropData.goldDropMinCount + 1) + dropData.goldDropMinCount);
  var jewelCount = Math.floor(Math.random() * (dropData.jewelDropMaxCount - dropData.jewelDropMinCount + 1) + dropData.jewelDropMinCount);
  var skillCount = Math.floor(Math.random() * (dropData.skillDropMaxCount - dropData.skillDropMinCount + 1) + dropData.skillDropMinCount);

  for(var i=0; i<goldCount; i++){
    var goldAmount = Math.floor(Math.random() * (dropData.goldDropMax - dropData.goldDropMin + 1) + dropData.goldDropMin);
    golds.push(goldAmount);
  }
  for(var i=0; i<jewelCount; i++){
    jewels.push(1);
  }
  var totalRate = 0;
  for(var i=0; i<10; i++){
    if(dropData['skillDropRate' + (i + 1)]){
      totalRate += dropData['skillDropRate' + (i + 1)];
    }else{
      break;
    }
  }
  for(var i=0; i<skillCount; i++){
    var randVal = Math.floor(Math.random() * totalRate);
    var sumOfRate = 0;
    for(var j=0; i<10; j++){
      if(dropData['skillDropRate' + (j + 1)]){
        sumOfRate += dropData['skillDropRate' + (j + 1)];
        if(sumOfRate > randVal){
          var skillIndex = dropData['dropSkillIndex' + (j + 1)];
          skills.push(skillIndex);
          break;
        }
      }else{
        break;
      }
    }
  }
  if(attackUserID.substr(0, 3) === gameConfig.PREFIX_USER){
    var attackUserType = this.getUserType(attackUserID);
    var killFeedBackLevel = this.calcKillFeedBackLevel(attackUserID);
    var attackUserName = this.getUserName(attackUserID);
  }else if(attackUserID.substr(0, 3) === gameConfig.PREFIX_MONSTER){
    attackUserType = gameConfig.CHAR_TYPE_MOB;
    killFeedBackLevel = gameConfig.KILL_FEEDBACK_LEVEL_0;
    if(attackUserID in this.monsters){
      attackUserName = this.monsters[attackUserID].name;
    }else{
      attackUserName = "Mob";
    }
  }
  var deadUserType = this.getUserType(deadUserID);

  this.onNeedInformUserDeath({userID : attackUserID, userType : attackUserType, feedBackLevel : killFeedBackLevel, userName : attackUserName},
                             {userID : deadUserID, userType : deadUserType, userName : deadUserName}
                             , loseResource, skillIndexes);
  userDrop.call(this, golds, jewels, skills, user.center);
};
exports.onMobTakeDamage = function(mob, skillIndex){
  this.onNeedInformMobTakeDamage(mob, skillIndex);
};
exports.onMobBuffExchange = function(mob){
  this.onNeedInformMobBuffExchange(mob);
};
exports.onMobDeath = function(mob, attackUserID){
  if(mob.objectID in this.monsters){
    delete this.monsters[mob.objectID];
    this.onNeedInformMobDeath(mob.objectID);
  }
  if(attackUserID in this.users && !this.users[attackUserID].isDead){
    this.users[attackUserID].getExp(mob.provideExp, 0, 0, mob.provideScore);
    if(mob.provideGold){
      this.users[attackUserID].getGold(mob.provideGold);
    }
    if(mob.provideJewel){
      this.users[attackUserID].getJewel(mob.provideJewel);
    }
  }
  var createdObjs = [];
  for(var i=0; i<mob.golds.length; i++){
    var objGold = this.createOBJs(1, gameConfig.PREFIX_OBJECT_GOLD, mob.golds[i], mob.center, 20)
    if(objGold.length){
      createdObjs.push(objGold[0]);
    }
  }
  for(var i=0; i<mob.jewelCount; i++){
    var objJewel = this.createOBJs(1, gameConfig.PREFIX_OBJECT_JEWEL, 1, mob.center, 20);
    if(objJewel.length){
      createdObjs.push(objJewel[0]);
    }
  }
  for(var i=0; i<mob.boxCount; i++){
    var objBox = this.createOBJs(1, gameConfig.PREFIX_OBJECT_BOX, 1, mob.center, 20);
    if(objBox.length){
      createdObjs.push(objBox[0]);
    }
  }
  if(createdObjs.length){
    this.onNeedInformCreateObjs(createdObjs);
  }
  // for(var i=0; i<this.monsters.length; i++){
  //   if(this.monsters[i].objectID === mobID){
  //     this.monsters.splice(i, 1);
  //     this.onNeedInformMobDeath(mobID);
  //     return;
  //   }
  // }
};
exports.onMobChangeState = function(mob){
  // var mobData = this.processMobData(mob);
  this.onNeedInfromMobChangeState(mob);
};
exports.getMobTargetPos = function(mob){
  if(mob.target in this.users){
    var userPosX = Math.floor(this.users[mob.target].center.x);
    var userPosY = Math.floor(this.users[mob.target].center.y);
    var mobPosX = Math.floor(mob.center.x);
    var mobPosY = Math.floor(mob.center.y);

    var vecX = userPosX - mobPosX;
    var vecY = userPosY - mobPosY;

    var dist = Math.sqrt(Math.pow(vecX, 2) + Math.pow(vecY, 2));
    var attackRange = Math.sqrt(Math.pow(mob.attackRange, 2));

    var newVecX = vecX * (dist - attackRange)/dist;
    var newVecY = vecY * (dist - attackRange)/dist;

    return {
      x : mobPosX + newVecX,
      y : mobPosY + newVecY
    }
  }
};
exports.getMobDirection = function(mob){
  if(mob.target in this.users){
    var distX = this.users[mob.target].center.x - mob.center.x;
    var distY = this.users[mob.target].center.y - mob.center.y;

    var tangentDegree = Math.atan(distY/distX) * 180 / Math.PI;
    if(isNaN(tangentDegree)){
      return mob.direction;
    }else{
      if(distX < 0 && distY >= 0){
        return tangentDegree + 180;
      }else if(distX < 0 && distY < 0){
        return tangentDegree - 180;
      }else{
        return tangentDegree;
      }
    }
  }
};
exports.onMobAttackUser = function(mob){
  if(mob.target in this.users){
    var userPosX = Math.floor(this.users[mob.target].center.x);
    var userPosY = Math.floor(this.users[mob.target].center.y);
    var mobPosX = Math.floor(mob.center.x);
    var mobPosY = Math.floor(mob.center.y);

    var vecX = userPosX - mobPosX;
    var vecY = userPosY - mobPosY;

    var dist = Math.sqrt(Math.pow(vecX, 2) + Math.pow(vecY, 2));
    var attackRange = Math.sqrt(Math.pow(mob.attackRange, 2));

    //do damage to user
    if(dist < mob.maxHitRange){
      this.users[mob.target].takeDamage(mob.objectID, mob.damage);
    }
  }
};
exports.setAffectedEleColSkillWithEntity = function(skill, affectedID, collisionType){
  return {
    collisionType : collisionType,
    skillType : skill.type,
    skillIndex : skill.index,

    projectileID : skill.objectID || 0,
    actorID : skill.id,

    affectedID : affectedID,

    fireDamage : skill.fireDamage || 0,
    frostDamage : skill.frostDamage || 0,
    arcaneDamage : skill.arcaneDamage || 0,
    damageToMP : skill.damageToMP || 0,

    buffToTarget : skill.buffToTarget,
    additionalBuffToTarget : skill.additionalBuffToTarget,
    hitBuffList : skill.hitBuffList
  };
};
exports.setAffectedEleColUserWithCollection = function(userID, affectedObj, collisionType){
  return {
    collisionType : collisionType,
    actorID : userID,
    affectedID : affectedObj.id,
    affectedObj : affectedObj,

    expAmount : affectedObj.expAmount || 0,
    goldAmount : affectedObj.goldAmount || 0,
    jewelAmount : affectedObj.jewelAmount || 0,
    skillIndex : affectedObj.skillIndex || 0
  };
};
exports.setAffectedEleColSkillWithObject = function(skill, affectedObjID, collisionType, isTickSkill){
  return {
    collisionType : collisionType,
    affectedID : affectedObjID,
    actorID : skill.id,

    isTick : isTickSkill || false,

    fireDamage : skill.fireDamage || 0,
    frostDamage : skill.frostDamage || 0,
    arcaneDamage : skill.arcaneDamage || 0
  };
};
exports.setAffectedEleColUserWithEnvironment = function(userID, envType, collisionType){
  return {
    collisionType : collisionType,
    affectedID : userID,
    envType : envType
  }
};
exports.checkUserBuff = function(user, skillData){
  var fireBuffList = [];
  var hitBuffList = [];

  if(user.inherentPassiveSkill){
    var inherentPassiveBuffGroupIndex = objectAssign({}, util.findData(skillTable, 'index', user.inherentPassiveSkill)).buffToSelf;
    var inherentPassiveBuffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', inherentPassiveBuffGroupIndex));
    var buffs = exports.findAndSetBuffs(inherentPassiveBuffGroupData, user.objectID);
    for(var i=0; i<buffs.length; i++){
      if(buffs[i].applyBaseSkill || skillData.index !== user.baseSkill){
        if(buffs[i].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_FIRE){
          if(buffs[i].skillProperty){
            if(buffs[i].skillProperty === skillData.property){
              if(buffs[i].fireUserCondition){
                if(user.conditions[buffs[i].fireUserCondition]){
                  fireBuffList.push(buffs[i]);
                }
              }else{
                fireBuffList.push(buffs[i]);
              }
            }
          }else{
            fireBuffList.push(buffs[i]);
          }
        }else if(buffs[i].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_FIRE_AND_HIT){
          if(buffs[i].skillProperty){
            if(buffs[i].skillProperty === skillData.property){
              if(buffs[i].fireUserCondition){
                if(user.conditions[buffs[i].fireUserCondition]){
                  hitBuffList.push(inherentPassiveBuffGroupData);
                  break;
                }
              }else{
                hitBuffList.push(inherentPassiveBuffGroupData);
                break;
              }
            }
          }else{
            hitBuffList.push(inherentPassiveBuffGroupData);
            break;
          }
        }
      }
    }
  }
  for(var i=0; i<user.passiveList.length; i++){
    var buffs = exports.findAndSetBuffs(user.passiveList[i], user.objectID);
    for(var j=0; j<buffs.length; j++){
      if(buffs[j].applyBaseSkill || skillData.index !== user.baseSkill){
        if(buffs[j].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_FIRE){
          if(buffs[j].skillProperty){
            if(buffs[j].skillProperty === skillData.property){
              if(buffs[j].fireUserCondition){
                if(user.conditions[buffs[j].fireUserCondition]){
                  fireBuffList.push(buffs[j]);
                }
              }else{
                fireBuffList.push(buffs[j]);
              }
            }
          }else{
            fireBuffList.push(buffs[j]);
          }
        }else if(buffs[j].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_FIRE_AND_HIT){
          if(buffs[j].skillProperty){
            if(buffs[j].skillProperty === skillData.property){
              if(buffs[j].fireUserCondition){
                if(user.conditions[buffs[j].fireUserCondition]){
                  hitBuffList.push(user.passiveList[i]);
                  break;
                }
              }else{
                hitBuffList.push(user.passiveList[i]);
                break;
              }
            }
          }else{
            hitBuffList.push(user.passiveList[i]);
            break;
          }
        }
      }
    }
  }
  for(var i=0; i<user.buffList.length; i++){
    var buffs = exports.findAndSetBuffs(user.buffList[i], user.objectID);
    for(var j=0; j<buffs.length; j++){
      if(buffs[j].applyBaseSkill || skillData.index !== user.baseSkill){
        if(buffs[j].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_FIRE){
          if(buffs[j].skillProperty){
            if(buffs[j].skillProperty === skillData.property){
              if(buffs[j].fireUserCondition){
                if(user.conditions[buffs[j].fireUserCondition]){
                  fireBuffList.push(buffs[j]);
                }
              }else{
                fireBuffList.push(buffs[j]);
              }
            }
          }else{
            fireBuffList.push(buffs[j]);
          }
        }else if(buffs[j].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_FIRE_AND_HIT){
          if(buffs[j].skillProperty){
            if(buffs[j].skillProperty === skillData.property){
              if(buffs[j].fireUserCondition){
                if(user.conditions[buffs[j].fireUserCondition]){
                  hitBuffList.push(user.buffList[i]);
                  break;
                }
              }else{
                hitBuffList.push(user.buffList[i]);
                break;
              }
            }
          }else{
            hitBuffList.push(user.buffList[i]);
            break;
          }
        }
      }
    }
  }
  var additionalDamage = 0,
      additionalFireDamage = 0,
      additionalFrostDamage = 0,
      additionalArcaneDamage = 0,
      additionalDamageRate = 100,
      additionalFireDamageRate = 100,
      additionalFrostDamageRate = 100,
      additionalArcaneDamageRate = 100;

  for(var i=0; i<fireBuffList.length; i++){
    if(fireBuffList[i].buffType === serverConfig.BUFF_TYPE_ADD_SECONDARY_STAT){
      if(fireBuffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_DAMAGE){
        additionalDamage += fireBuffList[i].buffAmount;
      }else if(fireBuffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FIRE_DAMAGE){
        additionalFireDamage += fireBuffList[i].buffAmount;
      }else if(fireBuffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FROST_DAMAGE){
        additionalFrostDamage += fireBuffList[i].buffAmount;
      }else if(fireBuffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_ARCANE_DAMAGE){
        additionalArcaneDamage += fireBuffList[i].buffAmount;
      }else if(fireBuffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_DAMAGE_RATE){
        additionalDamageRate += fireBuffList[i].buffAmount;
      }else if(fireBuffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FIRE_DAMAGE_RATE){
        additionalFireDamageRate += fireBuffList[i].buffAmount;
      }else if(fireBuffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FROST_DAMAGE_RATE){
        additionalFrostDamageRate += fireBuffList[i].buffAmount;
      }else if(fireBuffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_ARCANE_DAMAGE_RATE){
        additionalArcaneDamageRate += fireBuffList[i].buffAmount;
      }
    }else if(fireBuffList[i].buffType === serverConfig.BUFF_TYPE_ADD_BUFF){
      var addBuffGroupList = [];
      for(var j=0; j<serverConfig.BUFFTABLE_BUFFGROUP_LENGTH; j++){
        if(fireBuffList[i]['buffGroup' + (j + 1)]){
          addBuffGroupList.push(fireBuffList[i]['buffGroup' + (j + 1)]);
        }else{
          break;
        }
      }
      var randomIndex = Math.floor(Math.random() * (addBuffGroupList.length));
      var addBuffGroupIndex = addBuffGroupList[randomIndex];
      var addBuffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', addBuffGroupIndex));

      if(addBuffGroupData.isBuff){
        skillData.additionalBuffToSelf = addBuffGroupIndex;
      }else{
        skillData.additionalBuffToTarget = addBuffGroupIndex;
      }
    }
  }
  skillData.fireDamage = skillData.fireDamage + (additionalDamage + additionalFireDamage) * additionalFireDamageRate/100 * additionalDamageRate/100;
  skillData.frostDamage = skillData.frostDamage + (additionalDamage + additionalFrostDamage) * additionalFrostDamageRate/100 * additionalDamageRate/100;
  skillData.arcaneDamage = skillData.arcaneDamage + (additionalDamage + additionalArcaneDamage) * additionalArcaneDamageRate/100 * additionalDamageRate/100;
  skillData.hitBuffList = hitBuffList;
};

exports.onChestDestroy = function(cht, attackUserID){
  if(attackUserID in this.users && !this.users[attackUserID].isDead){
    this.users[attackUserID].getExp(cht.chestData.provideExp, 0, cht.chestData.provideScore);
    if(cht.chestData.provideGold){
      this.users[attackUserID].getGold(cht.chestData.provideGold);
    }
    if(cht.chestData.provideJewel){
      this.users[attackUserID].getJewel(cht.chestData.provideJewel);
    }
  }else{
    console.log(attackUserID + ' is not exists');
  }

  var createdObjs = [];
  for(var i=0; i<cht.golds.length; i++){
    var objGold = this.createOBJs(1, gameConfig.PREFIX_OBJECT_GOLD, cht.golds[i], cht.center);
    if(objGold.length){
      createdObjs.push(objGold[0]);
    }
  }
  for(var i=0; i<cht.jewels.length; i++){
    var objJewel = this.createOBJs(1, gameConfig.PREFIX_OBJECT_JEWEL, cht.jewels[i], cht.center);
    if(objJewel.length){
      createdObjs.push(objJewel[0]);
    }
  }
  // for(var i=0; i<cht.exps.length; i++){
  //   var objExp = this.createOBJs(1, gameConfig.PREFIX_OBJECT_EXP, cht.exps[i], cht.position);
  //   createdObjs.push(objExp[0]);
  // }
  for(var i=0; i<cht.skills.length; i++){
    var objSkill = this.createOBJs(1, gameConfig.PREFIX_OBJECT_SKILL, cht.skills[i], cht.center);
    if(objSkill.length){
      createdObjs.push(objSkill[0]);
    }
  }
  for(var i=0; i<this.chests.length; i++){
    if(this.chests[i].objectID === cht.objectID){
      this.chests.splice(i, 1);
    }
  }
  if(createdObjs.length){
    this.onNeedInformCreateObjs(createdObjs);
  }
  this.onNeedInformDeleteChest(cht.locationID);
};

exports.onChestDamaged = function(locationID, HP){
  this.onNeedInformChestDamaged(locationID, HP);
}

exports.getBoxDrop = function(){
  var tableItemCount = boxDropTable.length;
  var index = Math.floor(Math.random() * (tableItemCount)) + 1;
  var dropData = objectAssign({}, util.findData(boxDropTable, 'index', index));

  if(dropData.isGoldDrop){
    var goldAmount = Math.floor(Math.random() * (dropData.maxGoldAmount - dropData.minGoldAmount + 1)) + dropData.minGoldAmount;
  }
  if(dropData.isJewelDrop){
    var jewelAmount = Math.floor(Math.random() * (dropData.maxJewelAmount - dropData.minJewelAmount + 1)) + dropData.minJewelAmount;
  }
  if(dropData.isSkillDrop){
    var totalRate = 0;
    var itemCount = 0;
    for(var i=0; i<10; i++){
      if(dropData['SkillDropRate' + (i + 1)]){
        itemCount++;
        totalRate += dropData['SkillDropRate' + (i + 1)];
      }else{
        break;
      }
    }
    var randVal = Math.floor(Math.random() * totalRate);
    var sumOfRate = 0;
    for(var i=0; i<itemCount; i++){
      sumOfRate += dropData['SkillDropRate' + (i + 1)];
      if(sumOfRate > randVal){
        var skillIndex = dropData['SkillIndex' + (i + 1)];
        break;
      }
    }
  }
  return {
    exp : dropData.provideExp || 0,
    gold : goldAmount || 0,
    jewel : jewelAmount || 0,
    skillIndex : skillIndex || 0
  };
};
function userDrop(golds, jewels, skills, position){
  var createdObjs = [];
  for(var i=0; i<golds.length; i++){
    var objGold = this.createOBJs(1, gameConfig.PREFIX_OBJECT_GOLD, golds[i], position);
    if(objGold.length){
      createdObjs.push(objGold[0]);
    }
  }
  for(var i=0; i<jewels.length; i++){
    var objJewel = this.createOBJs(1, gameConfig.PREFIX_OBJECT_JEWEL, jewels[i], position);
    if(objJewel.length){
      createdObjs.push(objJewel[0]);
    }
  }
  // for(var i=0; i<cht.exps.length; i++){
  //   var objExp = this.createOBJs(1, gameConfig.PREFIX_OBJECT_EXP, cht.exps[i], cht.position);
  //   createdObjs.push(objExp[0]);
  // }
  for(var i=0; i<skills.length; i++){
    var objSkill = this.createOBJs(1, gameConfig.PREFIX_OBJECT_SKILL, skills[i], position);
    if(objSkill.length){
      createdObjs.push(objSkill[0]);
    }
  }
  if(createdObjs.length){
    this.onNeedInformCreateObjs(createdObjs);
  }
}
