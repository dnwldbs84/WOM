var gameConfig = require('./gameConfig.json');
var radianFactor = Math.PI/180;
var objectAssign = require('../../modules/public/objectAssign.js');
// var msgpack = require('msgpack-js');
var msgpack = require('msgpack-lite');

//must use with bind or call method
exports.rotate = function(deltaTime){
  if(exports.isNumeric(this.rotateSpeed)){
    if(this.targetDirection === this.direction){
      if(this.currentState === gameConfig.OBJECT_STATE_MOVE || this.currentState === gameConfig.OBJECT_STATE_MOVE_AND_ATTACK){
        this.move(deltaTime);
      }else if(this.currentState === gameConfig.OBJECT_STATE_ATTACK){
      }else if(this.currentState === gameConfig.OBJECT_STATE_CAST){
        this.executeSkill();
      }
    }
    //check rotate direction
    else{
      if(this.direction > 0 && this.targetDirection < 0){
        if((180 - this.direction + 180 + this.targetDirection) < (this.direction - this.targetDirection)){
          if(Math.abs(this.targetDirection - this.direction) < this.rotateSpeed * deltaTime){
            this.direction += Math.abs(this.targetDirection - this.direction);
          }else{
            this.direction += this.rotateSpeed * deltaTime;
          }
        }else if(this.targetDirection < this.direction){
          if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
            this.direction -= Math.abs(this.targetDirection - this.direction);
          }else{
            this.direction -= this.rotateSpeed * deltaTime;
          }
        }
      }else if(this.direction < 0 && this.targetDirection >0 ){
        if((180 + this.direction + 180 - this.targetDirection) < (this.targetDirection - this.direction)){
          if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
            this.direction -= Math.abs(this.targetDirection - this.direction);
          }else{
            this.direction -= this.rotateSpeed * deltaTime;
          }
        }else if(this.targetDirection > this.direction){
          if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
            this.direction += Math.abs(this.targetDirection - this.direction);
          }else{
            this.direction += this.rotateSpeed * deltaTime;
          }
        }
      }else if(this.targetDirection > this.direction){
        if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
          this.direction += Math.abs(this.targetDirection - this.direction);
        }else{
          this.direction += this.rotateSpeed * deltaTime;
        }
      }else if(this.targetDirection < this.direction){
        if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
          this.direction -= Math.abs(this.targetDirection - this.direction);
        }else{
          this.direction -= this.rotateSpeed * deltaTime;
        }
      }
      if(this.currentState === gameConfig.OBJECT_STATE_MOVE || this.currentState === gameConfig.OBJECT_STATE_MOVE_AND_ATTACK){
        this.move(deltaTime, true);
      }
    }

    if(this.direction >= 180){
      this.direction -= 360;
    }else if(this.direction <= -180){
      this.direction += 360;
    }
  }
};

//must use with bind or call method
exports.move = function(deltaTime, isMoveSlight){
  //calculate dist with target
  if(exports.isNumeric(this.speed.x) && exports.isNumeric(this.speed.y)){
    var distX = this.targetPosition.x - this.center.x;
    var distY = this.targetPosition.y - this.center.y;

    var distSquare = Math.pow(distX, 2) + Math.pow(distY, 2);
    if(distSquare < 100 && this.currentState === gameConfig.OBJECT_STATE_MOVE_AND_ATTACK){
      this.executeSkill();
    }else if(distSquare < 100){
      this.stop();
      this.changeState(gameConfig.OBJECT_STATE_IDLE);
    }
    if(Math.abs(distX) < Math.abs(this.speed.x) * deltaTime){
      this.speed.x = distX / deltaTime;
    }
    if(Math.abs(distY) < Math.abs(this.speed.y) * deltaTime){
      this.speed.y = distY / deltaTime;
    }
    var addPos = this.onMove();
    if(addPos){
      if(exports.isNumeric(addPos.x) && exports.isNumeric(addPos.y)){
        this.position.x += addPos.x;
        this.position.y += addPos.y;
      }
    }
    if(isMoveSlight){
      this.position.x += this.speed.x * deltaTime * gameConfig.MOVE_SLIGHT_RATE;
      this.position.y += this.speed.y * deltaTime * gameConfig.MOVE_SLIGHT_RATE;
    }else{
      this.position.x += this.speed.x * deltaTime;
      this.position.y += this.speed.y * deltaTime;
    }

    if(this.position.x < 0){
      this.position.x = 0;
    }else if(this.position.x > gameConfig.CANVAS_MAX_SIZE.width - this.size.width){
      this.position.x = gameConfig.CANVAS_MAX_SIZE.width - this.size.width;
    }
    if(this.position.y < 0){
      this.position.y = 0;
    }else if(this.position.y > gameConfig.CANVAS_MAX_SIZE.height - this.size.height){
      this.position.y = gameConfig.CANVAS_MAX_SIZE.height - this.size.height;
    }

    this.setCenter();
    if(addPos){
      if(this.isMoveBackward){
        this.setTargetDirection(true);
        this.setSpeed(gameConfig.MOVE_BACK_WARD_SPEED_DECREASE_RATE);
      }else{
        this.setTargetDirection();
        this.setSpeed();
      }
    }
  }
};

