var LivingEntity = require('./LivingEntity.js');

var util = require('../public/util.js');
var SUtil = require('./ServerUtil.js');

var csvJson = require('../public/csvjson');

var dataJson = require('../public/data.json');
var serverDataJson = require('./serverData.json');

var userStatTable = csvJson.toObject(dataJson.userStatData, {delimiter : ',', quote : '"'});
var skillTable = csvJson.toObject(dataJson.skillData, {delimiter : ',', quote : '"'});
var buffGroupTable = csvJson.toObject(dataJson.buffGroupData, {delimiter : ',', quote : '"'});
var buffTable = csvJson.toObject(serverDataJson.buffData, {delimiter : ',', quote : '"'});

// var userLevelDataTable = csvJson.toObject(dataJson.userLevelData, {delimiter : ',', quote : '"'});
var gameConfig = require('../public/gameConfig.json');
var serverConfig = require('./serverConfig.json');
var objectAssign = require('../public/objectAssign');

// var INTERVAL_TIMER = 1000/serverConfig.INTERVAL;
var INTERVAL_TIMER = 1000/20;

function User(socketID, userName, userStat, userBase, exp){
  LivingEntity.call(this);
  // base setting;
  this.name = userName;

  this.timeDiff = 0;
  this.latency = 0;

  this.type = userStat.type;

  this.totalKillCount = 0;
  this.killCount = 0;
  this.killScore = 0;
  this.skillScore = 0;
  this.chestScore = 0;

  this.score = 0;

  this.isDead = false;

  this.gold = 0;
  this.jewel = 0;

  this.cooldownSkills = [];
  //use when projectile tick and tick explosion
  this.skillTick = 0;

  this.pyroLevel = 1;
  this.frosterLevel = 1;
  this.mysterLevel = 1;
  this.pyroBaseSkill = gameConfig.SKILL_INDEX_PYRO_BASE;
  this.pyroInherentPassiveSkill = gameConfig.SKILL_INDEX_PYRO_PASSIVE;
  this.frosterBaseSkill = gameConfig.SKILL_INDEX_FROST_BASE;
  this.frosterInherentPassiveSkill = gameConfig.SKILL_INDEX_FROST_PASSIVE;
  this.mysterBaseSkill = gameConfig.SKILL_INDEX_ARCANE_BASE;
  this.mysterInherentPassiveSkill = gameConfig.SKILL_INDEX_ARCANE_PASSIVE;

  this.basePower = userStat.power;
  this.baseMagic = userStat.magic;
  this.baseSpeed = userStat.speed;

  this.statPower = 0;
  this.statMagic = 0;
  this.statSpeed = 0;

  this.baseHP = userBase.baseHP;
  this.baseMP = userBase.baseMP;
  this.baseHPRegen = userBase.baseHPRegen;
  this.baseMPRegen = userBase.baseMPRegen;
  this.baseHPRegenRate = userBase.baseHPRegenRate;
  this.baseMPRegenRate = userBase.baseMPRegenRate;
  this.baseMoveSpeed = userBase.baseMoveSpeed;
  this.baseRotateSpeed = userBase.baseRotateSpeed;
  this.baseCastSpeed = userBase.baseCastSpeed;
  this.baseDamage = userBase.baseDamage;
  this.baseFireDamage = userBase.baseFireDamage;
  this.baseFrostDamage = userBase.baseFrostDamage;
  this.baseArcaneDamage = userBase.baseArcaneDamage;
  this.baseDamageRate = userBase.baseDamageRate;
  this.baseFireDamageRate = userBase.baseFireDamageRate;
  this.baseFrostDamageRate = userBase.baseFrostDamageRate;
  this.baseArcaneDamageRate = userBase.baseArcaneDamageRate;
  this.baseResistAll = userBase.baseResistAll;
  this.baseResistFire = userBase.baseResistFire;
  this.baseResistFrost = userBase.baseResistFrost;
  this.baseResistArcane = userBase.baseResistArcane;
  this.baseReductionAll = userBase.baseReductionAll;
  this.baseReductionFire = userBase.baseReductionFire;
  this.baseReductionFrost = userBase.baseReductionFrost;
  this.baseReductionArcane = userBase.baseReductionArcane;
  this.baseCooldownReduceRate = userBase.baseCooldownReduceRate;

  this.level = 1;
  this.exp = exp;

  this.conditions = {};
  this.conditions[gameConfig.USER_CONDITION_IMMORTAL] = false;
  this.conditions[gameConfig.USER_CONDITION_CHILL] = false;
  this.conditions[gameConfig.USER_CONDITION_FREEZE] = false;
  this.conditions[gameConfig.USER_CONDITION_SILENCE] = false;
  this.conditions[gameConfig.USER_CONDITION_IGNITE] = false;
  this.conditions[gameConfig.USER_CONDITION_BLUR] = false;

  this.buffList = [];
  this.passiveList = [];
  this.auraList = [];

  //current stat
  this.maxHP = 0;  this.maxMP = 0;  this.HP = 0;  this.MP = 0;  this.HPRegen = 0;
  this.moveSpeed = 0; this.rotateSpeed = 0;
  this.MPRegen = 0;  this.moveSpeed = 0;  this.rotateSpeed = 0;  this.castSpeed = 0;
  this.damage = 0;  this.fireDamage = 0;  this.frostDamage = 0;  this.arcaneDamage = 0;
  this.damageRate = 0; this.fireDamageRate = 0; this.frostDamageRate = 0; this.arcaneDamageRate = 0;
  this.resistAll = 0;  this.resistFire = 0;  this.resistFrost = 0;  this.resistArcane = 0;
  this.reductionAll = 0;  this.reductionFire = 0;  this.reductionFrost = 0;  this.reductionArcane = 0;
  this.cooldownReduceRate = 0;

  this.regenTimer = Date.now();

  this.baseSkill = 0;
  // this.equipSkills = [];
  this.possessSkills = [];
  this.inherentPassiveSkill = 0;

  this.socketID = socketID;

  this.buffUpdateInterval = false;
  this.regenInterval = false;

  this.isEmitPortalPacket = false;

  this.onChangePrivateStat = new Function();
  this.onSkillUpgrade = new Function();
  this.onBuffExchange = new Function();
  this.onChangeStat = new Function();
  this.onTakeDamage = new Function();
  this.onReduceMP = new Function();
  this.onGetExp = new Function();
  this.onGetResource = new Function();
  this.onGetSkill = new Function();
  this.onSkillChangeToResource = new Function();

  this.onScoreChange = new Function();

  this.onLevelUP = new Function();
  this.onDeath = new Function();

  this.isGetTwitterReward = false;
  this.isGetFacebookReward = false;

  this.getExp(exp);
  this.initStat();
  this.updateCharTypeSkill();

  //cheat var
  this.isTeleported = false;
  this.isUsePortal = false;
};
User.prototype = Object.create(LivingEntity.prototype);
User.prototype.constructor = User;

