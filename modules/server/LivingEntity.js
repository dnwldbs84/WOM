var GameObject = require('./GameObject.js');
var util = require('../public/util.js');

var gameConfig = require('../public/gameConfig.json');

var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;

function LivingEntity(){
  GameObject.call(this);
  this.objectID = null;

  this.currentState = gameConfig.OBJECT_STATE_IDLE;
  // this.currentSkill = undefined;
  // this.isExecutedSkill = false;
  this.speed = {x: 0, y:0};
  this.direction = 0;

  this.targetPosition = {
    x : this.position.x, y : this.position.y
  };
  this.beforePositions = [];
  // this.before150msPos = {x : -1000, y : -1000};
  // this.before300msPos = {x : -1000, y : -1000};
  this.targetDirection = 0;

  this.updateInterval = false;
  this.updateFunction = new Function();

  this.entityTreeEle = {
    x : 0,
    y : 0,
    width : 0,
    height : 0,
    id : ''
  };
  // this.entityBefore150msTreeEle = {
  //   x : 0,
  //   y : 0,
  //   width : 0,
  //   height : 0,
  //   id : ''
  // };
  // this.entityBefore300msTreeEle = {
  //   x : 0,
  //   y : 0,
  //   width : 0,
  //   height : 0,
  //   id : ''
  // };
  this.onMove = new Function();
};
LivingEntity.prototype = Object.create(GameObject.prototype);
LivingEntity.prototype.constructor = LivingEntity;

//state changer. change update listener
// LivingEntity.prototype.changeState = function(newState){
//   this.currentState = newState;
//
//   this.stop();
//   switch(this.currentState){
//     case gameConfig.OBJECT_STATE_IDLE :
//       this.updateFunction = this.idle;
//       break;
//     case gameConfig.OBJECT_STATE_MOVE :
//       this.updateFunction = this.rotate.bind(this);
//       break;
//     case gameConfig.OBJECT_STATE_ATTACK :
//       this.updateFunction = this.attack.bind(this);
//       break;
//     case gameConfig.OBJECT_STATE_CAST :
//       this.updateFunction = this.rotate.bind(this);
//       break;
//     }
//   this.update();
// };
// LivingEntity.prototype.update = function(){
//   if(!this.updateInterval){
//     this.updateInterval = setInterval(this.updateFunction, INTERVAL_TIMER);
//   }
// };
// //rotate before move or fire skill etc..
// LivingEntity.prototype.rotate = function(){
//   util.rotate.call(this);
// };
// //move after rotate
// LivingEntity.prototype.move = function(){
//   util.move.call(this);
// };
// LivingEntity.prototype.idle = function(){
//   //do nothing or send current stat to client;
// };
// LivingEntity.prototype.moveDirect = function(newPosition){
//   this.position = newPosition;
//   this.setCenter();
// };
// //interval clear
// LivingEntity.prototype.stop = function(){
//   if(this.updateInterval){
//     clearInterval(this.updateInterval);
//     this.updateInterval = false;
//   }
// };
//
// // setup when click canvas for move
// LivingEntity.prototype.setTargetPosition = function(newPosition){
//   console.log(newPosition);
//   if(newPosition.x <= this.size.width/2){
//     this.targetPosition.x = this.size.width/2;
//   }else if(newPosition.x >= gameConfig.CANVAS_MAX_SIZE.width - this.size.width/2){
//     this.targetPosition.x = gameConfig.CANVAS_MAX_SIZE.width - this.size.width/2;
//   }else{
//     this.targetPosition.x = newPosition.x;
//   }
//
//   if(newPosition.y <=this.size.height/2){
//     this.targetPosition.y = this.size.height/2;
//   }else if(newPosition.y >= gameConfig.CANVAS_MAX_SIZE.height - this.size.height/2){
//     this.targetPosition.y = gameConfig.CANVAS_MAX_SIZE.height - this.size.height/2;
//   }else{
//     this.targetPosition.y = newPosition.y;
//   }
//   console.log(this.targetPosition);
// };
// LivingEntity.prototype.setSpeed = function(){
//   util.setSpeed.call(this);
// };
// LivingEntity.prototype.setTargetDirection = function(){
//   util.setTargetDirection.call(this);
// };

// initialize method
LivingEntity.prototype.setRotateSpeed = function(x){
  this.rotateSpeed = x;
};
LivingEntity.prototype.setMaxSpeed = function(x){
  this.maxSpeed = x;
};
LivingEntity.prototype.assignID = function(x){
  this.objectID = x;
};
LivingEntity.prototype.initEntityEle = function(){
  this.entityTreeEle = {
    x : this.position.x,
    y : this.position.y,
    width : this.size.width,
    height : this.size.height,
    id : this.objectID
  };
  // this.entityBefore150msTreeEle = {
  //   x : -2000,
  //   y : -2000,
  //   width : this.size.width,
  //   height : this.size.height,
  //   id : this.objectID
  // };
  // this.entityBefore300msTreeEle = {
  //   x : -2000,
  //   y : -2000,
  //   width : this.size.width,
  //   height : this.size.height,
  //   id : this.objectID
  // };
}
// initialize and update for entityTreeEle
LivingEntity.prototype.setEntityEle = function(){
  this.entityTreeEle.x = this.position.x;
  this.entityTreeEle.y = this.position.y;
};
// LivingEntity.prototype.setBefore150msEntitiyEle = function(){
//   this.entityBefore150msTreeEle.x = this.before150msPos.x;
//   this.entityBefore150msTreeEle.y = this.before150msPos.y;
// };
// LivingEntity.prototype.setBefore300msEntityEle = function(){
//   this.entityBefore300msTreeEle.x = this.before300msPos.x;
//   this.entityBefore300msTreeEle.y = this.before300msPos.y;
// };

module.exports = LivingEntity;