//must use with bind or call method
//setup when click canvas for move
exports.setSpeed = function(decreaseRate){
  var distX = this.targetPosition.x - this.center.x;
  var distY = this.targetPosition.y - this.center.y;

  var distXSquare = Math.pow(distX,2);
  var distYSquare = Math.pow(distY,2);

  if(distX == 0  && distY ==0){
    this.speed.x = 0;
    this.speed.y = 0;
  }else if(distXSquare + distYSquare < 100){
    this.speed.x = distX;
    this.speed.y = distY;
  }else{
    this.speed.x = (distX>=0?1:-1)* this.maxSpeed * Math.sqrt(distXSquare / (distXSquare + distYSquare));
    this.speed.y = (distY>=0?1:-1)* this.maxSpeed * Math.sqrt(distYSquare / (distXSquare + distYSquare));
  }

  if(decreaseRate){
    this.speed.x *= (1 - decreaseRate);
    this.speed.y *= (1 - decreaseRate);
  }
};

//must use with bind or call method
// setup when click canvas for move or fire skill
exports.setTargetDirection = function(moveBackward){
  var distX = this.targetPosition.x - this.center.x;
  var distY = this.targetPosition.y - this.center.y;

  var tangentDegree = Math.atan(distY/distX) * 180 / Math.PI;
  if(isNaN(tangentDegree)){
    this.targetDirection = this.direction;
  }else{
    if(distX < 0 && distY >= 0){
      this.targetDirection = tangentDegree + 180;
    }else if(distX < 0 && distY < 0){
      this.targetDirection = tangentDegree - 180;
    }else{
      this.targetDirection = tangentDegree;
    }
  }

  if(moveBackward){
    if(this.targetDirection >= 0){
      this.targetDirection -= 180;
    }else{
      this.targetDirection += 180;
    }
  }
};
exports.setTargetPosition = function(clickPosition, user){
  var targetX = clickPosition.x;
  var targetY = clickPosition.y;
  if(targetX < user.size.width/2){
    targetX = user.size.width/2
  }else if(targetX > gameConfig.CANVAS_MAX_SIZE.width - user.size.width/2){
    targetX = gameConfig.CANVAS_MAX_SIZE.width - user.size.width/2;
  }

  if(targetY < user.size.height/2){
    targetY = user.size.height/2
  }else if(targetY > gameConfig.CANVAS_MAX_SIZE.height - user.size.height/2){
    targetY = gameConfig.CANVAS_MAX_SIZE.height - user.size.height/2;
  }

  return {
    x : Math.floor(targetX),
    y : Math.floor(targetY)
  };
};
exports.setMoveAttackUserTargetPosition = function(clickPosition, baseSkillData, user){
  var vecX = clickPosition.x - user.center.x;
  var vecY = clickPosition.y - user.center.y;
  var unitVecX = vecX / Math.sqrt(Math.pow(vecX, 2) + Math.pow(vecY, 2));
  var unitVecY = vecY / Math.sqrt(Math.pow(vecX, 2) + Math.pow(vecY, 2));

  var scale = baseSkillData.range;

  var distVecX = vecX - unitVecX * scale;
  var distVecY = vecY - unitVecY * scale;

  if(Math.sqrt(Math.pow(vecX, 2) + Math.pow(vecY, 2)) < scale){
    var moveBackward = true;
  }else{
    moveBackward = false;
  }
  return {
    x : user.center.x + distVecX,
    y : user.center.y + distVecY,
    moveBackward : moveBackward
  };
};
//check obstacle collision
exports.checkCircleCollision = function(tree, posX, posY, radius, id){
  var returnVal = [];
  var obj = {x : posX, y: posY, width: radius * 2, height: radius * 2, id: id};
  tree.onCollision(obj, function(item){
    if(obj.id !== item.id){
      var objCenterX = obj.x + radius;
      var objCenterY = obj.y + radius;

      var itemCenterX = item.x + item.width/2;
      var itemCenterY = item.y + item.height/2;

      // check sum of radius with item`s distance
      var distSquareDiff = Math.pow(radius + item.width/2,2) - Math.pow(itemCenterX - objCenterX,2) - Math.pow(itemCenterY - objCenterY,2);

      if(distSquareDiff > 0 ){
        returnVal.collisionPosition = {x : (objCenterX + itemCenterX) / 2,
                                       y : (objCenterY + itemCenterY) / 2};
        //collision occured
        returnVal.push(item);
      }
    }
  });
  return returnVal;
};
exports.calcCompelPos = function(obj, collisionObjs){
  var addPos = { x : 0 , y : 0 };
  for(var i=0; i<collisionObjs.length; i++){
    var objCenterX = obj.x + obj.width/2;
    var objCenterY = obj.y + obj.height/2;

    var itemCenterX = collisionObjs[i].x + collisionObjs[i].width/2;
    var itemCenterY = collisionObjs[i].y + collisionObjs[i].height/2;

    var vecX = objCenterX - itemCenterX;
    var vecY = objCenterY - itemCenterY;

    var dist = obj.width/2 + collisionObjs[i].width/2 - Math.sqrt(Math.pow(vecX,2) + Math.pow(vecY,2));
    var ratioXYSquare = Math.pow(vecY/vecX,2);

    var distFactorX = dist * Math.sqrt(1/(1+ratioXYSquare));
    var distFactorY = dist * Math.sqrt((ratioXYSquare) / (1 + ratioXYSquare));

    // 1.3 is make more gap between obj and collisionObjs
    addPos.x += (vecX > 0 ? 1 : -1) * distFactorX * 1.1;
    addPos.y += (vecY > 0 ? 1 : -1) * distFactorY * 1.1;
  }
  return addPos;
};

