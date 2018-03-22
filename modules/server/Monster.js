var LivingEntity = require('./LivingEntity.js');

var util = require('../public/util.js');
var SUtil = require('./ServerUtil.js');

var csvJson = require('../public/csvjson');
var objectAssign = require('../public/objectAssign');

var gameConfig = require('../public/gameConfig.json');
var serverConfig = require('./serverConfig.json');

var dataJson = require('../public/data.json');
var serverDataJson = require('./serverData.json');

var buffGroupTable = csvJson.toObject(dataJson.buffGroupData, {delimiter : ',', quote : '"'});
// var buffTable = csvJson.toObject(serverDataJson.buffData, {delimiter : ',', quote : '"'});

var INTERVAL_TIMER = 1000/10;

// var lastOrderTime = Date.now();
// var completeOrderTime = false;

function Monster(mobData, mobGenData){
  LivingEntity.call(this);
  this.index = mobData.index;
  this.name = mobData.mobName;

  this.mobGenType = mobGenData.mobGenType;

  this.isAttack = false;
  this.isDead = false;

  this.targetUserID = null;
  this.attackUsers = [];
  this.target = false;

  this.genPos = {x : mobGenData.genPosX, y : mobGenData.genPosY};
  this.maxMoveRange = mobGenData.maxMoveRange;
  this.freeMoveRange = mobGenData.freeMoveRange;
  this.autoAttackRange = mobGenData.autoAttackRange;
  this.attackRange = mobData.attackRange;
  this.maxHitRange = mobData.maxHitRange;

  this.baseMoveSpeed = mobData.moveSpeed;
  this.baseRotateSpeed = mobData.rotateSpeed;

  this.moveSpeed = mobData.moveSpeed;
  this.rotateSpeed = mobData.rotateSpeed;
  this.attackTime = mobData.attackTime;
  this.HP = mobData.maxHP;
  this.maxHP = mobData.maxHP;
  this.damage = mobData.damage;
  this.resistAll = mobData.resistAll;

  this.conditions = {};
  this.conditions[gameConfig.USER_CONDITION_CHILL] = false;
  this.conditions[gameConfig.USER_CONDITION_FREEZE] = false;
  this.conditions[gameConfig.USER_CONDITION_IGNITE] = false;

  this.buffList = [];
  this.passiveList = [];

  this.provideGold = 0;
  this.provideExp = 0;
  this.provideJewel = 0;
  this.provideScore = 0;
  this.golds = [];
  this.jewelCount = 0;
  this.skills = [];
  this.boxCount = 0;

  this.currentState = gameConfig.OBJECT_STATE_IDLE;

  this.updateInterval = false;
  this.buffUpdateInterval = false;
  this.attackTimeout = false;
  this.attackEndTimeout = false;
  // this.regenInterval = false;
  this.lastOrderTime = Date.now();
  this.findTargetTime = Date.now();
  this.completeOrderTime = false;

  this.updateFunction = new Function();
  this.timer = Date.now();
  this.regenTimer = Date.now();

  this.setMaxSpeed(this.moveSpeed);
  this.setRotateSpeed(this.rotateSpeed);

  this.onAttackUser = new Function();

  this.onMove = new Function();
  this.onBuffExchange = new Function();
  this.onTakeDamage = new Function();
  this.onDeath = new Function();

  this.onChangeState = new Function();
  this.onNeedToGetMobTargetPos = new Function();
  this.onNeedToGetMobDirection = new Function();
}
Monster.prototype = Object.create(LivingEntity.prototype);
Monster.prototype.constructor = Monster;

