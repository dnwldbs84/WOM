var LivingEntity = require('./LivingEntity.js');

var util = require('../public/util.js');
var SUtil = require('./ServerUtil.js');

var gameConfig = require('../public/gameConfig.json');
var objectAssign = require('../public/objectAssign');

var INTERVAL_TIMER = 1000/10;

function Monster(mobData, mobGenData){
  LivingEntity.call(this);

  this.isDead = false;

  this.targetUserID = null;
  this.attackUsers = [];

  this.genPos = {x : mobGenData.genPosX, y : mobGenData.genPosY};
  this.maxMoveRange = mobGenData.maxMoveRange;
  this.freeMoveRange = mobGenData.freeMoveRange;
  this.attackRange = mobData.attackRange;
  this.maxHitRange = mobData.maxHitRange;

  this.moveSpeed = mobData.moveSpeed;
  this.rotateSpeed = mobData.rotateSpeed;
  this.attackSpeed = mobData.attackSpeed;
  this.HP = mobData.HP;
  this.maxHP = mobData.maxHP;
  this.HPRegen = mobData.HPRegen;
  this.damage = mobData.damage;
  this.resistAll = mobData.resistAll;

  this.conditions = {};
  this.conditions[gameConfig.USER_CONDITION_CHILL] = false;
  this.conditions[gameConfig.USER_CONDITION_FREEZE] = false;
  this.conditions[gameConfig.USER_CONDITION_IGNITE] = false;

  this.buffList = [];
  this.passiveList = [];

  this.golds = [];
  this.jewels = [];
  this.skills = [];

  this.currentState = gameConfig.OBJECT_STATE_IDLE;

  this.updateInterval = false;
  this.buffUpdateInterval = false;
  this.regenInterval = false;

  this.updateFunction = new Function();
  this.timer = Date.now();
  this.regenTimer = Date.now();

  this.setMaxSpeed(this.moveSpeed);
  this.setRotateSpeed(this.rotateSpeed);

  this.onChangeStat = new Function();
  this.onBuffExchange = new Function();
  this.onTakeDamage = new Function();
  this.onDeath = new Function();
}
Monster.prototype = Object.create(LivingEntity.prototype);
Monster.prototype.constructor = Monster;

Monster.prototype.changeState = function(newState){
  this.currentState = newState;

  this.stop();
  switch (this.currentState) {
    case gameConfig.OBJECT_STATE_IDLE:
      this.updateFunction = this.idle.bind(this);
      break;
    case gameConfig.OBJECT_STATE_MOVE:
      this.updateFunction = this.rotate.bind(this);
      break;
    case gameConfig.OBJECT_STATE_ATTACK:
      this.updateFunction = this.attack.bind(this);
      break;
    case gameConfig.OBJECT_STATE_DEATH:
      this.updateFunction = this.idle.bind(this);
      break;
  }
  this.update();
};
Monster.prototype.update = function(){
  this.updateInterval = setInterval(this.updateFunction, INTERVAL_TIMER);
};
Monster.prototype.startUpdate = function(){
  if(!this.buffUpdateInterval){
    this.buffUpdateInterval = setInterval(buffUpdateHandler.bind(this), INTERVAL_TIMER);
  }
  if(!this.regenInterval){
    this.regenInterval = setInterval(regenIntervalHandler.bind(this), INTERVAL_TIMER);
  }
};
Monster.prototype.idle = function(){
  this.doEveryTick();
};
Monster.prototype.rotate = function(){
  var deltaTime = (Date.now() - this.timer)/1000;
  util.rotate.call(this, deltaTime);
  this.doEveryTick();
};
Monster.prototype.move = function(deltaTime, isMoveSlight){
  if(isMoveSlight){
    util.move.call(this, deltaTime, isMoveSlight)
  }else{
    util.move.call(this, deltaTime);
  }
};
Monster.prototype.setTargetDirection = function(){
  util.setTargetDirection.call(this);
};
Monster.prototype.setSpeed = function(){
  util.setSpeed.call(this);
};
Monster.prototype.attack = function(){
  this.doEveryTick();
};
Monster.prototype.doEveryTick = function(){
  this.timer = Date.now();
};
Monster.prototype.stop = function(){
  if(this.updateInterval){
    clearInterval(this.updateInterval);
    this.updateInterval = false;
  }
};
Monster.prototype.takeDamage = function(attackUserID, fireDamage, frostDamage, arcaneDamage, skillIndex){
  var dmg = 0;
  if(fireDamage && util.isNumeric(fireDamage)){
    dmg += (fireDamage * (1 - this.resistAll/100));
  }
  if(frostDamage && util.isNumeric(frostDamage)){
    dmg += (frostDamage * (1 - this.resistAll/100));
  }
  if(arcaneDamage && util.isNumeric(arcaneDamage)){
    dmg += (arcaneDamage * (1 - this.resistAll/100));
  }
  if(dmg < 0 || !util.isNumeric(dmg)){
    dmg = 1;
  }

  this.HP -= dmg;
  this.onTakeDamage(this, dmg, skillIndex);
  if(this.HP <= 0){
    this.death(attackUserID);
  }
};
Monster.prototype.death = function(attackUserID){
  if(!this.isDead){
    this.isDead = true;
    this.clearAll();
    this.onDeath(this, attackUserID);
  }
};
Monster.prototype.clearAll = function(){
  clearInterval(this.buffUpdateInterval);
  clearInterval(this.regenInterval);
  this.buffUpdateInterval = false;
  this.regenInterval = false;

  this.buffList = [];

  this.stop();
};
Monster.prototype.addBuff = function(buffGroupIndex, actorID){
  var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupIndex));
  if(buffGroupData){
    var isApply = false;
    var rate = Math.floor(Math.random() * 101);

    if(buffGroupData.buffApplyRate > rate){
      isApply = true;
      buffGroupData.actorID = actorID;
    }
    if(!buffGroupData.isBuff && this.conditions[gameConfig.USER_CONDITION_IMMORTAL]){
      //if debuff but user condition immortal
      isApply = false;
    }

    //set duration and startTime
    //if duplicate condition, set as later condition buff. delete fore buff and debuff
    //set buffTickTime
    if(isApply){
      var buffs = SUtil.findAndSetBuffs(buffGroupData, actorID);
      for(var i=buffs.length-1; i>=0; i--){
        if(buffs[i].hitUserCondition){
          if(!this.conditions[buffs[i].hitUserCondition]){
            buffs.splice(i, 1);
          }
        }
      }
      for(var i=0; i<serverConfig.BUFFGROUPTABLE_BUFF_LENGTH; i++){
        buffGroupData['buff' + (i+1)] = undefined;
      }
      for(var i=0; i<buffs.length; i++){
        // console.log(buffGroupData['buff' + (i+1)]);
        buffGroupData['buff' + (i+1)] = buffs[i];
      }
      for(var i=0; i<this.buffList.length; i++){
        if(this.buffList[i].index === buffGroupData.index){
          this.buffList.splice(i, 1);
          break;
        }
      }
      if(buffs.length > 0){
        buffGroupData.startTime = Date.now();
        buffGroupData.tickStartTime = Date.now();
        this.buffList.push(buffGroupData);
        this.onBuffExchange(this);
      }
    }
  }
};