exports.checkAndCalcCompelPos = function(tree, posX, posY, radius, id, obj){
  var collisionObjs = [];
  var obj = {x : posX, y: posY, width:radius * 2, height: radius * 2, id: id};
  tree.onCollision(obj, function(item){
    if(obj.id !== item.id){
      var objCenterX = obj.x + obj.width/2;
      var objCenterY = obj.y + obj.height/2;

      var itemCenterX = item.x + item.width/2;
      var itemCenterY = item.y + item.height/2;

      // check sum of radius with item`s distance
      var distSquareDiff = Math.pow(obj.width/2 + item.width/2,2) - Math.pow(itemCenterX - objCenterX,2) - Math.pow(itemCenterY - objCenterY,2);

      if(distSquareDiff > 0 ){
        //collision occured
        collisionObjs.push(item);
      }
    }
  });
  var addPos = { x : 0 , y : 0 };
  for(var i in collisionObjs){
    var objCenterX = obj.x + obj.width/2;
    var objCenterY = obj.y + obj.height/2;

    var itemCenterX = collisionObjs[i].x + collisionObjs[i].width/2;
    var itemCenterY = collisionObjs[i].y + collisionObjs[i].height/2;

    var vecX = objCenterX - itemCenterX;
    var vecY = objCenterY - itemCenterY;

    var dist = obj.width/2 + collisionObjs[i].width/2 - Math.sqrt(Math.pow(vecX,2) + Math.pow(vecY,2));
    var ratioXYSquare = Math.pow(vecY/vecX,2);

    var distFactorX = dist * Math.sqrt(1/(1+ratioXYSquare));
    var distFactorY = dist * Math.sqrt((ratioXYSquare) / (1 + ratioXYSquare));

    // 1.3 is make more gap between obj and collisionObjs
    addPos.x += (vecX > 0 ? 1 : -1) * distFactorX * 1;
    addPos.y += (vecY > 0 ? 1 : -1) * distFactorY * 1;
  }
  return addPos;
};

//coordinate transform
exports.localToWorldPosition = function(position, offset){
  return {
    x : position.x + offset.x,
    y : position.y + offset.y
  };
};
exports.worldToLocalPosition = function(position, offset, scaleFactor){
  if(scaleFactor){
    return {
      x : (position.x - offset.x) * scaleFactor,
      y : (position.y - offset.y) * scaleFactor
    };
  }else{
    return {
      x : position.x - offset.x,
      y : position.y - offset.y
    };
  }
};
exports.worldXCoordToLocalX = function(x, offsetX, scaleFactor){
  return (x - offsetX) * scaleFactor;
};
exports.worldYCoordToLocalY = function(y, offsetY, scaleFactor){
  return (y - offsetY) * scaleFactor;
};
// exports.calculateOffset = function(obj, canvasSize){
//   var newOffset = {
//     x : obj.position.x + obj.size.width/2 - canvasSize.width/2,
//     y : obj.position.y + obj.size.height/2 - canvasSize.height/2
//   };
//   return newOffset;
// };
exports.isXInCanvas = function(x, gameConfig){
  if(x>0 && x<gameConfig.canvasSize.width){
    return true;
  }
  return false;
};
exports.isYInCanvas = function(y, gameConfig){
  if(y>0 && y<gameConfig.canvasSize.height){
    return true;
  }
  return false;
};
exports.isObjInCanvas = function(center, radius, gameConfig){
  if(center.x - (radius + 100) <= gameConfig.canvasSize.width && center.x + (radius + 100) >= 0
     && center.y - (radius + 100) <= gameConfig.canvasSize.height && center.y + (radius + 100) >= 0){
   return true;
 }
 return false;
};