User.prototype.setName = function(name){
  this.name = name;
};
User.prototype.setSkills = function(baseSkill, possessSkills, inherentPassiveSkill){
  this.baseSkill = baseSkill;
  // this.equipSkills = equipSkills;
  this.possessSkills = possessSkills;
  this.inherentPassiveSkill = inherentPassiveSkill;
};
//init user current stat
User.prototype.initStat = function(){
  this.statPower = this.basePower;
  this.statMagic = this.baseMagic;
  this.statSpeed = this.baseSpeed;

  this.maxHP = this.baseHP + gameConfig.STAT_CALC_FACTOR_POWER_TO_HP * this.statPower;
  this.maxMP = this.baseMP + gameConfig.STAT_CALC_FACTOR_MAGIC_TO_MP * this.statMagic;
  this.HPRegen = this.baseHPRegen + this.maxHP * this.baseHPRegenRate/100 + gameConfig.STAT_CALC_FACTOR_POWER_TO_HP_REGEN * this.statPower;
  this.MPRegen = this.baseMPRegen + this.maxMP * this.baseMPRegenRate/100 + gameConfig.STAT_CALC_FACTOR_MAGIC_TO_MP_REGEN * this.statMagic;
  this.castSpeed = this.baseCastSpeed + gameConfig.STAT_CALC_FACTOR_SPEED_TO_CAST_SPEED * this.statSpeed;
  this.damage = this.baseDamage;
  this.fireDamage = this.baseFireDamage;
  this.frostDamage = this.baseFrostDamage;
  this.arcaneDamage = this.baseArcaneDamage;
  this.damageRate = this.baseDamageRate + gameConfig.STAT_CALC_FACTOR_POWER_TO_DAMAGE_RATE * this.statPower;
  this.fireDamageRate = this.baseFireDamageRate;
  this.frostDamageRate = this.baseFrostDamageRate;
  this.arcaneDamageRate = this.baseArcaneDamageRate;
  this.resistAll = this.baseResistAll + gameConfig.STAT_CALC_FACTOR_MAGIC_TO_RESISTANCE * this.statMagic;
  this.resistFire = this.baseResistFire;
  this.resistFrost = this.baseResistFrost;
  this.resistArcane = this.baseResistArcane;
  this.reductionAll = this.baseReductionAll;
  this.reductionFire = this.baseReductionFire;
  this.reductionFrost = this.baseReductionFrost;
  this.reductionArcane = this.baseReductionArcane;
  this.cooldownReduceRate = this.baseCooldownReduceRate + gameConfig.STAT_CALC_FACTOR_SPEED_TO_COOLDOWN_REDUCE_RATE * this.statSpeed;

  this.HP = this.maxHP;
  this.MP = this.maxMP;

  this.moveSpeed = this.baseMoveSpeed;
  this.rotateSpeed = this.baseRotateSpeed;

  this.setMaxSpeed(this.moveSpeed);
  this.setRotateSpeed(this.rotateSpeed);
};
User.prototype.updateCharTypeLevel = function(){
  var inherentLevel = Math.floor(this.level * 0.8);
  switch (this.type) {
    case gameConfig.CHAR_TYPE_FIRE:
      this.pyroLevel = this.level;
      break;
    case gameConfig.CHAR_TYPE_FROST:
      this.frosterLevel = this.level;
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      this.mysterLevel = this.level;
      break;
  }
  if(this.pyroLevel < inherentLevel){
    this.pyroLevel = inherentLevel;
  }
  if(this.frosterLevel < inherentLevel){
    this.frosterLevel = inherentLevel;
  }
  if(this.mysterLevel < inherentLevel){
    this.mysterLevel = inherentLevel;
  }
};
User.prototype.updateCharTypeSkill = function(){
  var baseSkillLevel = objectAssign({}, util.findData(skillTable, 'index', this.baseSkill)).level;
  var basePassiveSkillLevel = objectAssign({}, util.findData(skillTable, 'index', this.inherentPassiveSkill)).level;
  var transmissionBaseSkillLevel = Math.floor(baseSkillLevel * 0.8);
  var transmissionPassiveSkillLevel = Math.floor(basePassiveSkillLevel * 0.8);
  switch (this.type) {
    case gameConfig.CHAR_TYPE_FIRE:
      this.pyroBaseSkill = this.baseSkill;
      this.pyroInherentPassiveSkill = this.inherentPassiveSkill;
      break;
    case gameConfig.CHAR_TYPE_FROST:
      this.frosterBaseSkill = this.baseSkill;
      this.frosterInherentPassiveSkill = this.inherentPassiveSkill;
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      this.mysterBaseSkill = this.baseSkill;
      this.mysterInherentPassiveSkill = this.inherentPassiveSkill;
      break;
  }
  var pyroBaseSkillData = objectAssign({}, util.findData(skillTable, 'index', this.pyroBaseSkill));
  var pyroPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', this.pyroInherentPassiveSkill));
  var frosterBaseSkillData = objectAssign({}, util.findData(skillTable, 'index', this.frosterBaseSkill));
  var frosterPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', this.frosterInherentPassiveSkill));
  var mysterBaseSkillData = objectAssign({}, util.findData(skillTable, 'index', this.mysterBaseSkill));
  var mysterPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', this.mysterInherentPassiveSkill));
  if(pyroBaseSkillData.level < transmissionBaseSkillLevel){
    this.pyroBaseSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', pyroBaseSkillData.groupIndex, 'level', transmissionBaseSkillLevel)).index;
  }
  if(pyroPassiveSkillData.level < transmissionPassiveSkillLevel){
    this.pyroInherentPassiveSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', pyroPassiveSkillData.groupIndex, 'level', transmissionPassiveSkillLevel)).index;
  }
  if(frosterBaseSkillData.level < transmissionBaseSkillLevel){
    this.frosterBaseSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', frosterBaseSkillData.groupIndex, 'level', transmissionBaseSkillLevel)).index;
  }
  if(frosterPassiveSkillData.level < transmissionPassiveSkillLevel){
    this.frosterInherentPassiveSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', frosterPassiveSkillData.groupIndex, 'level', transmissionPassiveSkillLevel)).index;
  }
  if(mysterBaseSkillData.level < transmissionBaseSkillLevel){
    this.mysterBaseSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', mysterBaseSkillData.groupIndex, 'level', transmissionBaseSkillLevel)).index;
  }
  if(mysterPassiveSkillData.level < transmissionPassiveSkillLevel){
    this.mysterInherentPassiveSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', mysterPassiveSkillData.groupIndex, 'level', transmissionPassiveSkillLevel)).index;
  }
};
User.prototype.updateStatAndCondition = function(){
  var additionalPower = 0, additionalMagic = 0, additionalSpeed = 0,
      additionalMaxHP = 0, additionalMaxMP = 0, additionalMaxHPRate = 100, additionalMaxMPRate = 100,
      additionalHPRegen = 0, additionalHPRegenRate = 0, additionalMPRegen = 0, additionalMPRegenRate = 0,
      additionalMoveSpeedRate = 100, additionalRotateSpeedRate = 100, additionalCastSpeedRate = 0,
      additionalDamage = 0, additionalFireDamage = 0, additionalFrostDamage = 0, additionalArcaneDamage = 0,
      additionalDamageRate = 0, additionalFireDamageRate = 0, additionalFrostDamageRate = 0, additionalArcaneDamageRate = 0,
      additionalResistAll = 0, additionalResistFire = 0, additionalResistFrost = 0, additionalResistArcane = 0,
      additionalReductionAll = 0, additionalReductionFire = 0, additionalReductionFrost = 0, additionalReductionArcane = 0,
      additionalCooldownReduceRate = 0;;

  var additionalHP = 0; additionalMP = 0;

  var disperBuffCount = 0;
  var disperDebuffCount = 0;
  var disperAllCount = 0;

  var beforeConditionImmortal = this.conditions[gameConfig.USER_CONDITION_IMMORTAL];
  var beforeConditionChill = this.conditions[gameConfig.USER_CONDITION_CHILL];
  var beforeConditionFreeze = this.conditions[gameConfig.USER_CONDITION_FREEZE];
  var beforeConditionSilence = this.conditions[gameConfig.USER_CONDITION_SILENCE];
  var beforeConditionIgnite = this.conditions[gameConfig.USER_CONDITION_IGNITE];
  var beforeConditionBlur = this.conditions[gameConfig.USER_CONDITION_BLUR];

  var buffList = [];

  //set inherent passive buffs
  if(this.inherentPassiveSkill){
    var inherentPassiveBuffGroupIndex = objectAssign({}, util.findData(skillTable, 'index', this.inherentPassiveSkill)).buffToSelf;
    var inherentPassiveBuffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', inherentPassiveBuffGroupIndex));
    var buffs = SUtil.findAndSetBuffs(inherentPassiveBuffGroupData, this.objectID);
    for(var i=0; i<buffs.length; i++){
      if(buffs[i].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_NORMAL){
        if(buffs[i].fireUserCondition){
          if(this.conditions[buffs[i].fireUserCondition]){
            buffList.push(buffs[i]);
          }
        }else{
          buffList.push(buffs[i]);
        }
      }
    }
  }
  //set passive buffs
  for(var i=0; i<this.passiveList.length; i++){
    buffs = SUtil.findAndSetBuffs(this.passiveList[i], this.objectID);
    for(var j=0; j<buffs.length; j++){
      if(buffs[j].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_NORMAL){
        if(buffs[j].fireUserCondition){
          if(this.conditions[buffs[j].fireUserCondition]){
            buffList.push(buffs[j]);
          }
        }else{
          buffList.push(buffs[j]);
        }
      }
    }
  }
  //set aura buffs
  for(var i=0; i<this.auraList.length; i++){
    buffs = SUtil.findAndSetBuffs(this.auraList[i], this.objectID);
    for(var j=0; j<buffs.length; j++){
      buffList.push(buffs[j]);
    }
  }
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

  this.conditions[gameConfig.USER_CONDITION_IMMORTAL] = false;
  this.conditions[gameConfig.USER_CONDITION_CHILL] = false;
  this.conditions[gameConfig.USER_CONDITION_FREEZE] = false;
  this.conditions[gameConfig.USER_CONDITION_SILENCE] = false;
  this.conditions[gameConfig.USER_CONDITION_IGNITE] = false;
  this.conditions[gameConfig.USER_CONDITION_BLUR] = false;

  var buffIndex = buffList.length;
  if(buffIndex > 0){
    while(buffIndex--){
      // skillData.buffsToSelf = util.findAndSetBuffs(skillData, buffTable, 'buffToSelf', 3, user.objectID);
      switch (buffList[buffIndex].buffType) {
        case serverConfig.BUFF_TYPE_ADD_STAT:
          if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_STAT_POWER){
            additionalPower += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_STAT_MAGIC){
            additionalMagic += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_STAT_SPEED){
            additionalSpeed += buffList[buffIndex].buffAmount;
          }else{
            console.log('check buff index : ' + buffList[buffIndex]);
          }
          break;
        case serverConfig.BUFF_TYPE_ADD_SECONDARY_STAT:
          if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_MAX_HP){
            additionalMaxHP += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_MAX_MP){
            additionalMaxMP += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_MAX_HP_RATE){
            additionalMaxHPRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_MAX_MP_RATE){
            additionalMaxMPRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_HP_REGEN){
            additionalHPRegen += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_HP_REGEN_RATE){
            additionalHPRegenRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_MP_REGEN){
            additionalMPRegen += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_MP_REGEN_RATE){
            additionalMPRegenRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_MOVE_SPEED_RATE){
            //add MoveSpeed and RotateSpeed
            additionalMoveSpeedRate += buffList[buffIndex].buffAmount;
            additionalRotateSpeedRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_CAST_SPEED_RATE){
            additionalCastSpeedRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_DAMAGE){
            additionalDamage += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FIRE_DAMAGE){
            additionalFireDamage += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FROST_DAMAGE){
            additionalFrostDamage += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_ARCANE_DAMAGE){
            additionalArcaneDamage += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_DAMAGE_RATE){
            additionalDamageRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FIRE_DAMAGE_RATE){
            additionalFireDamageRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FROST_DAMAGE_RATE){
            additionalFrostDamageRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_ARCANE_DAMAGE_RATE){
            additionalArcaneDamageRate += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_RESIST_ALL){
            additionalResistAll += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_RESIST_FIRE){
            additionalResistFire += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_RESIST_FROST){
            additionalResistFrost += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_RESIST_ARCANE){
            additionalResistArcane += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_REDUCTION_ALL){
            additionalReductionAll += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_REDUCTION_FIRE){
            additionalReductionFire += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_REDUCTION_FROST){
            additionalReductionFrost += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_REDUCTION_ARCANE){
            additionalReductionArcane += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_DAMAGE_RATE_BY_LIFE){
            var rateOfLife = 100 - (this.HP/this.maxHP) * 100;
            var rate = parseInt(rateOfLife / buffList[buffIndex].buffApplyHPTickPercent);
            additionalDamageRate += rate * buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_MOVE_SPEED_BY_LIFE){
            var rateOfLife = 100 - (this.HP/this.maxHP) * 100;
            var rate = parseInt(rateOfLife / buffList[buffIndex].buffApplyHPTickPercent);
            additionalMoveSpeedRate += rate * buffList[buffIndex].buffAmount;
            additionalRotateSpeedRate += rate * buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_COOLDOWN_REDUCE_RATE){
            additionalCooldownReduceRate += buffList[buffIndex].buffAmount;
          }else{
            console.log('check buff index : ' + buffList[buffIndex]);
          }
          break;
        case serverConfig.BUFF_TYPE_HEAL:
          if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_HEAL_HP){
            additionalHP += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_HEAL_HP_RATE){
            additionalHP += this.maxHP * buffList[buffIndex].buffAmount/100;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_HEAL_MP){
            additionalMP += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_HEAL_MP_RATE){
            additionalMP += this.maxMP * buffList[buffIndex].buffAmount/100;
          }else{
            console.log('check buff index : ' + buffList[buffIndex]);
          }
          break;
        case serverConfig.BUFF_TYPE_DISPEL:
          if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_DISPEL_BUFF){
            disperBuffCount += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_DISPEL_DEBUFF){
            disperDebuffCount += buffList[buffIndex].buffAmount;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_DISPEL_ALL){
            disperAllCount += buffList[buffIndex].buffAmount;
          }else{
            console.log('check buff index : ' + buffList[buffIndex]);
          }
          break;
        case serverConfig.BUFF_TYPE_SET_CONDITION:
          if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_IMMORTAL){
            this.conditions[gameConfig.USER_CONDITION_IMMORTAL] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_CHILL){
            this.conditions[gameConfig.USER_CONDITION_CHILL] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_FREEZE){
            this.conditions[gameConfig.USER_CONDITION_FREEZE] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_SILENCE){
            this.conditions[gameConfig.USER_CONDITION_SILENCE] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_IGNITE){
            this.conditions[gameConfig.USER_CONDITION_IGNITE] = buffList[buffIndex].actorID;
          }else if(buffList[buffIndex].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_BLUR){
            this.conditions[gameConfig.USER_CONDITION_BLUR] = buffList[buffIndex].actorID;
          }else{
            console.log('check buff index : ' + buffList[buffIndex]);
          }
          break;
        default:
          console.log('check buff index : ' + buffList[buffIndex]);
          break;
      }
    }
  }

  //disper apply
  for(var i=0; i<disperBuffCount; i++){
    if(this.buffList.length){
      for(var j=0; j<this.buffList.length; j++){
        if(this.buffList[j].isBuff){
          this.buffList.splice(j, 1);
          break;
        }
      }
    }else{
      break;
    }
  }
  for(var i=0; i<disperDebuffCount; i++){
    if(this.buffList.length){
      for(var j=0; j<this.buffList.length; j++){
        if(!this.buffList[j].isBuff){
          this.buffList.splice(j, 1);
          break;
        }
      }
    }else{
      break;
    }
  }
  for(var i=0; i<disperAllCount; i++){
    if(this.buffList.length){
      this.buffList.splice[0, 1];
    }else{
      break;
    }
  }

  var beforeStatPower = this.statPower, beforeStatMagic = this.statMagic, beforeStatSpeed = this.baseSpeed;

  this.statPower = this.basePower + additionalPower;
  this.statMagic = this.baseMagic + additionalMagic;
  this.statSpeed = this.baseSpeed + additionalSpeed;

  var beforeMaxHP = this.maxHP;
  var beforeMaxMP = this.maxMP;
  var beforeHP = this.HP;
  var beforeMP = this.MP;
  var beforeCastSpeed = this.castSpeed;
  var beforeMoveSpeed = this.moveSpeed;
  var beforeRotateSpeed = this.rotateSpeed;
  var beforeCooldownReduceRate = this.cooldownReduceRate;

  var beforeDamageRate = this.damageRate;
  var beforeFireDamageRate = this.fireDamageRate;
  var beforeFrostDamageRate = this.frostDamageRate;
  var beforeArcaneDamageRate = this.arcaneDamageRate;
  var beforeResistAll = this.resistAll;
  var beforeResistFire = this.resistFire;
  var beforeResistFrost = this.resistFrost;
  var beforeResistArcane = this.resistArcane;

  this.maxHP = (this.baseHP + gameConfig.STAT_CALC_FACTOR_POWER_TO_HP * this.statPower + additionalMaxHP) * additionalMaxHPRate/100;
  this.maxMP = (this.baseMP + gameConfig.STAT_CALC_FACTOR_MAGIC_TO_MP * this.statMagic + additionalMaxMP) * additionalMaxMPRate/100;
  var HPRegenRate = this.baseHPRegenRate + additionalHPRegenRate;
  var MPRegenRate = this.baseMPRegenRate + additionalMPRegenRate;
  this.HPRegen = this.baseHPRegen + gameConfig.STAT_CALC_FACTOR_POWER_TO_HP_REGEN * this.statPower + additionalHPRegen + this.maxHP * HPRegenRate/100;
  this.MPRegen = this.baseMPRegen + gameConfig.STAT_CALC_FACTOR_MAGIC_TO_MP_REGEN * this.statMagic + additionalMPRegen + this.maxMP * MPRegenRate/100;
  this.castSpeed = this.baseCastSpeed + additionalCastSpeedRate + gameConfig.STAT_CALC_FACTOR_SPEED_TO_CAST_SPEED * this.statSpeed;
  this.damage = this.baseDamage + additionalDamage;
  this.fireDamage = this.baseFireDamage + additionalFireDamage;
  this.frostDamage = this.baseFrostDamage + additionalFrostDamage;
  this.arcaneDamage = this.baseArcaneDamage + additionalArcaneDamage;
  this.damageRate = this.baseDamageRate + additionalDamageRate + gameConfig.STAT_CALC_FACTOR_POWER_TO_DAMAGE_RATE * this.statPower;
  this.fireDamageRate = this.baseFireDamageRate + additionalFireDamageRate;
  this.frostDamageRate = this.baseFrostDamageRate + additionalFrostDamageRate;
  this.arcaneDamageRate = this.baseArcaneDamageRate + additionalArcaneDamageRate;
  this.resistAll = this.baseResistAll + additionalResistAll + gameConfig.STAT_CALC_FACTOR_MAGIC_TO_RESISTANCE * this.statMagic;
  this.resistFire = this.baseResistFire + additionalResistFire;
  this.resistFrost = this.baseResistFrost + additionalResistFrost;
  this.resistArcane = this.baseResistArcane + additionalResistArcane;
  this.reductionAll = this.baseReductionAll + additionalReductionAll;
  this.reductionFire = this.baseReductionFire + additionalReductionFire;
  this.reductionFrost = this.baseReductionFrost + additionalReductionFrost;
  this.reductionArcane = this.baseReductionArcane + additionalReductionArcane;
  this.cooldownReduceRate = this.baseCooldownReduceRate  + additionalCooldownReduceRate + gameConfig.STAT_CALC_FACTOR_SPEED_TO_COOLDOWN_REDUCE_RATE * this.statSpeed;

  this.moveSpeed = this.baseMoveSpeed * additionalMoveSpeedRate/100;
  this.rotateSpeed = this.baseRotateSpeed * additionalRotateSpeedRate/100;

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
  if(this.conditions[gameConfig.USER_CONDITION_BLUR]){
    this.moveSpeed = 0;
    this.rotateSpeed = 0;
    this.castSpeed = 0;
  }
  if(this.moveSpeed > serverConfig.MAX_MOVE_SPEED){
    this.moveSpeed = serverConfig.MAX_MOVE_SPEED;
  }
  if(this.rotateSpeed > serverConfig.MAX_ROTATE_SPEED){
    this.rotateSpeed = serverConfig.MAX_ROTATE_SPEED;
  }

  if(additionalHP){
    this.healHP(additionalHP);
  }
  if(additionalMP){
    this.healMP(additionalMP);
  }

  this.setMaxSpeed(this.moveSpeed);
  this.setRotateSpeed(this.rotateSpeed);

  if( beforeConditionImmortal !== this.conditions[gameConfig.USER_CONDITION_IMMORTAL] || beforeConditionChill !== this.conditions[gameConfig.USER_CONDITION_CHILL] ||
      beforeConditionFreeze !== this.conditions[gameConfig.USER_CONDITION_FREEZE] || beforeConditionSilence !== this.conditions[gameConfig.USER_CONDITION_SILENCE] ||
      beforeConditionIgnite !== this.conditions[gameConfig.USER_CONDITION_IGNITE] || beforeConditionBlur !== this.conditions[gameConfig.USER_CONDITION_BLUR] ||
      beforeMaxHP !== this.maxHP  || beforeMaxMP !== this.maxMP  ||
      beforeHP !== this.HP || beforeMP !== this.MP || beforeCastSpeed !== this.castSpeed || beforeMoveSpeed !== this.moveSpeed || beforeRotateSpeed !== this.rotateSpeed){
        this.onChangeStat(this);
  }
  if( beforeBuffListLength !== this.buffList.length){
    this.onBuffExchange(this);
  }

  if( beforeDamageRate !== this.damageRate || beforeFireDamageRate !== this.fireDamageRate || beforeFrostDamageRate !== this.frostDamageRate
      || beforeArcaneDamageRate !== this.arcaneDamageRate || beforeResistAll !== this.resistAll || beforeResistFire !== this.resistFire
      || beforeResistFrost !== this.resistFrost || beforeResistArcane !== this.resistArcane
      || beforeStatPower !== this.statPower || beforeStatMagic !== this.statMagic || beforeStatSpeed !== this.statSpeed
      || beforeCooldownReduceRate !== this.cooldownReduceRate){
    this.onChangePrivateStat(this);
  }
};
User.prototype.regenHPMP = function(timeRate){
  var beforeHP = this.HP;
  var beforeMP = this.MP;
  this.healHP(this.HPRegen * timeRate);
  this.healMP(this.MPRegen * timeRate);
  if(beforeHP !== this.HP || beforeMP !== this.MP){
    this.onChangeStat(this);
  }
};
User.prototype.igniteHP = function(attackUserID, timeRate){
  var igniteDamage = timeRate * this.maxHP * serverConfig.IGNITE_DAMAGE_RATE/100;
  this.takeDamage(attackUserID, igniteDamage);
  // this.takeDamage(igniteDamage);
};
// User.prototype.buffUpdate = function(){
//   if(!this.buffUpdateInterval){
//     this.buffUpdateInterval = setInterval(buffUpdateHandler.bind(this), INTERVAL_TIMER);
//   }
//   if(!this.regenInterval){
//     this.regenInterval = setInterval(regenIntervalHandler.bind(this), serverConfig.USER_REGEN_TIMER);
//   }
// };
function buffUpdateHandler(){
  this.updateStatAndCondition();
};
function regenIntervalHandler(){
  var timeRate = (Date.now() - this.regenTimer) / 1000;
  this.regenHPMP(timeRate);
  if(this.conditions[gameConfig.USER_CONDITION_IGNITE]){
    this.igniteHP(this.conditions[gameConfig.USER_CONDITION_IGNITE], timeRate);
  }
  this.regenTimer = Date.now();
};
User.prototype.addBuff = function(buffGroupIndex, actorID){
  //check apply rate with resist
  if(!this.isDead){
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
  }
};
User.prototype.addAura = function(buffGroupIndex){
  if(!this.isDead){
    var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupIndex));

    if(Object.keys(buffGroupData).length){
      this.auraList.push(buffGroupData);
      this.onBuffExchange(this);
    }
  }
};
User.prototype.doEmitPortalPacket = function(){
  this.isEmitPortalPacket = true;
  var thisUser = this;
  setTimeout(function(){
    thisUser.isEmitPortalPacket = false;
  }, 1000);
};
// //Instantiate base attack
// User.prototype.changeEquipSkills = function(newSkillList){
//   var skillList = [];
//   //validate skill
//   for(var i=0; i<newSkillList.length; i++){
//     for(var j=0; j<possessSkills.length; j++){
//       if(newSkillList[i] === possessSkills[j]){
//         skillList.push(newSkillList[i]);
//       }
//     }
//   }
//   this.equipSkills = skillList;
// };
User.prototype.getSkill = function(index){
  //check skill possession
  var skillData = objectAssign({}, util.findData(skillTable, 'index', index));
  if(Object.keys(skillData).length){
    var possessSkill = false;
    for(var i=0; i<this.possessSkills.length; i++){
      var tempSkillData = objectAssign({}, util.findData(skillTable, 'index', this.possessSkills[i]));
      if(skillData.groupIndex === tempSkillData.groupIndex){
        possessSkill = tempSkillData;
        break;
      }
    }
    if(!possessSkill){
      this.possessSkills.push(skillData.index);
      this.onGetSkill(this, index);
      return this.possessSkills;
    }else{
      var goldAmount = skillData.exchangeToGold;
      var jewelAmount = skillData.exchangeToJewel;
      if(util.isNumeric(goldAmount)){
        this.gold += goldAmount;
      }
      if(util.isNumeric(jewelAmount)){
        this.jewel += jewelAmount;
      }
      this.onSkillChangeToResource(this, index);
    }
    // if(possessSkill.nextSkillIndex !== -1){
    //   var changeSkillIndex = this.possessSkills.indexOf(possessSkill.index);
    //   if(changeSkillIndex === -1){
    //     console.log('cant find skill index at possess skill array');
    //     return this.possessSkills;
    //   }else{
    //     this.possessSkills[changeSkillIndex] = possessSkill.nextSkillIndex;
    //     console.log('level up skill' + possessSkill.index);
    //     console.log('currentPossessSkills');
    //     console.log(this.possessSkills);
    //     return this.possessSkills;
    //   }
    // }else{
    //   //do nothing
    //   console.log('skill reach max level');
    // }
    this.calcUserScore();
  }
};
User.prototype.upgradeSkill = function(skillIndex){
  //check possess skill
  var isBaseSkill = false;
  var isInherentSkill = false;
  var isPossession = false;
  if(this.baseSkill === skillIndex){
    isBaseSkill = true;
  }
  if(this.inherentPassiveSkill === skillIndex){
    isInherentSkill = true;
  }
  for(var i=0; i<this.possessSkills.length; i++){
    if(this.possessSkills[i] === skillIndex){
      isPossession = true;
    }
  }
  var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
  if(Object.keys(skillData).length){
    var nextSkillIndex = skillData.nextSkillIndex;
    if(isBaseSkill || isInherentSkill || isPossession){
      if(nextSkillIndex !== -1){
        if(this.gold >= skillData.upgradeGoldAmount && this.jewel >= skillData.upgradeJewelAmount){
          this.gold -= skillData.upgradeGoldAmount;
          this.jewel -= skillData.upgradeJewelAmount;
          if(isBaseSkill){
            this.baseSkill = nextSkillIndex;
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
            this.updateCharTypeSkill();
          }else if(isInherentSkill){
            this.inherentPassiveSkill = nextSkillIndex;
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
            this.updateCharTypeSkill();
          }else if(isPossession){
            var index = this.possessSkills.indexOf(skillIndex);
            this.possessSkills.splice(index, 1);
            this.possessSkills.push(nextSkillIndex);
            //check equip passive
            for(var i=0; i<this.passiveList.length; i++){
              var buffGroupIndex = skillData.buffToSelf;
              if(this.passiveList[i].index === buffGroupIndex){
                var nextBuffGroupIndex = objectAssign({}, util.findData(skillTable, 'index', nextSkillIndex)).buffToSelf;
                var nextBuffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', nextBuffGroupIndex));
                this.passiveList.splice(i, 1, nextBuffGroupData);
                break;
              }
            }
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
          }
        }else{
          //need more resource maybe cheat?
          console.log('cheating!!!');
        }
      }else{
        // console.log('skill reach max level');
      }
    }else{
      //upgrade other type skill on standing scene
      if(nextSkillIndex !== -1){
        if(this.gold >= skillData.upgradeGoldAmount && this.jewel >= skillData.upgradeJewelAmount){
          if(this.pyroBaseSkill === skillIndex){
            this.gold -= skillData.upgradeGoldAmount;
            this.jewel -= skillData.upgradeJewelAmount;
            this.pyroBaseSkill = nextSkillIndex;
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
          }else if(this.pyroInherentPassiveSkill === skillIndex){
            this.gold -= skillData.upgradeGoldAmount;
            this.jewel -= skillData.upgradeJewelAmount;
            this.pyroInherentPassiveSkill = nextSkillIndex;
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
          }else if(this.frosterBaseSkill === skillIndex){
            this.gold -= skillData.upgradeGoldAmount;
            this.jewel -= skillData.upgradeJewelAmount;
            this.frosterBaseSkill = nextSkillIndex;
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
          }else if(this.frosterInherentPassiveSkill === skillIndex){
            this.gold -= skillData.upgradeGoldAmount;
            this.jewel -= skillData.upgradeJewelAmount;
            this.frosterInherentPassiveSkill = nextSkillIndex;
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
          }else if(this.mysterBaseSkill === skillIndex){
            this.gold -= skillData.upgradeGoldAmount;
            this.jewel -= skillData.upgradeJewelAmount;
            this.mysterBaseSkill = nextSkillIndex;
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
          }else if(this.mysterInherentPassiveSkill === skillIndex){
            this.gold -= skillData.upgradeGoldAmount;
            this.jewel -= skillData.upgradeJewelAmount;
            this.mysterInherentPassiveSkill = nextSkillIndex
            this.onSkillUpgrade(this, skillIndex, nextSkillIndex);
          }else{
            console.log('dont possess skill : ' + skillIndex);
          }
        }else{
          //need more resource maybe cheat?
          console.log('cheating!!!');
        }
      }else if(nextSkillIndex === -1){
        // console.log('skill reach max level');
      }
    }
    this.onBuffExchange(this);
    this.calcUserScore();
  }
};
User.prototype.exchangePassive = function(beforeBuffGID, afterBuffGID){
  var beforeBuffGroupDate = objectAssign({}, util.findData(buffGroupTable, 'index', beforeBuffGID));
  var afterBuffGroupDate = objectAssign({}, util.findData(buffGroupTable, 'index', afterBuffGID));
  for(var i=0; i<this.passiveList.length; i++){
    if(this.passiveList[i].index === beforeBuffGroupDate.index){
      var index = i;
      break;
    }
  }
  if(index >= 0){
    this.passiveList.splice(index, 1);
  }
  if(Object.keys(afterBuffGroupDate).length){
    this.passiveList.push(afterBuffGroupDate);
  }
  this.onBuffExchange(this);
}
User.prototype.equipPassives = function(buffGroupIndexList){
  this.passiveList = [];
  for(var i=0; i<buffGroupIndexList.length; i++){
    var isDuplicate = false;
    for(var j=0; j<this.passiveList.length; j++){
      if(this.passiveList[j].index === buffGroupIndexList[i]){
        isDuplicate = true;
        break;
      }
    }
    var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupIndexList[i]));
    if(!isDuplicate && Object.keys(buffGroupData).length){
      this.passiveList.push(buffGroupData);
    }
  }
  if(this.passiveList.length){
    this.onBuffExchange(this);
  }
};
User.prototype.equipPassive = function(buffGroupIndex){
  var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupIndex));
  this.passiveList.push(buffGroupData);
  this.onBuffExchange(this);
};
User.prototype.unequipPassive = function(buffGroupIndex){
  var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupIndex));
  for(var i=0; i<this.passiveList.length; i++){
    if(this.passiveList[i].index === buffGroupData.index){
      var index = i;
      break;
    }
  }
  if(index >= 0){
    this.passiveList.splice(index, 1);
  }
  this.onBuffExchange(this);
};
User.prototype.checkSkillPossession = function(skillIndex){
  if(this.baseSkill === skillIndex){
    return true;
  }
  for(var i=0; i<this.possessSkills.length; i++){
    if(this.possessSkills[i] === skillIndex){
      return true;
    }
  }
  console.log(Date.now());
  console.log('dont have skill');
  return false;
};
User.prototype.takeDamage = function(attackUserID, fireDamage, frostDamage, arcaneDamage, damageToMP, hitBuffList, skillIndex){
  if(!this.conditions[gameConfig.USER_CONDITION_IMMORTAL]){
    // if(this.conditions[gameConfig.USER_CONDITION_BLUR]){
    //   this.cancelBlur();
    // }
    var additionalDamage = 0,
    additionalFireDamage = 0,
    additionalFrostDamage = 0,
    additionalArcaneDamage = 0,
    additionalDamageRate = 100,
    additionalFireDamageRate = 100,
    additionalFrostDamageRate = 100,
    additionalArcaneDamageRate = 100;
    if(hitBuffList){
      var buffList = [];
      for(var i=0; i<hitBuffList.length; i++){
        var buffs = SUtil.findAndSetBuffs(hitBuffList[i], attackUserID);
        for(var j=0; j<buffs.length; j++){
          if(buffs[j].buffAdaptTime === serverConfig.BUFF_ADAPT_TIME_FIRE_AND_HIT){
            if(buffs[j].hitUserCondition){
              if(this.conditions[buffs[j].hitUserCondition]){
                buffList.push(buffs[j]);
              }
            }else{
              buffList.push(buffs[j]);
            }
          }
        }
      }

      for(var i=0; i<buffList.length; i++){
        if(buffList[i].buffType === serverConfig.BUFF_TYPE_ADD_SECONDARY_STAT){
          if(buffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_DAMAGE){
            additionalDamage += buffList[i].buffAmount;
          }else if(buffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FIRE_DAMAGE){
            additionalFireDamage += buffList[i].buffAmount;
          }else if(buffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FROST_DAMAGE){
            additionalFrostDamage += buffList[i].buffAmount;
          }else if(buffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_ARCANE_DAMAGE){
            additionalArcaneDamage += buffList[i].buffAmount;
          }else if(buffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_DAMAGE_RATE){
            additionalDamageRate += buffList[i].buffAmount;
          }else if(buffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FIRE_DAMAGE_RATE){
            additionalFireDamageRate += buffList[i].buffAmount;
          }else if(buffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_FROST_DAMAGE_RATE){
            additionalFrostDamageRate += buffList[i].buffAmount;
          }else if(buffList[i].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_ADD_SECONDARY_STAT_ARCANE_DAMAGE_RATE){
            additionalArcaneDamageRate += buffList[i].buffAmount;
          }
        }
      }
    }

    var dmg = 0;
    var dmgToMP = 0;
    if(fireDamage && util.isNumeric(fireDamage)){
      var dmgFire = (fireDamage + additionalDamage + additionalFireDamage - (this.reductionAll + this.reductionFire)) * additionalDamageRate/100 * additionalFireDamageRate/100 * (1 - this.resistAll/100) * (1 - this.resistFire/100) ;
      if(dmgFire <= 0){
        dmgFire = 1;
      }
      dmg += dmgFire;
    }
    if(frostDamage && util.isNumeric(frostDamage)){
      var dmgFrost = (frostDamage + additionalDamage + additionalFrostDamage - (this.reductionAll + this.reductionFrost)) * additionalDamageRate/100 * additionalFrostDamageRate/100 * (1 - this.resistAll/100) * (1 - this.resistFrost/100);
      if(dmgFrost <= 0){
        dmgFrost = 1;
      }
      dmg += dmgFrost;
    }
    if(arcaneDamage && util.isNumeric(arcaneDamage)){
      var dmgArcane = (arcaneDamage + additionalDamage + additionalArcaneDamage - (this.reductionAll + this.reductionArcane)) * additionalDamageRate/100 * additionalFrostDamageRate/100 * (1 - this.resistAll/100) * (1 - this.resistArcane/100);
      if(dmgArcane <= 0){
        dmgArcane = 1 ;
      }
      dmg += dmgArcane;
      if(util.isNumeric(damageToMP)){
        dmgToMP = damageToMP;
      }
    }
    if(dmg <= 0){
      //minimum damage
      dmg = 1;
    }

    this.HP -= dmg;
    this.onTakeDamage(this, dmg, skillIndex);
    if(dmgToMP > 0){
      this.takeDamageToMP(dmgToMP);
    }
    if(this.HP <= 0){
      this.death(attackUserID);
    }
  }
};
// User.prototype.takeDamage = function(attackUserID, dmg){
//   console.log(this);
//   this.HP -= dmg;
//   console.log(this.objectID + ' : ' + this.HP);
//   if(this.HP <= 0){
//     this.death(attackUserID);
//   }
// };
User.prototype.consumeMP = function(mpAmount){
  this.MP -= mpAmount;
  if(this.MP < 0){
    this.MP = 0;
  }
  this.onReduceMP(this);
};
User.prototype.takeDamageToMP = function(dmgToMP){
  if(dmgToMP > 0){
    this.MP -= dmgToMP;
    if(this.MP < 0){
      this.MP = 0;
    }
    this.onReduceMP(this);
  }
};
User.prototype.healHPMP = function(hpAmount, mpAmount){
  var beforeHP = this.HP;
  var beforeMP = this.MP;
  if(util.isNumeric(hpAmount)){
    this.healHP(hpAmount);
  }
  if(util.isNumeric(mpAmount)){
    this.healMP(mpAmount)
  }
  if(beforeHP !== this.HP || beforeMP !== this.MP){
    this.onChangeStat(this);
  }
};
User.prototype.healHP = function(amount){
  if(this.maxHP < this.HP + amount){
    this.HP = this.maxHP;
  }else{
    this.HP += amount;
  }
};
User.prototype.healMP = function(amount){
  if(this.maxMP < this.MP + amount){
    this.MP = this.maxMP;
  }else{
    this.MP += amount;
  }
};
User.prototype.death = function(attackUserID){
  //calculate exp to attacker
  if(!this.isDead){
    this.isDead = true;
    this.clearAll();

    this.onDeath(this, attackUserID, this.objectID, this.name);
    this.setPosition(-2000, -2000);
  }
};
User.prototype.decreaseLevel = function(level){
  this.level = level;
  this.exp = 0;
};
User.prototype.decreaseResource = function(rate, goldReductionMin, jewelReductionMin){
  var loseGoldAmount = Math.floor(this.gold * rate / 100) > goldReductionMin ? Math.floor(this.gold * rate / 100) : goldReductionMin;
  var loseJewelAmount = Math.floor(this.jewel * rate / 100) > jewelReductionMin ? Math.floor(this.jewel * rate / 100) : jewelReductionMin;

  if(loseGoldAmount > this.gold){
    loseGoldAmount = this.gold;
  }
  if(loseJewelAmount > this.jewel){
    loseJewelAmount = this.jewel;
  }
  this.gold -= loseGoldAmount;
  this.jewel -= loseJewelAmount;
  return{
    goldLoseAmount : loseGoldAmount,
    jewelLoseAmount : loseJewelAmount
  };
};
User.prototype.lossSkills = function(lossRate){
  var rand = Math.random() * 100;
  if(lossRate > rand){
    var lossSkillCount = Math.floor(this.skillScore / serverConfig.SKILL_LOSS_PER_SKILL_SCORE);
    if(lossSkillCount){
      var skillListOverLevel2 = [];
      var baseSkillData = objectAssign({}, util.findData(skillTable, 'index', this.baseSkill));
      if(baseSkillData.level > 1){
        skillListOverLevel2.push(baseSkillData);
      }
      var inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', this.inherentPassiveSkill));
      if(inherentPassiveSkillData.level > 1){
        skillListOverLevel2.push(inherentPassiveSkillData);
      }
      var allPossessSkills = []
      for(var i=0; i<this.possessSkills.length; i++){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', this.possessSkills[i]));
        allPossessSkills.push(skillData);
        if(skillData.level > 1){
          skillListOverLevel2.push(skillData);
        }
      }
      lossSkillCount = lossSkillCount > skillListOverLevel2.length ? skillListOverLevel2.length : lossSkillCount;
      if(lossSkillCount && skillListOverLevel2.length){
        var beforeSkills = [];
        var lossSkillList = [];
        var repeatCount = 1;
        for(var i=0; i<lossSkillCount; i++){
          var randomIndex = Math.floor(Math.random() * skillListOverLevel2.length);

          var beforeSkill = skillListOverLevel2[randomIndex];
          if(beforeSkill.level !== 1){
            var wasLossSkill = false;
            var doLoss = true;
            for(var j=0; j<lossSkillList.length; j++){
              if(lossSkillList[j].groupIndex === beforeSkill.groupIndex){
                wasLossSkill = true;
              }
            }
            if(wasLossSkill){
              var randForLoss = Math.floor(Math.random() * 100);
              if(randForLoss > serverConfig.SKILL_DUPLICATE_LOSS_RATE){
                doLoss = false;
              }
            }

            if(doLoss){
              // if(randomIndex !== 0 && randomIndex !== 1){
              if(beforeSkill.groupIndex !== baseSkillData.groupIndex && beforeSkill.groupIndex !== inherentPassiveSkillData.groupIndex){
                //except base and passive skill
                beforeSkills.push(beforeSkill);
              }
              lossSkillList.push(beforeSkill);

              var afterSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', beforeSkill.groupIndex, 'nextSkillIndex', beforeSkill.index));
              skillListOverLevel2.splice(randomIndex, 1, afterSkill);
            }else{
              //if dont decrease, repeat tenTimes
              if(repeatCount > 10){
                repeatCount = 1;
              }else{
                i--;
                repeatCount++;
              }
            }
          }else{
            //if dont decrease, repeat tenTimes
            if(repeatCount > 10){
              repeatCount = 1;
            }else{
              i--;
              repeatCount++;
            }
          }
        }
        if(skillListOverLevel2[0].groupIndex === baseSkillData.groupIndex){
          this.baseSkill = skillListOverLevel2[0].index;
        }

        for(var i=0; i<skillListOverLevel2.length; i++){
          if(skillListOverLevel2[i].groupIndex === inherentPassiveSkillData.groupIndex){
            this.inherentPassiveSkill = skillListOverLevel2[i].index;
            break;
          }
        }
        for(var i=0; i<skillListOverLevel2.length; i++){
          for(var j=0; j<allPossessSkills.length; j++){
            if(allPossessSkills[j].groupIndex === skillListOverLevel2[i].groupIndex){
              allPossessSkills.splice(j, 1, skillListOverLevel2[i]);
              break;
            }
          }
        }
        this.possessSkills = [];
        for(var i=0; i<allPossessSkills.length; i++){
          this.possessSkills.push(allPossessSkills[i].index);
        }

        //set attackUser`s skill at beforeSkills
        if(beforeSkills.length){
          var index = Math.floor(Math.random() * beforeSkills.length);
          var attackUserSkillData = beforeSkills[index];
          //set level to 1
          var attackUserSkillIndex = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', attackUserSkillData.groupIndex, 'level', 1)).index;
        }

        var lossSkills = [];
        for(var i=0; i<lossSkillList.length; i++){
          lossSkills.push(lossSkillList[i].index);
        }

        return {
          baseSkill : this.baseSkill,
          inherentPassiveSkill : this.inherentPassiveSkill,
          possessSkills : this.possessSkills,
          lostSkills : lossSkills,

          attackUserSkill : attackUserSkillIndex || 0
        };
      }
    }
  }
  return false;
};
// User.prototype.cancelBlur = function(){
//   for(var i=this.buffList.length - 1; i>=0; i--){
//     var buffs = util.findAndSetBuffs(this.buffList[i], buffTable, this.buffList[i].actorID);
//     for(var j=buffs.length-1; j>=0; j--){
//       if(buffs[j].buffType === serverConfig.BUFF_TYPE_SET_CONDITION && buffs[j].buffEffectType === serverConfig.BUFF_EFFECT_TYPE_SET_CONDITION_BLUR){
//         buffs[j].splice(j, 1);
//       }
//     }
//     if(!buffs.length){
//       this.buffList.splice(i, 1);
//     }
//   }
//   this.onChangeStat(this);
// };
User.prototype.getExp = function(exp, killScore, chestScore){
  if(!this.isDead){
    var userLevelData = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', this.type, 'level', this.level));
    if(userLevelData.needExp === -1){
      // console.log('user reach max level');
    }else{
      this.exp += exp;
      this.onGetExp(this, {type : gameConfig.GET_RESOURCE_TYPE_EXP, amount : exp});
    }
    if(userLevelData.needExp !== -1 && this.exp >= userLevelData.needExp){
      this.exp -= userLevelData.needExp;
      this.levelUp();
    }
    if(killScore){
      this.killCount ++;
      this.totalKillCount ++;
      this.killScore += killScore;
      this.calcUserScore();
      this.onScoreChange();
    }
    if(chestScore){
      this.chestScore += chestScore;
      this.calcUserScore();
      this.onScoreChange();
    }
    this.calcUserScore();
  }
};
User.prototype.getGold = function(goldAmount){
  if(util.isNumeric(goldAmount)){
    this.gold += goldAmount;
    this.onGetResource(this, {type : gameConfig.GET_RESOURCE_TYPE_GOLD, amount : goldAmount});
  }
  // this.calcUserScore();
};
User.prototype.getJewel = function(jewelAmount){
  if(util.isNumeric(jewelAmount)){
    this.jewel += jewelAmount;
    this.calcUserScore();
    this.onGetResource(this, {type : gameConfig.GET_RESOURCE_TYPE_JEWEL, amount : jewelAmount});
  }
};
User.prototype.addResource = function(gold, jewel){
  if(util.isNumeric(gold)){
    this.gold = gold;
  }
  if(util.isNumeric(jewel)){
    this.jewel = jewel;
  }
};
User.prototype.levelUp = function(){
  this.level ++;
  var userLevelData = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', this.type, 'level', this.level));
  //add levelBonus
  //additional level up check.
  this.updateUserBaseStat();
  // this.initStat();
  // this.restoreWhenLevelUp();
  // this.getExp(0);
  this.updateCharTypeLevel();

  var additionalLevelUp = false;
  if(userLevelData.needExp !== -1 && this.exp >= userLevelData.needExp){
    additionalLevelUp = true;
    this.exp -= userLevelData.needExp;
    this.levelUp();
  }
  if(!additionalLevelUp){
    this.onLevelUP(this);
    this.calcUserScore();
    this.onScoreChange();
    this.onChangePrivateStat(this);
    this.addBuff(serverConfig.LEVEL_UP_BUFF_INDEX, this.objectID);
  }
};
User.prototype.startUpdate = function(){
  this.isDead = false;
  if(!this.buffUpdateInterval){
    this.buffUpdateInterval = setInterval(buffUpdateHandler.bind(this), INTERVAL_TIMER);
  }
  if(!this.regenInterval){
    this.regenInterval = setInterval(regenIntervalHandler.bind(this), serverConfig.USER_REGEN_TIMER);
  }
};
User.prototype.setStat = function(levelData, baseData){
  this.type = levelData.type;

  this.basePower = levelData.power;
  this.baseMagic = levelData.magic;
  this.baseSpeed = levelData.speed;

  this.baseHP = baseData.baseHP;
  this.baseMP = baseData.baseMP;
  this.baseHPRegen = baseData.baseHPRegen;
  this.baseHPRegenRate = baseData.baseHPRegenRate;
  this.baseMPRegen = baseData.baseMPRegen;
  this.baseMPRegenRate = baseData.baseMPRegenRate;
  this.baseMoveSpeed = baseData.baseMoveSpeed;
  this.baseRotateSpeed = baseData.baseRotateSpeed;
  this.baseCastSpeed = baseData.baseCastSpeed;
  this.baseDamage = baseData.baseDamage;
  this.baseFireDamage = baseData.baseFireDamage;
  this.baseFrostDamage = baseData.baseFrostDamage;
  this.baseArcaneDamage = baseData.baseArcaneDamage;
  this.baseDamageRate = baseData.baseDamageRate;
  this.baseFireDamageRate = baseData.baseFireDamageRate;
  this.baseFrostDamageRate = baseData.baseFrostDamageRate;
  this.baseArcaneDamageRate = baseData.baseArcaneDamageRate;
  this.baseResistAll = baseData.baseResistAll;
  this.baseResistFire = baseData.baseResistFire;
  this.baseResistFrost = baseData.baseResistFrost;
  this.baseResistArcane = baseData.baseResistArcane;
  this.baseReductionAll = baseData.baseReductionAll;
  this.baseReductionFire = baseData.baseReductionFire;
  this.baseReductionFrost = baseData.baseReductionFrost;
  this.baseReductionArcane = baseData.baseReductionArcane;
  this.baseCooldownReduceRate = baseData.baseCooldownReduceRate;

  this.initStat();
};
User.prototype.setSkill = function(charType, baseSkill, passiveSkill){
  switch (charType) {
    case gameConfig.CHAR_TYPE_FIRE:
      if(this.pyroBaseSkill && this.pyroInherentPassiveSkill){
        this.baseSkill = this.pyroBaseSkill;
        this.inherentPassiveSkill = this.pyroInherentPassiveSkill;
      }else{
        this.baseSkill = baseSkill;
        this.inherentPassiveSkill = passiveSkill;
      }
      break;
    case gameConfig.CHAR_TYPE_FROST:
      if(this.frosterBaseSkill && this.frosterInherentPassiveSkill){
        this.baseSkill = this.frosterBaseSkill;
        this.inherentPassiveSkill = this.frosterInherentPassiveSkill
      }else{
        this.baseSkill = baseSkill;
        this.inherentPassiveSkill = passiveSkill;
      }
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      if(this.mysterBaseSkill && this.mysterInherentPassiveSkill){
        this.baseSkill = this.mysterBaseSkill;
        this.inherentPassiveSkill = this.mysterInherentPassiveSkill;
      }else{
        this.baseSkill = baseSkill;
        this.inherentPassiveSkill = passiveSkill;
      }
      break;
  }
};
User.prototype.getLevel = function(charType){
  switch (charType) {
    case gameConfig.CHAR_TYPE_FIRE:
      if(this.pyroLevel){
        this.level = this.pyroLevel;
      }else{
        this.level = 1;
      }
      break;
    case gameConfig.CHAR_TYPE_FROST:
      if(this.frosterLevel){
        this.level = this.frosterLevel;
      }else{
        this.level = 1;
      }
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      if(this.mysterLevel){
        this.level = this.mysterLevel;
      }else{
        this.level = 1;
      }
      break;
  }
  return this.level;
};
User.prototype.getBaseSkill = function(charType){
  switch (charType) {
    case gameConfig.CHAR_TYPE_FIRE:
      return this.pyroBaseSkill;
    case gameConfig.CHAR_TYPE_FROST:
      return this.frosterBaseSkill;
    case gameConfig.CHAR_TYPE_ARCANE:
      return this.mysterBaseSkill;
  }
};
User.prototype.getInherentPassiveSkill = function(charType){
  switch (charType) {
    case gameConfig.CHAR_TYPE_FIRE:
      return this.pyroInherentPassiveSkill;
    case gameConfig.CHAR_TYPE_FROST:
      return this.frosterInherentPassiveSkill;
    case gameConfig.CHAR_TYPE_ARCANE:
      return this.mysterInherentPassiveSkill;
  }
};
//execute when level up or down
User.prototype.updateUserBaseStat = function(){
  var userLevelData = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', this.type, 'level', this.level));

  this.basePower = userLevelData.power;
  this.baseMagic = userLevelData.magic;
  this.baseSpeed = userLevelData.speed;
};
User.prototype.calcUserScore = function(){
  var levelScore = this.level  * serverConfig.SCORE_FACOTR_LEVEL;
  // var goldScore = this.gold * serverConfig.SCORE_FACTOR_GOLD;
  var jewelScore = this.jewel * serverConfig.SCORE_FACTOR_JEWEL;

  var skillScore = 0;
  var baseSkillData = objectAssign({}, util.findData(skillTable, 'index', this.baseSkill));
  skillScore += getSkillScoreFactor(baseSkillData.tier) * baseSkillData.level;
  var inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', this.inherentPassiveSkill));
  skillScore += getSkillScoreFactor(inherentPassiveSkillData.tier) * inherentPassiveSkillData.level;
  for(var i=0; i<this.possessSkills.length; i++){
    var skillData = objectAssign({}, util.findData(skillTable, 'index', this.possessSkills[i]));
    skillScore += getSkillScoreFactor(skillData.tier) * skillData.level;
  }
  this.skillScore = util.isNumeric(skillScore) ? skillScore : 0;
  this.score = this.skillScore + this.killScore + this.chestScore + levelScore + jewelScore - serverConfig.SCORE_FACTOR_START;
};
User.prototype.addSkillTick = function(){
  this.skillTick++;
};
User.prototype.setTimeDiff = function(timeDiff){
  this.timeDiff = timeDiff;
};
User.prototype.setLatency = function(lat){
  this.latency = lat;
};
//for cheatcheck
User.prototype.useTeleport = function(){
  this.isTeleported = true;
  var thisUser = this;
  setTimeout(function(){
    thisUser.isTeleported = false;
  }, 1000);
};
User.prototype.usePortal = function(){
  this.isUsePortal = true;
  var thisUser = this;
  setTimeout(function(){
    thisUser.isUsePortal = false;
  }, 5000);
};
User.prototype.clearAll = function(){
  clearInterval(this.buffUpdateInterval);
  clearInterval(this.regenInterval);
  this.buffUpdateInterval = false;
  this.regenInterval = false;

  this.buffList = [];
  this.passiveList = [];

  this.killScore = 0;
  this.killCount = 0;
  this.chestScore = 0;
};
User.prototype.setReconnectLevel = function(level, exp){
  this.level = level;
  this.exp = exp;

  if(level > 3){
    this.pyroLevel = level - 2;
    this.frosterLevel = level - 2;
    this.mysterLevel = level -2;
  }
};
User.prototype.setReconnectSkills = function(baseSkill, passiveSkill, possessSkills){
  this.baseSkill = baseSkill;
  this.inherentPassiveSkill = passiveSkill;
  this.possessSkills = possessSkills;
  switch (this.type) {
    case gameConfig.CHAR_TYPE_FIRE:
      this.pyroBaseSkill = baseSkill;
      this.pyroInherentPassiveSkill = passiveSkill;
      break;
    case gameConfig.CHAR_TYPE_FROST:
      this.frosterBaseSkill = baseSkill;
      this.frosterInherentPassiveSkill = passiveSkill;
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      this.mysterBaseSkill = baseSkill;
      this.mysterInherentPassiveSkill = passiveSkill;
      break;
  }
};
User.prototype.setReconnectScore = function(killCount, totalKillCount){
  this.killCount = killCount;
  this.killScore = killCount * 500;
  this.totalKillCount = totalKillCount;
  this.calcUserScore();
};
User.prototype.setReconnectHPMP = function(HP, MP){
  if(util.isNumeric(HP)){
    if(this.maxHP > HP){
      this.HP = HP;
    }else{
      this.HP = this.maxHP;
    }
  }
  if(util.isNumeric(MP)){
    if(this.maxMP > MP){
      this.MP = MP;
    }else{
      this.MP = this.maxMP;
    }
  }
};
User.prototype.applyCooldown = function(skillData){
  var cooltime = skillData.cooldown * (100 - this.cooldownReduceRate) / 100 - 15;
  if(util.isNumeric(cooltime)){
    this.cooldownSkills.push(skillData.index);
    var thisCooldownSkills = this.cooldownSkills;
    var skillIndex = skillData.index;
    setTimeout(function(){
      var index = thisCooldownSkills.indexOf(skillIndex);
      if(index > -1){
        thisCooldownSkills.splice(index, 1);
      }
    }, cooltime);
  }
};
User.prototype.checkCooldown = function(skillData){
  for(var i=0; i<this.cooldownSkills.length; i++){
    if(this.cooldownSkills[i] === skillData.index){
      if(skillData.repeatCount){
        return true;
      }else{
        return false;
      }
    }
  }
  return true;
};
function getSkillScoreFactor(tier){
  switch (tier) {
    case 1:
      return serverConfig.SCORE_FACTOR_SKILL_TIER_1;
    case 2:
      return serverConfig.SCORE_FACTOR_SKILL_TIER_2;
    case 3:
      return serverConfig.SCORE_FACTOR_SKILL_TIER_3;
    case 4:
      return serverConfig.SCORE_FACTOR_SKILL_TIER_4;
    case 5:
      return serverConfig.SCORE_FACTOR_SKILL_TIER_5;
    default:
  }
};
module.exports = User;