Monster.prototype.changeState = function(newState){
  this.currentState = newState;

  this.completeOrderTime = false;
  this.stop();
  switch (this.currentState) {
    case gameConfig.OBJECT_STATE_IDLE:
      this.completeOrderTime = Date.now();
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
Monster.prototype.setFreeMoveTargetPosition = function(){
  var addPosX = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * this.freeMoveRange);
  var addPosY = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * this.freeMoveRange);

  this.targetPosition = {
    x : this.genPos.x + addPosX,
    y : this.genPos.y + addPosY
  };
};
Monster.prototype.setTargetDirection = function(){
  util.setTargetDirection.call(this);
};
Monster.prototype.setSpeed = function(){
  util.setSpeed.call(this);
};
Monster.prototype.attack = function(){
  if(!this.isAttack && !this.conditions[gameConfig.USER_CONDITION_FREEZE]){
    this.isAttack = true;

    var self = this;
    this.attackTimeout = setTimeout(function(){
      self.onAttackUser(self);
    }, this.attackTime/2);
    this.attackEndTimeout = setTimeout(function(){
      self.changeState(gameConfig.OBJECT_STATE_IDLE);
      self.onChangeState(self);
    }, this.attackTime);
    this.doEveryTick();
  }
};
Monster.prototype.doEveryTick = function(){
  this.timer = Date.now();

  if(this.currentState !== gameConfig.OBJECT_STATE_ATTACK && !this.conditions[gameConfig.USER_CONDITION_FREEZE]){
    //update target
    var beforeTarget = this.target;
    this.target = false;
    for(var index in this.attackUsers){
      if(Date.now() - this.attackUsers[index].startTime > 180000){
        delete this.attackUsers[index];
      }else{
        if(this.target){
          if(this.attackUsers[index].damage > this.attackUsers[this.target].damage){
            this.target = index;
          }
        }else{
          this.target = index;
        }
      }
    }
    if(!this.target && Date.now() - this.findTargetTime > 500){
      this.findTargetTime = Date.now();

      var newTarget = this.onNeedToGetMobTarget(this, this.autoAttackRange);
      if(newTarget && !(newTarget in this.attackUsers)){
        this.attackUsers[newTarget] = {
          damage : 0,
          startTime : Date.now()
        };
        this.target = newTarget;
      }
    }
    if(this.target && Date.now() - this.lastOrderTime > 1000){
      this.lastOrderTime = Date.now();
      this.completeOrderTime = false;

      var targetPosition = {x : this.genPos.x, y : this.genPos.y};
      var newPos = this.onNeedToGetMobTargetPos(this);
      if(newPos){
        targetPosition = newPos;
      }else{
        delete this.attackUsers[this.target];
        this.target = false;
      }

      //distance check
      var distanceSquare = Math.pow(targetPosition.x - this.genPos.x, 2) + Math.pow(targetPosition.y - this.genPos.y, 2);
      if(distanceSquare > Math.pow(this.maxMoveRange, 2)){
        if(this.target){
          delete this.attackUsers[this.target];
          this.target = false;
        }
        targetPosition = {x : this.genPos.x, y : this.genPos.y};
      }

      distanceSquare = Math.pow(targetPosition.x - this.center.x, 2) + Math.pow(targetPosition.y - this.center.y, 2);
      if(this.target && distanceSquare < Math.pow(this.attackRange, 2)){
        // this.targetPosition = targetPosition;
        var direction = this.onNeedToGetMobDirection(this);
        if(direction){
          this.direction = direction;
        }
        this.setCenter();
        // this.setTargetDirection();
        // this.setSpeed();
        this.changeState(gameConfig.OBJECT_STATE_ATTACK);

        this.onChangeState(this);
      }else{
        this.targetPosition = targetPosition;
        this.setCenter();
        this.setTargetDirection();
        this.setSpeed();
        this.changeState(gameConfig.OBJECT_STATE_MOVE);

        this.onChangeState(this);
      }
    }else if(beforeTarget !== this.target || (this.timer - this.lastOrderTime > 10000) || (this.completeOrderTime && this.timer - this.completeOrderTime > 2000)){
      this.lastOrderTime = Date.now();
      this.completeOrderTime = false;
      if(this.target){
        var targetPosition = {x : this.genPos.x, y : this.genPos.y};
        var newPos = this.onNeedToGetMobTargetPos(this);
        if(newPos){
          targetPosition = newPos;
        }else{
          delete this.attackUsers[this.target];
          this.target = false;
        }
        //distance check
        var distanceSquare = Math.pow(targetPosition.x - this.genPos.x, 2) + Math.pow(targetPosition.y - this.genPos.y, 2);
        if(distanceSquare > Math.pow(this.maxMoveRange, 2)){
          if(this.target){
            delete this.attackUsers[this.target];
            this.target = false;
          }
          targetPosition = {x : this.genPos.x, y : this.genPos.y};
        }

        distanceSquare = Math.pow(targetPosition.x - this.center.x, 2) + Math.pow(targetPosition.y - this.center.y, 2);
        if(this.target && distanceSquare < Math.pow(this.attackRange, 2)){
          // this.targetPosition = targetPosition;
          var direction = this.onNeedToGetMobDirection(this);
          if(direction){
            this.direction = direction;
          }
          this.setCenter();
          // this.setTargetDirection();
          // this.setSpeed();
          this.changeState(gameConfig.OBJECT_STATE_ATTACK);

          this.onChangeState(this);
        }else{
          this.targetPosition = targetPosition;
          this.setCenter();
          this.setTargetDirection();
          this.setSpeed();
          this.changeState(gameConfig.OBJECT_STATE_MOVE);

          this.onChangeState(this);
        }
      }else{
        this.setFreeMoveTargetPosition();
        this.setCenter();
        this.setTargetDirection();
        this.setSpeed();
        this.changeState(gameConfig.OBJECT_STATE_MOVE);

        this.onChangeState(this);
      }
    }
  }
};
Monster.prototype.stop = function(){
  this.isAttack = false;
  if(this.updateInterval){
    clearInterval(this.updateInterval);
    this.updateInterval = false;
  }
  if(this.attackTimeout){
    clearTimeout(this.attackTimeout);
    this.attackTimeout = false;
    clearTimeout(this.attackEndTimeout);
    this.attackEndTimeout = false;
  }
};
Monster.prototype.takeDamage = function(attackUserID, damage, skillIndex){
  var dmg = damage * (1 - this.resistAll/100);
  if(dmg < 0 || !util.isNumeric(dmg)){
    dmg = 1;
  }

  this.HP -= dmg;
  if(attackUserID in this.attackUsers){
    this.attackUsers[attackUserID].damage += dmg;
    this.attackUsers[attackUserID].startTime = Date.now();
  }else{
    this.attackUsers[attackUserID] = {
      damage : dmg,
      startTime : Date.now()
    };
  }

  this.onTakeDamage(this, skillIndex);
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
Monster.prototype.igniteHP = function(attackUserID, timeRate){
  var igniteDamage = timeRate * this.maxHP * serverConfig.IGNITE_DAMAGE_RATE/100;
  this.takeDamage(attackUserID, igniteDamage);
};
Monster.prototype.initDropData = function(dropData){
  this.provideGold = dropData.provideGold;
  this.provideExp = dropData.provideExp;
  this.provideJewel = dropData.provideJewel;
  this.provideScore = dropData.provideScore;

  var goldCount = Math.floor(Math.random() * (dropData.goldDropMaxCount - dropData.goldDropMinCount + 1) + dropData.goldDropMinCount);
  for(var i=0; i<goldCount; i++){
    var goldAmount = Math.floor(Math.random() * (dropData.goldDropMax - dropData.goldDropMin + 1) + dropData.goldDropMin);
    this.golds.push(goldAmount);
  }
  var isJewelDrop = dropData.jewelDropCheckRate > Math.floor((Math.random() * 100)) ? true : false;
  if(isJewelDrop){
    var jewelCount = Math.floor(Math.random() * (dropData.jewelDropMaxCount - dropData.jewelDropMinCount + 1) + dropData.jewelDropMinCount);
    this.jewelCount = jewelCount;
  }

  var isBoxDrop = dropData.boxDropCheckRate > Math.floor((Math.random() * 100)) ? true : false;
  if(isBoxDrop){
    var boxCount = Math.floor(Math.random() * (dropData.boxDropMaxCount - dropData.boxDropMinCount + 1) + dropData.boxDropMinCount);
    this.boxCount = boxCount;
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
      switch (buffList[buffIndex].buffType) {
        case serverConfig.BUFF_TYPE_SET_CONDITION:
          if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_CHILL){
            this.conditions[gameConfig.USER_CONDITION_CHILL] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_FREEZE){
            this.conditions[gameConfig.USER_CONDITION_FREEZE] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_IGNITE){
            this.conditions[gameConfig.USER_CONDITION_IGNITE] = buffList[buffIndex].actorID;
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
  }else if(this.conditions[gameConfig.USER_CONDITION_CHILL]){
    var decreaseFactor = (100 - serverConfig.CONDITION_CHILL_DECREASE_RATE)/100;
    this.moveSpeed = this.baseMoveSpeed * decreaseFactor;
    this.rotateSpeed = this.baseRotateSpeed * decreaseFactor;
  }else{
    this.moveSpeed = this.baseMoveSpeed;
    this.rotateSpeed = this.baseRotateSpeed;
  }
  if(this.moveSpeed > serverConfig.MAX_MOVE_SPEED){
    this.moveSpeed = serverConfig.MAX_MOVE_SPEED;
  }
  if(this.rotateSpeed > serverConfig.MAX_ROTATE_SPEED){
    this.rotateSpeed = serverConfig.MAX_ROTATE_SPEED;
  }
  this.setMaxSpeed(this.moveSpeed);
  this.setRotateSpeed(this.rotateSpeed);

  if( this.conditions[gameConfig.USER_CONDITION_FREEZE] && beforeConditionFreeze !== this.conditions[gameConfig.USER_CONDITION_FREEZE]){
    this.changeState(gameConfig.OBJECT_STATE_IDLE);
  }
  if( beforeConditionChill !== this.conditions[gameConfig.USER_CONDITION_CHILL] ||
      beforeConditionFreeze !== this.conditions[gameConfig.USER_CONDITION_FREEZE] ||
      beforeConditionIgnite !== this.conditions[gameConfig.USER_CONDITION_IGNITE]){
          this.onChangeState(this);
  }

  if( beforeBuffListLength !== this.buffList.length){
    this.onBuffExchange(this);
  }
};
function regenIntervalHandler(){
  var timeRate = (Date.now() - this.regenTimer) / 1000;
  // this.regenHP(timeRate);
  if(this.conditions[gameConfig.USER_CONDITION_IGNITE]){
    this.igniteHP(this.conditions[gameConfig.USER_CONDITION_IGNITE], timeRate);
  }
  this.regenTimer = Date.now();
};
module.exports = Monster;
