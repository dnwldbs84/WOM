var gameConfig = require('../public/gameConfig.json');
var serverConfig = require('./serverConfig.json');

var SkillCollider = function(user, skillData){
  this.id = user.objectID;
  this.index = skillData.index;
  this.x = skillData.targetPosition.x - skillData.explosionRadius;
  this.y = skillData.targetPosition.y - skillData.explosionRadius;
  this.width = skillData.explosionRadius * 2;
  this.height = skillData.explosionRadius * 2;

  this.type = skillData.type;

  this.fireDamage = 0;
  this.frostDamage = 0;
  this.arcaneDamage = 0;
  this.damageToMP = 0;
  setDamage.call(this, user, skillData);

  this.buffToTarget = skillData.buffToTarget;
  this.hitBuffList = skillData.hitBuffList;

  this.additionalBuffToTarget = null;
};

var ProjectileCollider = function(user, projectileData){
  this.id = user.objectID;
  this.index = projectileData.index;
  this.objectID = projectileData.objectID;
  this.x = projectileData.position.x;
  this.y = projectileData.position.y;
  this.width = projectileData.radius * 2;
  this.height = projectileData.radius * 2;

  this.speed = {
    x : projectileData.speed.x,
    y : projectileData.speed.y
  };

  this.type = projectileData.type;

  this.fireDamage = 0;
  this.frostDamage = 0;
  this.arcaneDamage = 0;
  this.damageToMP = 0;
  setDamage.call(this, user, projectileData);

  this.explosionDamageRate = projectileData.explosionDamageRate;

  this.buffToTarget = projectileData.buffToTarget;
  this.hitBuffList = projectileData.hitBuffList;

  this.additionalBuffToTarget = null;

  this.startTime = projectileData.startTime;
  this.lifeTime = projectileData.lifeTime;
  this.tickTime = projectileData.tickTime;
  this.explosionRadius = projectileData.explosionRadius;

  // this.isExplosive = true;
  this.isCollide = false;

  this.timer = Date.now();
  this.tickStartTime = Date.now();
};

ProjectileCollider.prototype = {
  move : function(){
    var deltaTime = (Date.now() - this.timer)/1000;
    this.x += this.speed.x * deltaTime;
    this.y += this.speed.y * deltaTime;
    this.timer = Date.now();
    if(this.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || this.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){
      if(Date.now() - this.tickStartTime > this.tickTime){
        this.isCollide = false;
        this.tickStartTime = Date.now();
      }
    }
  },
  isExpired : function(){
    if(Date.now() - this.startTime > this.lifeTime){
      return true;
    }
    return false;
  },
  explode : function(collisionPosition){
    var centerX = this.x + this.width/2;
    var centerY = this.y + this.height/2;

    if(this.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){
      this.fireDamage = this.fireDamage * this.explosionDamageRate/100;
      this.frostDamage = this.frostDamage * this.explosionDamageRate/100;
      this.arcaneDamage = this.arcaneDamage * this.explosionDamageRate/100;
    }
    this.width = this.explosionRadius * 2;
    this.height = this.explosionRadius * 2;
    if(collisionPosition){
      this.x = collisionPosition.x - this.explosionRadius;
      this.y = collisionPosition.y - this.explosionRadius;
    }else{
      this.x = centerX - this.explosionRadius;
      this.y = centerY - this.explosionRadius;
    }
  }
}

function setDamage(user, skillData){
  if(skillData.property === gameConfig.SKILL_PROPERTY_FIRE){
    this.fireDamage = (skillData.fireDamage + user.fireDamage) * user.damageRate/100 * user.fireDamageRate/100;
  }else if(skillData.property === gameConfig.SKILL_PROPERTY_FROST){
    this.frostDamage = (skillData.frostDamage + user.frostDamage) * user.damageRate/100 * user.frostDamageRate/100;
  }else if(skillData.property === gameConfig.SKILL_PROPERTY_ARCANE){
    this.arcaneDamage = (skillData.arcaneDamage + user.arcaneDamage) * user.damageRate/100 * user.arcaneDamageRate/100;
    if(skillData.doDamageToMP){
      this.damageToMP = this.arcaneDamage * skillData.damageToMPRate/100;
    }
  }else{
    console.log('check skill property');
  }
};

module.exports.SkillCollider = SkillCollider;
module.exports.ProjectileCollider = ProjectileCollider;