function buffUpdateHandler(){
  var beforeConditionChill = this.conditions[gameConfig.USER_CONDITION_CHILL];
  var beforeConditionFreeze = this.conditions[gameConfig.USER_CONDITION_FREEZE];
  var beforeConditionIgnite = this.conditions[gameConfig.USER_CONDITION_IGNITE];

  var buffList = [];
  var beforeBuffListLength = this.buffList.length;
  for(var i=this.buffList.length-1; i>=0; i--){
    if(Date.now() - this.buffList[i].startTime > this.buffList[i].buffLifeTime){
      this.buffList.splice(i, 1);
    }else{
      buffs = util.getBuffs(this.buffList[i]);
      for(var j=0; j<buffs.length; j++){
        if(buffs[j].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_NORMAL && Date.now() - this.buffList[i].tickStartTime >= buffs[j].buffTickTime){
          if(buffs[j].fireUserCondition){
            if(this.conditions[buffs[j].fireUserCondition]){
              buffList.push(buffs[j]);
              // this.buffList[i].tickStartTime = Date.now();
            }
          }else{
            buffList.push(buffs[j]);
            // this.buffList[i].tickStartTime = Date.now();
          }
          if(j === buffs.length - 1){
            this.buffList[i].tickStartTime = Date.now();
          }
        }
      }
    }
  }

  this.conditions[gameConfig.USER_CONDITION_CHILL] = false;
  this.conditions[gameConfig.USER_CONDITION_FREEZE] = false;
  this.conditions[gameConfig.USER_CONDITION_IGNITE] = false;

  var buffIndex = buffList.length;
  if(buffIndex > 0){
    while(buffIndex--){
      switch (buffList[buffIndex].bufftype) {
        case serverConfig.BUFF_TYPE_SET_CONDITION:
          if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_CHILL){
            this.conditions[gameConfig.USER_CONDITION_CHILL] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_FREEZE){
            this.conditions[gameConfig.USER_CONDITION_FREEZE] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_IGNITE){
            this.conditions[gameConfig.USER_CONDITION_IGNITE] = buffList[buffIndex].actorID;
          }else{
            console.log('check buff index : ' + buffList[buffIndex]);
          }
          break;
      }
    }
  }

  var beforeMoveSpeed = this.moveSpeed;
  var beforeRotateSpeed = this.rotateSpeed;

  if(this.conditions[gameConfig.USER_CONDITION_FREEZE]){
    this.moveSpeed = 0;
    this.rotateSpeed = 0;
    this.castSpeed = 0;
  }else if(this.conditions[gameConfig.USER_CONDITION_CHILL]){
    var decreaseFactor = (100 - serverConfig.CONDITION_CHILL_DECREASE_RATE)/100;
    this.moveSpeed = this.moveSpeed * decreaseFactor;
    this.rotateSpeed = this.rotateSpeed * decreaseFactor;
    this.castSpeed = this.castSpeed * decreaseFactor;
  }
  if(this.moveSpeed > serverConfig.MAX_MOVE_SPEED){
    this.moveSpeed = serverConfig.MAX_MOVE_SPEED;
  }
  if(this.rotateSpeed > serverConfig.MAX_ROTATE_SPEED){
    this.rotateSpeed = serverConfig.MAX_ROTATE_SPEED;
  }
  this.setMaxSpeed(this.moveSpeed);
  this.setRotateSpeed(this.rotateSpeed);

  if( beforeConditionChill !== this.conditions[gameConfig.USER_CONDITION_CHILL] ||
      beforeConditionFreeze !== this.conditions[gameConfig.USER_CONDITION_FREEZE] ||
      beforeConditionIgnite !== this.conditions[gameConfig.USER_CONDITION_IGNITE]){
          this.onChangeStat(this);
  }
  if( beforeBuffListLength !== this.buffList.length){
    this.onBuffExchange(this);
  }
};
function regenIntervalHandler(){
  var timeRate = (Date.now() - this.regenTimer) / 1000;
  this.regenHP(timeRate);
  if(this.conditions[gameConfig.USER_CONDITION_IGNITE]){
    this.igniteHP(this.conditions[gameConfig.USER_CONDITION_IGNITE], timeRate);
  }
  this.regenTimer = Date.now();
};