//calcurate distance
exports.distanceSquare = function(position1, position2){
  var distX = position1.x - position2.x;
  var distY = position1.y - position2.y;

  var distSquare = Math.pow(distX, 2) + Math.pow(distY, 2);
  return distSquare;
};
exports.distance = function(position1, position2){
  var distSquare = exports.distanceSpuare(position1, position2);
  return Math.sqrt(distSquare);
};
//calcurate targetDirection;
exports.calcSkillTargetPosition = function(skillData, clickPosition, user){
  switch (skillData.type) {
    case gameConfig.SKILL_TYPE_INSTANT_RANGE:
      var addPosX = skillData.range * Math.cos(user.direction * radianFactor);
      var addPosY = skillData.range * Math.sin(user.direction * radianFactor);

      return {
        x : user.center.x + addPosX,
        y : user.center.y + addPosY
      };
    case gameConfig.SKILL_TYPE_INSTANT_PROJECTILE:
      return {
        x : clickPosition.x,
        y : clickPosition.y
      };
    case gameConfig.SKILL_TYPE_RANGE:
      var distSquare = exports.distanceSquare(user.center, clickPosition);
      if(Math.pow(skillData.range,2) > distSquare){
        return {
          x : clickPosition.x,
          y : clickPosition.y
        };
      }else{
        var distX = clickPosition.x - user.center.x;
        var distY = clickPosition.y - user.center.y;
        var radian = Math.atan(distY / distX);
        if(isNaN(radian)){
          radian = user.direction;
        }else if(distX < 0 && distY >= 0){
          radian += Math.PI;
        }else if(distX < 0 && distY < 0){
          radian -= Math.PI;
        }

        var addPosX = skillData.range * Math.cos(radian);
        var addPosY = skillData.range * Math.sin(radian);

        return {
          x : user.center.x + addPosX,
          y : user.center.y + addPosY
        };
      }
    case gameConfig.SKILL_TYPE_SELF :
      return {
        x : user.center.x,
        y : user.center.y
      };
    case gameConfig.SKILL_TYPE_SELF_EXPLOSION :
      return {
        x : user.center.x,
        y : user.center.y
      };
    case gameConfig.SKILL_TYPE_TELEPORT :
      var distSquare = exports.distanceSquare(user.center, clickPosition);
      if(Math.pow(skillData.range,2) > distSquare){
        return {
          x : clickPosition.x,
          y : clickPosition.y
        };
      }else{
        var distX = clickPosition.x - user.center.x;
        var distY = clickPosition.y - user.center.y;
        var radian = Math.atan(distY / distX);
        if(isNaN(radian)){
          radian = user.direction;
        }else if(distX < 0 && distY >= 0){
          radian += Math.PI;
        }else if(distX < 0 && distY < 0){
          radian -= Math.PI;
        }

        var addPosX = skillData.range * Math.cos(radian);
        var addPosY = skillData.range * Math.sin(radian);

        return {
          x : user.center.x + addPosX,
          y : user.center.y + addPosY
        };
      }
    case gameConfig.SKILL_TYPE_PROJECTILE :
      return {
        x : clickPosition.x,
        y : clickPosition.y
      };
    case gameConfig.SKILL_TYPE_PROJECTILE_TICK :
      return {
        x : clickPosition.x,
        y : clickPosition.y
      };
    case gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION :
      return {
        x : clickPosition.x,
        y : clickPosition.y
      };
    case gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION :
      return{
        x : clickPosition.x,
        y : clickPosition.y
      };
    default:
  }
};
exports.calcSkillTargetDirection = function(skillType, targetPosition, user){
  switch (skillType) {
    case gameConfig.SKILL_TYPE_INSTANT_RANGE:
      return user.direction;
    case gameConfig.SKILL_TYPE_INSTANT_PROJECTILE:
      return user.direction;
    case gameConfig.SKILL_TYPE_RANGE:
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_SELF :
      return user.direction;
    case gameConfig.SKILL_TYPE_SELF_EXPLOSION :
      return user.direction;
    case gameConfig.SKILL_TYPE_TELEPORT :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_PROJECTILE :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_PROJECTILE_TICK :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    default:
  }
};
exports.calcTargetDirection = function(targetPosition, centerPosition, userDirection){
  var distX = targetPosition.x - centerPosition.x;
  var distY = targetPosition.y - centerPosition.y;

  var tangentDegree = Math.atan(distY/distX) * 180 / Math.PI;

  var returnVal = 0;
  if(isNaN(tangentDegree)){
    return userDirection;
  }else{
    if(distX < 0 && distY >= 0){
      returnVal = tangentDegree + 180;
    }else if(distX < 0 && distY < 0){
      returnVal = tangentDegree - 180;
    }else{
      returnVal = tangentDegree;
    }
  }
  return returnVal;
};
exports.calcTargetPosition = function(centerPosition, direction, range){
  var addPosX = range * Math.cos(direction * radianFactor);
  var addPosY = range * Math.sin(direction * radianFactor);

  return {x : addPosX, y : addPosY};
};
//find last coincident data
exports.findData = function(table, columnName, value){
  try {
    if (table) {
      var data = undefined;
      for(var i=0; i<table.length; i++){
        if(table[i][columnName] == value){
          data = table[i];
          break;
        }
      }
      return data;
    }
  } catch (e) {
    console.log(e);
  }
  // for(var index in table){
  //   //use ==, because value can be integer
  //   if(table[index][columnName] == value){
  //     data = table[index];
  //     break;
  //   }
  // }
};
exports.findAllDatas = function(table, columnName, value){
  try {
    if (table) {
      var datas = [];
      for(var i=0; i<table.length; i++){
        if(table[i][columnName] == value){
          datas.push(table[i]);
        }
      }
      // for(var index in table){
        //   if(table[index][columnName] == value){
          //     datas.push(table[index]);
          //   }
          // }
      return datas;
    }
  } catch (e) {
    console.log(e);
  }
}
exports.findDataWithTwoColumns = function(table, columnName1, value1, columnName2, value2){
  var datas = [];
  var data = null;
  for(var i=0; i<table.length; i++){
    if(table[i][columnName1] == value1){
      datas.push(table[i]);
    }
  }
  if(datas.length > 0){
    for(var i=0; i<datas.length; i++){
      if(datas[i][columnName2] == value2){
        data = datas[i];
        break;
      }
    }
  }
  return data;
  // for(var index in table){
  //   if(table[index][columnName1] == value1){
  //     datas.push(table[index]);
  //   }
  // }
  // if(datas.length > 0){
  //   for(var index in datas){
  //     if(datas[index][columnName2] == value2){
  //       data = datas[index];
  //       break;
  //     }
  //   }
  // }else{
  //   return null;
  // }
  // return data;
}
exports.findAndSetBuffs = function(buffGroupData, buffTable, actorID){
  var returnVal = [];
  for(var i=0; i<10; i++){
    var buffIndex = buffGroupData['buff' + (i + 1)];
    if(buffIndex){
      var buffData = objectAssign({}, exports.findData(buffTable, 'index', buffIndex));
      buffData.actorID = actorID;
      returnVal.push(buffData);
    }else{
      return returnVal;
    }
  }
  return returnVal;
};
exports.getBuffs = function(buffGroupData){
  var returnVal = [];
  for(var i=0; i<10; i++){
    if(buffGroupData['buff' + (i + 1)]){
      returnVal.push(buffGroupData['buff' + (i + 1)]);
    }
  }
  return returnVal;
};
exports.getMobs = function(mobGenData, mobTable){
  var returnVal = [];
  for(var i=0; i<5; i++){
    if(mobGenData['genMob' + (i + 1)]){
      var mobData = exports.findData(mobTable, 'index', mobGenData['genMob' + (i + 1)]);
      returnVal.push(mobData);
    }
  }
  return returnVal;
};
exports.setResourceData = function(resourceTable, buffImgData){
  var resourceDataList = [];
  buffImgData.resourceLength = 0;
  for(var i=0; i<10; i++){
    var resourceIndex = buffImgData['resourceIndex' + (i + 1)];
    if(resourceIndex){
      var resourceData = objectAssign({}, exports.findData(resourceTable, 'index', resourceIndex));
      buffImgData['resourceIndex' + (i + 1)] = resourceData;
      buffImgData.resourceLength = i + 1;
    }else{
      break;
    }
  }
  if(buffImgData.resourceLength){
    return true;
  }else{
    return false;
  }
};
exports.makeUserEffect = function(user, effectData){
  //set effect center
  var effectCenter = { x : user.center.x, y : user.center.y };
  //set effect index
  var effectIndex = 0;
  //set effect
  var effect = {
    index : effectData.index,
    isRotate : effectData.isRotate,
    resourceIndex1 : effectData.resourceIndex1,
    resourceIndex2 : effectData.resourceIndex2,
    resourceIndex3 : effectData.resourceIndex3,
    resourceIndex4 : effectData.resourceIndex4,
    resourceIndex5 : effectData.resourceIndex5,
    resourceIndex6 : effectData.resourceIndex6,
    resourceIndex7 : effectData.resourceIndex7,
    resourceIndex8 : effectData.resourceIndex8,
    resourceIndex9 : effectData.resourceIndex9,
    resourceIndex10 : effectData.resourceIndex10,
    resourceLength : effectData.resourceLength,

    resourceLifeTime : effectData.resourceLifeTime,
    startTime : Date.now(),
    effectTimer : Date.now(),

    effectIndex : effectIndex,
    center : effectCenter,

    changeIndex : function(){
      if(this.effectIndex + 1 >= this.resourceLength){
        this.effectIndex = 0;
      }else{
        this.effectIndex++;
      }
      this.effectTimer = Date.now();
    }
  }
  return effect;
};
exports.generateRandomUniqueID = function(uniqueCheckArray, prefix, idCount){
  if(!idCount){
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
  }else if(idCount){
    var IDs = [];
    for(var i=0; i<idCount; i++){
      var IDisUnique = false;
      while(!IDisUnique){
        var randomID = generateRandomID(prefix);
        IDisUnique = true;
        for(var index in uniqueCheckArray){
          if(randomID == uniqueCheckArray[index].objectID){
            IDisUnique = false;
          }
        }
        for(var j=0; j<IDs.length; j++){
          if(randomID == IDs[j]){
            IDisUnique = false;
          }
        }
        if(IDisUnique){
          IDs.push(randomID);
        }
      }
    }
    return IDs;
  }
};
exports.getElementsByClassName = function(parentDiv, className){
  var returnDivs = [];
  var childrenDivs = parentDiv.getElementsByTagName('div');
  for(var i=0; i<childrenDivs.length; i++){
    for(var j=0; j<childrenDivs[i].classList.length; j++){
      if(childrenDivs[i].classList[j] === className){
        returnDivs.push(childrenDivs[i]);
      }
    }
  }
  return returnDivs;
};
exports.calcForePosition = function(center, radius, direction, distance){
  return {
    x : center.x + distance * Math.cos(direction * radianFactor) - radius,
    y : center.y + distance * Math.sin(direction * radianFactor) - radius
  };
};
exports.interpolationSine = function(time, lifeTime){
  if(lifeTime){
    return gameConfig.SKILL_EFFECT_INTERPOLATION_FACTOR * Math.sin(Math.PI * time / lifeTime) + 0.5;
  }else{
    return gameConfig.CAST_EFFECT_INTERPOLATION_FACTOR * Math.sin(2 * Math.PI * time / 1000) + 1;
  }
};
exports.isNumeric = function(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
function generateRandomID(prefix){
  var output = prefix;
  for(var i=0; i<6; i++){
    output += Math.floor(Math.random()*16).toString(16);
  }
  return output;
};
exports.makeCssClipStyle = function(iconData, expandRate){
  if(expandRate){
    return "rect(" + (iconData.top * expandRate) + "px," + (iconData.right * expandRate) + "px," + (iconData.bottom * expandRate) + "px," + (iconData.left * expandRate) + "px)";
  }else{
    return "rect(" + iconData.top + "px," + iconData.right + "px," + iconData.bottom + "px," + iconData.left + "px)";
  }
};
exports.setImgCssStyle = function(imgDiv, iconData, expandRate){
  if(expandRate){
    imgDiv.style.position = "absolute";
    imgDiv.style.top = (-iconData.top * expandRate) + "px";
    imgDiv.style.left = (-iconData.left * expandRate) + "px";
    imgDiv.style.width = (gameConfig.IMAGE_SOURCE_SIZE.width * expandRate) + "px";
    imgDiv.style.height = (gameConfig.IMAGE_SOURCE_SIZE.height * expandRate) + "px";
  }else{
    imgDiv.style.position = "absolute";
    imgDiv.style.top = (-iconData.top) + "px";
    imgDiv.style.left = (-iconData.left) + "px";
    imgDiv.style.width = (gameConfig.IMAGE_SOURCE_SIZE.width) + "px";
    imgDiv.style.height = (gameConfig.IMAGE_SOURCE_SIZE.height) + "px";
  }
};
exports.processMessage = function(msg, stringLength, isName){
  var newMsg = msg.replace(/(<([^>]+)>)/ig, '').substring(0,stringLength);
  if (isName) {
    return newMsg.replace(/\s/gi, "");
  } else {
    return newMsg;
  }
};
exports.createDomSelectOptGroup = function(label, parentNode){
  var optGroup = document.createElement("optgroup");
  optGroup.label = label;
  parentNode.appendChild(optGroup);
};
exports.createDomSelectOption = function(text, value, isDisabled, parentNode){
  var option = document.createElement("option");
  option.setAttribute("value", value);
  if(isDisabled){
    option.disabled = true;
  }
  var optionText = document.createTextNode(text);
  option.appendChild(optionText);
  parentNode.appendChild(option);
};
exports.createRequest = function(){
  var request;
  try {
    request = new XMLHttpRequest();
  } catch (e){
    try {
      request = new ActiveXObject('Msxml2.XMLHTTP');
    } catch (innerE) {
      request = new ActiveXObject('Microsoft.XMLHTTP');
    }
  }
  return request;
};
exports.getCookie = function(cookie, key){
  var cols = cookie.split(';');
  for(var i=0; i<cols.length; i++){
    var col = cols[i];
    while(col.charAt(0) == ' '){
      col = col.substring(1);
    }
    if(col.indexOf(key) === 0){
      var val = col.substring(key.length + 1, col.length);
      if(val === 'true'){
        return true;
      }else if(val === 'false'){
        return false;
      }else{
        return val;
      }
    }
  }
  return '';
};
exports.setCookie = function(key, value){
  var date = new Date();
  date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000));
  var expires = "expires="+ date.toUTCString();
  document.cookie = key + "=" + value + ";" + expires + ";path=/";
};
// function setCookie(cname, cvalue, exdays) {
//     var d = new Date();
//     d.setTime(d.getTime() + (exdays*24*60*60*1000));
//     var expires = "expires="+ d.toUTCString();
//     document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
// }
exports.isRender = function(user, otherUser, targetPosition, x, y){
  var rangeX = x ? x : 900;
  var rangeY = y ? y : 600;
  if(Math.abs(otherUser.center.x - user.center.x) > rangeX && Math.abs(targetPosition.x - user.center.x) > rangeX){
    return false;
  }else if(Math.abs(otherUser.center.y - user.center.y) > rangeY && Math.abs(targetPosition.y - user.center.y) > rangeY){
    return false;
  }else{
    return true;
  }
};
exports.setDrawUser = function(users, user, gameConfig){
  var drawUsers = [];
  for(var index in users){
    var center = exports.worldToLocalPosition(users[index].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(exports.isObjInCanvas(center, users[index].size.width, gameConfig)){
      var position = exports.worldToLocalPosition(users[index].position, gameConfig.userOffset, gameConfig.scaleFactor);
      var skill = false;
      if(users[index].currentSkill){
        skill = users[index].currentSkill.property
      }
      drawUsers.push({
        objectID: users[index].objectID,
        level: users[index].level,
        name: users[index].name,
        textCanvas : users[index].textCanvas,
        textScaleFactor : users[index].textScaleFactor,
        HP: users[index].HP,
        maxHP: users[index].maxHP,
        MP: users[index].MP,
        maxMP: users[index].maxMP,
        chatMessage1: users[index].chatMessage1,
        chatMessage2: users[index].chatMessage2,
        // center: users[index].center,
        // position: users[index].position,
        localCenter: center,
        localPosition: position,
        direction: users[index].direction,
        buffImgDataList: users[index].buffImgDataList,
        effectIndex: users[index].effectIndex,
        effectRotateDegree: users[index].effectRotateDegree,
        imgHandIndex: users[index].imgHandIndex,
        imgData: users[index].imgData,
        skillCastEffectPlay: users[index].skillCastEffectPlay,
        // currentSkill: users[index].currentSkill,
        currentSkill: skill,
        castEffectFactor : users[index].castEffectFactor,
        hitImgDataList: users[index].hitImgDataList,
        buffImgDataList: users[index].buffImgDataList
      });
      // drawUsers.push(users[index]);
    }
  }
  return drawUsers;
};
exports.setDrawMobs = function(monsters, gameConfig){
  var drawMobs = [];
  // for(var i=0; i<monsters.length; i++){
  for(var i in monsters){
    var center = exports.worldToLocalPosition(monsters[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(exports.isObjInCanvas(center, monsters[i].size.width, gameConfig)){
      var position = exports.worldToLocalPosition(monsters[i].position, gameConfig.userOffset, gameConfig.scaleFactor);
      drawMobs.push({
        objectID: monsters[i].objectID,
        HP: monsters[i].HP,
        maxHP: monsters[i].maxHP,
        localCenter: center,
        localPosition: position,
        direction: monsters[i].direction + monsters[i].attackDegree,

        effectIndex: monsters[i].effectIndex,
        effectRotateDegree: monsters[i].effectRotateDegree,
        imgData: monsters[i].imgData,
        buffImgDataList: monsters[i].buffImgDataList,
        hitImgDataList: monsters[i].hitImgDataList
      });
    }
  }
  return drawMobs;
};
exports.checkName = function(charType, name) {
  if ((name.slice(0, 5) == "Pyro#" && charType !== gameConfig.CHAR_TYPE_FIRE) ||
      (name.slice(0, 8) == "Froster#" && charType !== gameConfig.CHAR_TYPE_FROST) ||
      (name.slice(0, 7) == "Myster#" && charType !== gameConfig.CHAR_TYPE_ARCANE)){
    return null;
  } else {
    return name;
  }
}
exports.setRandomName = function(charType){
  var suffix = "";
  for(var i=0; i<3; i++){
    suffix += Math.floor(Math.random() * 10);
  }
  switch (charType) {
    case gameConfig.CHAR_TYPE_FIRE:
      return "Pyro#" + suffix;
    case gameConfig.CHAR_TYPE_FROST:
      return "Froster#" + suffix;
    case gameConfig.CHAR_TYPE_ARCANE:
      return "Myster#" + suffix;
    default:
  }
};
// var keyCodeTable = require('./keyCodeTable');
exports.charToKeyCode = function(char){
  var keyCodeTable = require('./keyCodeTable');
  return keyCodeTable[char.toLowerCase()];
};
exports.keyCodeToChar = function(keyCode){
  var keyCodeTable = require('./keyCodeTable');
  for(var index in keyCodeTable){
    if(keyCodeTable[index] == keyCode){
      return index.toUpperCase();
    }
  }
};
exports.makeCacheCanvas = function(level, name, scaleFactor){
  var cacheCanvas = document.createElement('canvas');
  var ctx = cacheCanvas.getContext('2d');
  cacheCanvas.width = 400 * scaleFactor;
  cacheCanvas.height = 100 * scaleFactor;
  ctx.beginPath();
  ctx.textAlign = "center";
  ctx.fillStyle = "black";
  ctx.font = "bold 15px Arial";
  ctx.fillText("Lv." + level + " " + name, 200 * scaleFactor, 50 * scaleFactor, 200 * scaleFactor);
  ctx.closePath();
  return cacheCanvas;
};
exports.makePacketForm = function(type){
  var vars = [];
  for(var i=1; i<arguments.length; i++){
    vars.push(arguments[i]);
  }
  return msgpack.encode({
    t: type,
    v: vars
  });
};
exports.decodePacket = function(data){
    return msgpack.decode(data);
};


exports.processUserData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16]
  };
};
exports.processUserAddData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16],

    bS: rawData[17],
    pS: rawData[18],
    ipS: rawData[19],
    eS: rawData[20],
    aS: rawData[21],

    dR: rawData[22],
    fiDR: rawData[23],
    frDR: rawData[24],
    acDR: rawData[25],
    rA: rawData[26],
    rFi: rawData[27],
    rFr: rawData[28],
    rAc: rawData[29],
    sP: rawData[30],
    sM: rawData[31],
    sS: rawData[32],
    cRR: rawData[33],

    g: rawData[34],
    j: rawData[35]
  };
};
exports.processUserAddReData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16],

    bS: rawData[17],
    pS: rawData[18],
    ipS: rawData[19],

    dR: rawData[20],
    fiDR: rawData[21],
    frDR: rawData[22],
    acDR: rawData[23],
    rA: rawData[24],
    rFi: rawData[25],
    rFr: rawData[26],
    rAc: rawData[27],
    sP: rawData[28],
    sM: rawData[29],
    sS: rawData[30],
    cRR: rawData[31]
  };
};
exports.processUserMAData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16],

    sID: rawData[17],
    sTPos: rawData[18],
    mB: rawData[19]
  };
};
exports.processUserUSData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16],

    sID: rawData[17],
    sDir: rawData[18],
    sTPos: rawData[19],

    sPIDs: rawData[20]
  };
};
exports.processUserStatData = function(rawData) {
  return {
      oID: rawData[0],
      tp : rawData[1],
      lv : rawData[2],
      ep : rawData[3],
      mHP: rawData[4],
      mMP: rawData[5],
      HP : rawData[6],
      MP : rawData[7],
      csp: rawData[8],
      msp: rawData[9],
      rsp: rawData[10],
      cdt: rawData[11]
  };
};
exports.processScoreDatas = function(rawDatas) {
  var datas = [];
  for (var i=0; i<rawDatas.length; i++) {
    datas.push({
      id : rawDatas[i][0],
      nm : rawDatas[i][1],
      lv: rawDatas[i][2],
      kS : rawDatas[i][3],
      tS : rawDatas[i][4],
      tK : rawDatas[i][5]
    });
  }
  return datas;
};
exports.processUserPrivateData = function(rawData) {
  return  {
    dR : rawData[0],
    fiDR : rawData[1],
    frDR : rawData[2],
    acDR : rawData[3],
    rA : rawData[4],
    rFi : rawData[5],
    rFr : rawData[6],
    rAc : rawData[7],
    lv : rawData[8],
    sP : rawData[9],
    sM : rawData[10],
    sS : rawData[11],
    cRR : rawData[12]
  };
};
exports.processMobData = function(rawData) {
  return {
    id : rawData[0],
    oID : rawData[1],
    cs : rawData[2],
    pos : rawData[3],
    tpos : rawData[4],
    msp : rawData[5],
    dir : rawData[6],
    rsp : rawData[7],
    at : rawData[8],
    mHP : rawData[9],
    HP : rawData[10],
    cdt : rawData[11],
    bL : rawData[12]
  };
};
exports.processMobDatas = function(rawDatas) {
  var datas = [];
  for (var i=0; i<rawDatas.length; i++) {
    datas.push(exports.processMobData(rawDatas[i]));
  }
  return datas;
};
exports.processBuffData = function(rawData) {
  return {
    oID : rawData[0],
    iP : rawData[1],
    bL : rawData[2],
    pL : rawData[3],
    aL : rawData[4]
  };
}
exports.processBuffDatas = function(rawDatas) {
  var datas = [];
  for (var i=0; i<rawDatas.length; i++) {
    datas.push(exports.processBuffData(rawDatas[i]));
  }
  return datas;
}
exports.processMobStatData = function(rawData) {
  return {
    oID : rawData[0],
    pos : rawData[1],
    dir : rawData[2],
    HP : rawData[3]
  }
}
exports.processMobBuffData = function(rawData) {
  return {
    oID : rawData[0],
    bL : rawData[1]
  }
}
exports.processObjDatas = function(rawDatas) {
  var datas = [];
  for (var i=0; i<rawDatas.length; i++) {
    var data = {};
    switch (rawDatas[i][0].substr(0, 1)) {
      case gameConfig.PREFIX_OBJECT_GOLD:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        data.rad = rawDatas[i][2];
        break;
      case gameConfig.PREFIX_OBJECT_JEWEL:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        break;
      case gameConfig.PREFIX_OBJECT_SKILL:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        data.pro = rawDatas[i][2];
        break;
      case gameConfig.PREFIX_OBJECT_BOX:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        break;
      case gameConfig.PREFIX_OBJECT_BUFF:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        data.rID = rawDatas[i][2];
        break;
      default:
    }
    datas.push(data);
  }
  return datas;
}
