(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var User = require('./CUser.js');

var util = require('../public/util.js');

var gameConfig = require('../public/gameConfig.json');
var objectAssign = require('../public/objectAssign.js');

// var map = require('../public/map.json');
// var csvJson = require('../public/csvjson.js');
// var dataJson = require('../public/data.json');

// var obstacleTable = csvJson.toObject(dataJson.obstacleData, {delimiter : ',', quote : '"'});
var userStatTable, resourceTable, obstacleTable;

var QuadTree = require('../public/quadtree.js');

var Obstacle = require('./CObstacle.js');

var colliderEles = [];

var staticTree;
var staticEles = [];
var treeImgTree;
var treeImgEles = [];
// var collisionClearTime = Date.now();
var checkCollisionEles = [];
var affectedEles = [];

var CManager = function(){
	//user correspond client
	this.user = null;
	//all users
	this.users = [];
	this.chests = [];
	this.obstacles = [];
	this.treesCount = 0;
	this.effects = [];
	this.userEffects = [];
	this.projectiles = [];
	this.riseText = [];

	this.userEffectTimer = Date.now();
	// this.objExps = [];
	this.objGolds = [];
	this.objJewels = [];
	this.objSkills = [];
	this.objBoxs = [];

	this.onMainUserMove = new Function();
	this.onSkillFire = new Function();
	this.onProjectileSkillFire = new Function();

	this.staticInterval = null;
	this.affectInterval = null;
};

CManager.prototype = {
	start : function(statTable, srcTable, ostTable){
		userStatTable = statTable;
		resourceTable = srcTable;
		obstacleTable = ostTable;

		staticTree = new QuadTree({
		  width : gameConfig.CANVAS_MAX_SIZE.width,
		  height : gameConfig.CANVAS_MAX_SIZE.height,
		  maxElements : 5
		});
		treeImgTree = new QuadTree({
		  width : gameConfig.CANVAS_MAX_SIZE.width,
		  height : gameConfig.CANVAS_MAX_SIZE.height,
		  maxElements : 5
		});

		this.mapSetting();
		this.updateGame();
	},
	mapSetting : function(){
		this.createObstacles();
		// this.setObstaclesLocalPos();
	},
	updateGame : function(){
		var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;

		if(this.staticInterval === null){
	    this.staticInterval = setInterval(staticIntervalHandler.bind(this), INTERVAL_TIMER);
	  }
	},
	createObstacles : function(){
		var rocks = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_ROCK));
		for(var i=0; i<Object.keys(rocks).length; i++){
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', rocks[i].imgData));
			var tempRock = new Obstacle(rocks[i].posX, rocks[i].posY, rocks[i].radius, rocks[i].id, resourceData);
			this.obstacles.push(tempRock);
			staticEles.push(tempRock.staticEle);
		}
		var chestGrounds = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
		for(var i=0; i<Object.keys(chestGrounds).length; i++){
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', chestGrounds[i].imgData));
			var tempChestGround = new Obstacle(chestGrounds[i].posX, chestGrounds[i].posY, chestGrounds[i].radius, chestGrounds[i].id, resourceData);
			this.obstacles.push(tempChestGround);
			staticEles.push(tempChestGround.staticEle);
		}
		var trees = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_TREE));
		this.treesCount = Object.keys(trees).length;
		for(var i=0; i<Object.keys(trees).length; i++){
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', trees[i].imgData));
			var tempTree = new Obstacle(trees[i].posX, trees[i].posY, trees[i].radius, trees[i].id, resourceData);
			tempTree.setTreeImgEle(trees[i].treeImgRadius);
			this.obstacles.push(tempTree);
			staticEles.push(tempTree.staticEle);
			treeImgEles.push(tempTree.treeImgEle);
		}
		// for(var i=0; i<map.Trees.length; i++){
		// 	var tempObstacle = new Obstacle(map.Trees[i].posX, map.Trees[i].posY,	resources.OBJ_TREE_SIZE, resources.OBJ_TREE_SIZE, map.Trees[i].id, resources.OBJ_TREE_SRC);
		// 	this.obstacles.push(tempObstacle);
		// 	staticEles.push(tempObstacle.staticEle);
		// }
		// for(var i=0; i<map.Chests.length; i++){
		// 	var chestBase = new Obstacle(map.Chests[i].posX, map.Chests[i].posY, resources.OBJ_CHEST_SIZE, resources.OBJ_CHEST_SIZE, map.Chests[i].id, resources.OBJ_CHEST_SRC);
		// 	this.obstacles.push(chestBase);
		// 	staticEles.push(chestBase.staticEle);
		// }
		staticTree.pushAll(staticEles);
		treeImgTree.pushAll(treeImgEles);
	},
	setChests : function(chestDatas){
		for(var i=0; i<chestDatas.length; i++){
			this.createChest(chestDatas[i]);
		}
	},
	createChest : function(chestData){
		//find chest location
		var chestGrounds = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
		for(var i=0; i<Object.keys(chestGrounds).length; i++){
			if(chestGrounds[i].id === chestData.locationID){
				var chestGround = chestGrounds[i];
				var chestPosition = {x : chestGrounds[i].posX,  y : chestGrounds[i].posY};
				break;
			}
		}
		if(chestGround && chestPosition){
			// var resourceData = objectAssign({}, util.findData(resourceTable, 'index'))
			switch (chestData.grade) {
				case 1:
						var resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_1;
					break;
				case 2:
					resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_2;
					break;
				case 3:
					resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_3;
					break;
				case 4:
					resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_4;
					break;
				case 5:
					resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_5;
					break;
				default:
			}
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', resourceIndex));
			this.chests.push({
				objectID : chestData.objectID,
				locationID : chestData.locationID,
				grade : chestData.grade,
				HP : chestData.HP,
				maxHP : chestData.maxHP,
				position : chestPosition,
				size : {width : chestGround.radius * 2, height : chestGround.radius * 2},
				center : {x : chestPosition.x + chestGround.radius, y : chestPosition.y + chestGround.radius},
				imgData : resourceData
			});
		}
		// for(var i=0; i<map.Chests.length; i++){
		// 	if(map.Chests[i].id === chestData.locationID){
		// 		var chestPosition = {x : map.Chests[i].posX, y : map.Chests[i].posY};
		// 		break;
		// 	}
		// }
		// if(chestPosition){
		// 	this.chests.push({
		// 		objectID : chestData.objectID,
		// 		grade : chestData.grade,
		// 		position : chestPosition,
		// 		size : {width : resources.OBJ_CHEST_SIZE, height : resources.OBJ_CHEST_SIZE}
		// 	});
		// }
	},
	updateChest : function(locationID, HP){
		for(var i=0; i<this.chests.length; i++){
			if(this.chests[i].locationID === locationID){
				this.chests[i].HP = HP;
				break;
			}
		}
	},
	deleteChest : function(locationID){
		for(var i=0; i<this.chests.length; i++){
			if(this.chests[i].locationID === locationID){
				this.chests.splice(i, 1)
				break;
			}
		}
	},
	setUser : function(userData){
		if(!(userData.objectID in this.users)){
			var tempUser = new User(userData);
			this.users[userData.objectID] = tempUser;
			this.users[userData.objectID].onMove = onMoveCalcCompelPos.bind(this);
			this.users[userData.objectID].changeState(userData.currentState);
		}else{
			console.log('user.objectID duplicated. something is wrong.');
		}
	},
	setUsers : function(userDatas){
		for(var i=0; i<userDatas.length; i++){
			userDatas[i].imgData = this.setImgData(userDatas[i], resourceTable, userStatTable);
			var tempUser = new User(userDatas[i]);
			this.users[userDatas[i].objectID] = tempUser;
			this.users[userDatas[i].objectID].onMove = onMoveCalcCompelPos.bind(this);
			this.users[userDatas[i].objectID].changeState(userDatas[i].currentState);
		}
	},
	setImgData : function(userData){
		var imgIndex = util.findDataWithTwoColumns(userStatTable, 'type', userData.type, 'level', userData.level).imgData;
		return objectAssign({}, util.findData(resourceTable, 'index', imgIndex));
	},
	setUsersSkills : function(skillDatas){
		for(var i=0; i<skillDatas.length; i++){
			if(skillDatas[i].fireTime > 0){
				this.userSkill(skillDatas[i].userID, skillDatas[i]);
			}
		}
	},
	setObjs : function(objDatas){
		for(var i=0; i<objDatas.length; i++){
			// if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_EXP){
			// 	this.objExps.push({objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			// }else
			if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_SKILL){
				this.objSkills.push(objDatas[i]);
					// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_GOLD){
				this.objGolds.push(objDatas[i]);
					// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_JEWEL){
				this.objJewels.push(objDatas[i]);
					// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_BOX){
				this.objBoxs.push(objDatas[i]);
			}else{
				console.log('check object : ' + objDatas[i].objectID)
			}
		}
	},
	createOBJs : function(objDatas){
		for(var i=0; i<objDatas.length; i++){
			// if(objDatas[i].objectID.substr(0,3) === gameConfig.PREFIX_OBJECT_EXP){
			// 	this.objExps.push({objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			// }else
			if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_SKILL){
				this.objSkills.push(objDatas[i]);
					// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_GOLD){
				this.objGolds.push(objDatas[i]);
				// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_JEWEL){
				this.objJewels.push(objDatas[i]);
				// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_BOX){
				this.objBoxs.push(objDatas[i]);
			}else{
				console.log('check object : ' + objDatas[i].objectID)
			}
		}
	},
	deleteOBJ : function(objID){
		// if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_EXP){
		// 	for(var i=0; i<this.objExps.length; i++){
		// 		if(this.objExps[i].objectID === objID){
		// 			this.objExps.splice(i, 1);
		// 			return;
		// 		}
		// 	}
		// }else
		if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_SKILL){
			for(var i=0; i<this.objSkills.length; i++){
				if(this.objSkills[i].objectID === objID){
					this.objSkills.splice(i, 1);
					return;
				}
			}
		}else if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_GOLD){
			for(var i=0; i<this.objGolds.length; i++){
				if(this.objGolds[i].objectID === objID){
					this.objGolds.splice(i, 1);
					return;
				}
			}
		}else if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_JEWEL){
			for(var i=0; i<this.objJewels.length; i++){
				if(this.objJewels[i].objectID === objID){
					this.objJewels.splice(i, 1);
					return;
				}
			}
		}else if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_BOX){
			for(var i=0; i<this.objBoxs.length; i++){
				if(this.objBoxs[i].objectID === objID){
					this.objBoxs.splice(i, 1);
					return;
				}
			}
		}else{
			console.log('check object id : ' + objID);
		}
	},
	iamRestart : function(userData){
		this.users[this.user.objectID] = this.user;

		this.user.changeState(gameConfig.OBJECT_STATE_IDLE);
	},
	iamDead : function(){
		this.user.hitImgDataList = [];
		this.user.buffImgDataList = [];
		this.user.conditions = [];
		this.user.position = {x : -2000, y : -2000};
		this.user.changeState(gameConfig.OBJECT_STATE_DEATH);
	},
	kickUser : function(objID){
		if(!(objID in this.users)){
			console.log("user already out");
		}else{
			this.users[objID].stop();
			delete this.users[objID];
		}
	},
	checkUserAtUsers : function(userData){
		if(userData.objectID in this.users){
			return true;
		}else{
			return false;
		}
	},
	//will be merge to updateUser function
	moveUser : function(targetPosition){
		this.user.targetPosition = targetPosition;
		this.user.setCenter();
		this.user.setTargetDirection();
		this.user.setSpeed();

		this.user.changeState(gameConfig.OBJECT_STATE_MOVE);
	},
	moveAndAttackUser : function(userID, userTargetPosition, skillData, moveBackward){
		if(userID in this.users){
			this.users[userID].targetPosition = userTargetPosition;
			this.users[userID].setCenter();
			if(moveBackward){
				this.users[userID].setTargetDirection(moveBackward);
				this.users[userID].setSpeed(gameConfig.MOVE_BACK_WARD_SPEED_DECREASE_RATE);
			}else{
				this.users[userID].setTargetDirection();
				this.users[userID].setSpeed();
			}

			skillData.direction = this.users[userID].targetDirection;
			var skillInstance = this.users[userID].makeSkillInstance(skillData);

			var thisUser = this.user;
			var mainUser = this.users[userID];
			var thisOnSkillFire = this.onSkillFire;

			skillInstance.onFire = function(syncFireTime){
				if(thisUser === mainUser){
					thisOnSkillFire(skillData, syncFireTime);
				}
				mainUser.skillCastEffectPlay = false;
			}
			this.users[userID].changeState(gameConfig.OBJECT_STATE_MOVE_AND_ATTACK);
			this.users[userID].setSkill(skillInstance);
		}
	},
	useSkill : function(userID, skillData){
		if(userID in this.users){
			var skillInstance = this.users[userID].makeSkillInstance(skillData);
			var thisUser = this.user;
			var mainUser = this.users[userID];
			// var thisProjectiles = this.projectiles;
			// var thisEffects = this.effects;
			var thisOnSkillFire = this.onSkillFire;
			var thisOnProjectileSkillFire = this.onProjectileSkillFire;

			this.users[userID].targetDirection = skillData.direction;
			if(skillData.type === gameConfig.SKILL_TYPE_INSTANT_RANGE){
				skillInstance.onFire = function(syncFireTime){
					//inform to server
					if(thisUser === mainUser){
						thisOnSkillFire(skillData, syncFireTime);
					}

					mainUser.skillCastEffectPlay = false;
					// skillInstance.startEffectTimer();
					// thisEffects.push(skillInstance.effect);
				};
				//on attack can cast skill but on attack cant attack;
				this.users[userID].changeState(gameConfig.OBJECT_STATE_ATTACK);
			}else if(skillData.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
				skillInstance.onFire = function(syncFireTime){
					var projectile = mainUser.makeProjectile(skillData.projectileIDs[0], skillInstance, skillData.direction);
					if(thisUser === mainUser){
						thisOnProjectileSkillFire([projectile], syncFireTime);
					}
					// thisProjectiles.push(projectile);
					mainUser.skillCastEffectPlay = false;
				}
				//on attack can cast skill but on attack cant attack;
				this.users[userID].changeState(gameConfig.OBJECT_STATE_ATTACK);
			}else if(skillData.type === gameConfig.SKILL_TYPE_RANGE || skillData.type === gameConfig.SKILL_TYPE_SELF ||
				skillData.type === gameConfig.SKILL_TYPE_SELF_EXPLOSION || skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
					skillInstance.onFire = function(syncFireTime){
						if(thisUser === mainUser){
							thisOnSkillFire(skillData, syncFireTime)
						}
						mainUser.skillCastEffectPlay = false;
						// skillInstance.startEffectTimer();
						// thisEffects.push(skillInstance.effect);
					};
					this.users[userID].changeState(gameConfig.OBJECT_STATE_CAST);
				}else if(skillData.type === gameConfig.SKILL_TYPE_PROJECTILE || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK ||
					skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){
						skillInstance.onFire = function(syncFireTime){
							var projectiles = [];
							var direction = skillData.direction;
							for(var i=0; i<skillData.projectileCount; i++){
								if(skillData.projectileCount % 2 === 0){
									var midPoint = skillData.projectileCount/2 - 0.5;
									var factor = i - midPoint;
									direction = skillData.direction + factor * gameConfig.MULTI_PROJECTILE_DEGREE;
								}else if(skillData.projectileCount % 2 === 1){
									var midPoint = Math.floor(skillData.projectileCount/2);
									factor = i - midPoint;
									direction = skillData.direction + factor * gameConfig.MULTI_PROJECTILE_DEGREE;
								}
								var projectile = mainUser.makeProjectile(skillData.projectileIDs[i], skillInstance, direction);
								// thisProjectiles.push(projectile);
								projectiles.push(projectile);
								if(thisUser === mainUser && projectiles.length === skillData.projectileCount){
									thisOnProjectileSkillFire(projectiles, syncFireTime);
								}
								mainUser.skillCastEffectPlay = false;
							}
						};
						this.users[userID].changeState(gameConfig.OBJECT_STATE_CAST);
					}else{
						console.log('skill type error!!!');
					}
			this.users[userID].setSkill(skillInstance);
		}
	},
	applySkill : function(skillData, userID, imgData){
		if(skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
			if(userID in this.users){
				var newPosition = {x : skillData.targetPosition.x,
													 y : skillData.targetPosition.y}
				this.users[userID].changePosition(newPosition);
			}
		}else{
			this.effects.push({
				property : skillData.property,
				position : {x : skillData.targetPosition.x - skillData.explosionRadius,
					y : skillData.targetPosition.y - skillData.explosionRadius},
				radius : skillData.explosionRadius,
				startTime : Date.now(),
				lifeTime  : skillData.effectLastTime,
				scaleFactor : 1,

				effectImgData : imgData ? imgData : 0,

				isCheckCollision : false
			});
		}
	},
	applyProjectile : function(skillData, pImgData, eImgData){
		this.projectiles.push({
			userID : skillData.userID,
			objectID : skillData.objectID,

			type : skillData.type,
			property : skillData.property,

			position : skillData.position,
			speed : skillData.speed,
			startTime : skillData.startTime,
			radius : skillData.radius,
			lifeTime : skillData.lifeTime * 2,

			projectileImgData : pImgData ? pImgData : 0,
			effectRotateDegree : 0,
			effectTimer : Date.now(),

			timer : Date.now(),
			effect : {
				property : skillData.property,
				position : skillData.position,
				radius : skillData.explosionRadius,
				startTime : 0,
				lifeTime : skillData.effectLastTime,
				effectImgData : eImgData ? eImgData : 0,
				scaleFactor : 1
			},
			move : function(){
				var deltaTime = (Date.now() - this.timer)/ 1000;
		    this.position.x += this.speed.x * deltaTime;
		    this.position.y += this.speed.y * deltaTime;
		    this.timer = Date.now();
			},
			isExpired : function(){
		    if(this.lifeTime > Date.now() - this.startTime){
		      return false;
		    }
				console.log('server response to late!!!, in projectile expired');
		    return true;
		  },
			explode : function(position){
				this.setEffect(position);
				console.log('explode!!!!!!');
			},
			setEffect : function(position){
				this.effect.position = position;
				this.effect.startTime = Date.now();
			}
		});
	},
	applyCastSpeed : function(userID, skillData){
		if(userID in this.users){
			skillData.fireTime = Math.floor(skillData.fireTime * (100 / this.users[userID].castSpeed));
			skillData.totalTime = Math.floor(skillData.totalTime * (100 / this.users[userID].castSpeed));
		}
	},
	deleteProjectile : function(projectileID, userID){
		for(var i=0; i<this.projectiles.length; i++){
			if(this.projectiles[i].objectID === projectileID){
				if(this.projectiles[i].userID === userID){
					this.projectiles.splice(i, 1);
					break;
				}
			}
		}
	},
	explodeProjectile : function(projectileID, userID, position){
		for(var i=0; i<this.projectiles.length; i++){
			if(this.projectiles[i].objectID === projectileID){
				if(this.projectiles[i].userID === userID){
					this.projectiles[i].explode(position);
					// this.projectiles[i].startEffectTimer();
					this.effects.push(this.projectiles[i].effect);
					this.projectiles.splice(i, 1);
					break;
				}
			}
		}
	},
	changeUserStat : function(userData, isUpdateImage){
		if(userData.objectID in this.users){
			if(userData.level !== this.users[userData.objectID].level || isUpdateImage){
				this.users[userData.objectID].level = userData.level;
				this.users[userData.objectID].imgData = this.setImgData(userData);
			}
			this.users[userData.objectID].exp = userData.exp;

			this.users[userData.objectID].maxHP = userData.maxHP;
			this.users[userData.objectID].maxMP = userData.maxMP;
			this.users[userData.objectID].HP = userData.HP;
			this.users[userData.objectID].MP = userData.MP;
			this.users[userData.objectID].castSpeed = userData.castSpeed;
			this.users[userData.objectID].maxSpeed = userData.maxSpeed;
			this.users[userData.objectID].rotateSpeed = userData.rotateSpeed;
			this.users[userData.objectID].conditions = userData.conditions;
			this.users[userData.objectID].buffList = userData.buffList;
			this.users[userData.objectID].passiveList = userData.passiveList;

			//apply maxSpeed
			this.users[userData.objectID].setSpeed();
			if(this.users[userData.objectID].currentState === gameConfig.OBJECT_STATE_CAST &&
				 this.users[userData.objectID].currentSkill){
				var consumeMP = this.users[userData.objectID].currentSkill.consumeMP;
				if(this.users[userData.objectID].conditions[gameConfig.USER_CONDITION_FREEZE] ||
					 this.users[userData.objectID].conditions[gameConfig.USER_CONDITION_SILENCE] ||
					 this.users[userData.objectID].MP < consumeMP){
						 this.users[userData.objectID].changeState(gameConfig.OBJECT_STATE_IDLE);
					 }
			}else if(this.users[userData.objectID].currentState === gameConfig.OBJECT_STATE_ATTACK){
				if(this.users[userData.objectID].conditions[gameConfig.USER_CONDITION_FREEZE] ||
					 this.users[userData.objectID].conditions[gameConfig.USER_CONDITION_SILENCE]){
					this.users[userData.objectID].changeState(gameConfig.OBJECT_STATE_IDLE);
				}
			}
		}
	},
	updateSkillPossessions : function(userID, possessSkills){
		if(userID in this.users){
			this.users[userID].updateSkillPossessions(possessSkills);
		}
	},
	updateUserData : function(userData){
		if(userData.objectID in this.users){
			this.users[userData.objectID].position = userData.position;
			this.users[userData.objectID].targetPosition = userData.targetPosition;

			this.users[userData.objectID].direction = userData.direction;
			this.users[userData.objectID].maxSpeed = userData.maxSpeed;
			this.users[userData.objectID].rotateSpeed = userData.rotateSpeed;

			this.users[userData.objectID].setCenter();
			this.users[userData.objectID].setTargetDirection();
			this.users[userData.objectID].setSpeed();

			this.users[userData.objectID].changeState(userData.currentState);
		}
	},
	syncUserData : function(userData){
		if(userData.objectID in this.users){
			this.users[userData.objectID].position = userData.position;
			if(this.users[userData.objectID].currentState !== gameConfig.OBJECT_STATE_ATTACK &&
				 this.users[userData.objectID].currentState !== gameConfig.OBJECT_STATE_CAST){
					 this.users[userData.objectID].targetPosition = userData.targetPosition;

					 this.users[userData.objectID].direction = userData.direction;
					 this.users[userData.objectID].maxSpeed = userData.maxSpeed;
					 this.users[userData.objectID].rotateSpeed = userData.rotateSpeed;

					 this.users[userData.objectID].setCenter();
					 this.users[userData.objectID].setTargetDirection();
					 this.users[userData.objectID].setSpeed();
			}
			if(this.users[userData.objectID].currentState !== userData.currentState &&
				 this.users[userData.objectID].currentState !== gameConfig.OBJECT_STATE_CAST &&
				 this.users[userData.objectID].currentState !== gameConfig.OBJECT_STATE_ATTACK &&
			 	 this.users[userData.objectID].currentState !== gameConfig.OBJECT_STATE_MOVE_AND_ATTACK){
					 this.users[userData.objectID].changeState(userData.currentState);
		 	}
		}
	},
	updateUserBuffImgData : function(userID, buffImgDataList){
		if(userID in this.users){
			this.users[userID].updateBuffImgData(buffImgDataList);
		}
	},
	updateSkillHitImgData : function(userID, skillImgData){
		if(userID in this.users){
			this.users[userID].updateSkillHitImgData(skillImgData);
		}
	},
	// set this client user
	synchronizeUser : function(userID){
		for(var index in this.users){
			if(this.users[index].objectID === userID){
				this.user = this.users[index];
				this.user.onMainUserMove = onMainUserMoveHandler.bind(this, this.user);
			}
		}
		if(!this.user){
			console.log('if print me. Something is wrong');
		}
	},
	// addRiseText : function(amount, color, position){
	// 	var riseText = {text : amount, color : color, position : position};
	// 	this.riseText.push(riseText);
	// 	var thisRiseText = this.riseText;
	// 	var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;
  //
	// 	var tempInterval = setInterval(function(){
	// 		riseText.position.y -= 1;
	// 	}, INTERVAL_TIMER);
	// 	setTimeout(function(){
	// 		var index = thisRiseText.indexOf(riseText);
	// 		if(index >= 0){
	// 			thisRiseText.splice(index, 1);
	// 		}
	// 		clearInterval(tempInterval);
	// 	}, gameConfig.RISE_TEXT_LIFE_TIME);
	// },
	// getUserHP : function(userID){
	// 	if(userID in this.users){
	// 		return this.users[userID].HP;
	// 	}
	// },
	// getUserExp : function(userID){
	// 	if(userID in this.users){
	// 		return this.users[userID].exp;
	// 	}
	// },
	// getUserCenter : function(userID){
	// 	if(userID in this.users){
	// 		return {
	// 			x : this.users[userID].center.x,
	// 			y : this.users[userID].center.y
	// 		};
	// 	}
	// },
	processUserData : function(){
		if(this.user.currentState === gameConfig.OBJECT_STATE)
		var currentState
		return {
			objectID : this.user.objectID,
			currentState : this.user.currentState,
			position : this.user.position,
			direction : this.user.direction,

			time : this.user.timer
		};
	},
	processSkillData : function(skillData){
		return {
			// userID : this.user.objectID,
			skillIndex : skillData.index,
			skillTargetPosition : skillData.targetPosition
		};
	},
	processProjectileData : function(projectileDatas){
		var projectiles = [];
		for(var i=0; i<projectileDatas.length; i++){
			projectiles.push({
				objectID : projectileDatas[i].objectID,
				skillIndex : projectileDatas[i].index,
				position : projectileDatas[i].position,
				speed : projectileDatas[i].speed,
				// startTime : projectileDatas[i].startTime,
				// lifeTime : projectileDatas[i].lifeTime
			});
		}
		return projectiles;
	},
	checkCollisionWithObstacles : function(targetPosition, user){
		var collisionObjs = util.checkCircleCollision(staticTree, targetPosition.x - user.size.width/2, targetPosition.y - user.size.height/2, user.size.width/2, user.objectID);
		return collisionObjs;
	},
	reCalcSkillTargetPosition : function(targetPosition, user, collisionObjs){
		var collisionObj = [collisionObjs[0]];
		var addPos = util.calcCompelPos({
			x : targetPosition.x - user.size.width/2,
			y : targetPosition.y - user.size.height/2,
			width : user.size.width,
			height : user.size.height,
			id : user.objectID
		}, collisionObj);
		return {
			x : targetPosition.x + addPos.x,
			y : targetPosition.y + addPos.y
		}
	},
	setUserChatMsg : function(userID, msg){
		if(userID in this.users){
			this.users[userID].setChatMsg(msg);
		}
	}
};

function staticIntervalHandler(){
	// var clearImg = false;
	// if(Date.now() - collisionClearTime >= gameConfig.IMG_COLLISION_CLEAR_TIME){
	// 	clearImg = true;
	// 	collisionClearTime = Date.now();
	// 	for(var i=0; i<this.obstacles.length; i++){
	// 		// if(this.obstacles[i].treeImgEle){
	// 		// 	this.obstacles[i].treeImgEle.isCollide = false;
	// 		// }
	// 		this.obstacles[i].staticEle.isCollide = false;
	// 	}
	// }
	for(var i=this.userEffects.length - 1; i>=0; i--){
		if(Date.now() - this.userEffects[i].startTime >= this.userEffects[i].resourceLifeTime){
			this.userEffects.splice(i, 1);
		}else if(Date.now() - this.userEffects[i].effectTimer >= gameConfig.USER_DETACH_EFFECT_CHANGE_TIME){
			this.userEffects[i].changeIndex();
		}
	}
	if(Date.now() - this.userEffectTimer >= gameConfig.USER_DETACH_EFFECT_MAKE_TIME){
		for(var index in this.users){
			for(var i=0; i<this.users[index].buffImgDataList.length; i++){
				if(!this.users[index].buffImgDataList[i].isAttach){
					var userEffect = util.makeUserEffect(this.users[index], this.users[index].buffImgDataList[i]);
					this.userEffects.push(userEffect);
				}
			}
		}
		this.userEffectTimer = Date.now();
	}
	if(this.user){
		var collisionObjs = util.checkCircleCollision(treeImgTree, this.user.position.x, this.user.position.y, this.user.size.width/2, this.user.objectID);
		if(collisionObjs.length){
			for(var i=0; i<collisionObjs.length; i++){
				tempCollider = collisionObjs[i];
				if(!collisionObjs[i].isCollide){
					tempCollider.isCollide = true;
					// setTimeout(function(){
					// 	tempCollider.isCollide = false;
					// }, 500);
				}
			}
		}
	}
	var i=checkCollisionEles.length;
	while(i--){
		var collisionObjs = util.checkCircleCollision(staticTree, checkCollisionEles[i].position.x, checkCollisionEles[i].position.y, checkCollisionEles[i].radius, gameConfig.PREFIX_SKILL);
		if(collisionObjs.length){
			for(var j=0; j<collisionObjs.length; j++){
				var tempCollider = collisionObjs[j];
				if(!tempCollider.isCollide){
					tempCollider.isCollide = true;
					// setTimeout(function(){
					// 	tempCollider.isCollide = false;
					// }, gameConfig.SKILL_HIT_EFFECT_TIME);
				}
			}
		}
		checkCollisionEles.splice(i, 1);
	}

	//user elements update for collision check
	for(var index in this.users){
		this.users[index].setEntityEle();
	}
	var i = this.projectiles.length;
  while(i--){
    if(this.projectiles[i].isExpired()){
      this.projectiles.splice(i, 1);
    }else{
      this.projectiles[i].move();
			if(this.projectiles[i].projectileImgData){
				if(Date.now() - this.projectiles[i].effectTimer >= gameConfig.PROJECTILE_EFFECT_CHANGE_TIME) {
					this.projectiles[i].effectTimer = Date.now();
					this.projectiles[i].effectRotateDegree += 10;
				}
			}
			if(this.projectiles[i].type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE || this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE ||
				 this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){
					 //check collision with obstacles
					 var collisionObjs = util.checkCircleCollision(staticTree, this.projectiles[i].position.x, this.projectiles[i].position.y, this.projectiles[i].radius, gameConfig.PREFIX_SKILL_PROJECTILE);
					 if(collisionObjs.length){
						 for(var j=0; j<collisionObjs.length; j++){
							 var tempCollider = collisionObjs[j];
							 if(tempCollider.id.substr(0,3) !== gameConfig.PREFIX_OBSTACLE_CHEST_GROUND && !tempCollider.isCollide){
								 tempCollider.isCollide = true;
								 // setTimeout(function(){
									//  tempCollider.isCollide = false;
								 // }, gameConfig.SKILL_HIT_EFFECT_TIME);
							 }
						 }
					 }
				 }
		}
  }
	var i=this.effects.length;
	while(i--){
		if(!this.effects[i].isCheckCollision){
			if(Date.now() - this.effects[i].startTime > this.effects[i].lifeTime/2){
				checkCollisionEles.push(this.effects[i]);
				this.effects[i].isCheckCollision = true;
			}
		}
		if(this.effects[i].startTime + this.effects[i].lifeTime < Date.now()){
			this.effects.splice(i, 1);
		}else{
			this.effects[i].scaleFactor = util.interpolationSine(Date.now() - this.effects[i].startTime, this.effects[i].lifeTime);
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
var onMainUserMoveHandler = function(user){
	this.onMainUserMove(user);
}
module.exports = CManager;

},{"../public/gameConfig.json":8,"../public/objectAssign.js":9,"../public/quadtree.js":10,"../public/util.js":12,"./CObstacle.js":2,"./CUser.js":5}],2:[function(require,module,exports){
function CObstacle(posX, posY, radius, id, resourceData){
  this.objectID = id;

  this.imgData = resourceData;

  this.position = {
    x : posX, y : posY
  };
  // user when draw obstacle
  // this.localPosition = {
  //   x : posX, y : posY
  // };

  this.size = {
    width : radius * 2, height : radius * 2
  };
  this.center = {
    x : this.position.x + this.size.width/2,
    y : this.position.y + this.size.height/2
  }

  // this.setSize(radius * 2, radius * 2);
  // this.setPosition(posX, posY);

  this.staticEle = {
    x : this.position.x,
    y : this.position.y,
    width : this.size.width,
    height : this.size.height,
    id : this.objectID,

    isCollide : false
  };
};

CObstacle.prototype = {
  setPosition : function(x, y){
    this.position.x = x;
    this.position.y = y;
    this.setCenter();
  },
  setSize : function(w, h){
    this.size.width = w;
    this.size.height = h;
  },
  setCenter : function(){
    if(this.size.width == 0 || this.size.height == 0){
      console.log('setSize before setCenter');
    }
    this.center.x = this.position.x + this.size.width/2;
    this.center.y = this.position.y + this.size.height/2;
  },
  setTreeImgEle : function(treeImgRadius){
    this.treeImgEle = {
      x : this.center.x - treeImgRadius,
      y : this.center.y - treeImgRadius,
      width : treeImgRadius * 2,
      height : treeImgRadius * 2,
      id : this.objectID,

      isCollide : false
    }
  }
};
module.exports = CObstacle;

},{}],3:[function(require,module,exports){
var util = require('../public/util.js');
var gameConfig = require('../public/gameConfig.json');

function CSkill(skillData, userAniStartTime){
  // this.startTime = Date.now();

  this.index = skillData.index;
  this.type = skillData.type;
  this.property = skillData.property;

  this.consumeMP = skillData.consumeMP;
  this.totalTime = skillData.totalTime;
  this.fireTime = skillData.fireTime;
  this.range = skillData.range;
  this.explosionRadius = skillData.explosionRadius;

  this.radius = skillData.radius;
  this.maxSpeed = skillData.maxSpeed;
  this.lifeTime = skillData.lifeTime;

  this.direction = skillData.direction;
  this.targetPosition = skillData.targetPosition;

  this.userAniStartTime = userAniStartTime;
  this.effectLastTime = skillData.effectLastTime;

  this.effect = {
    position : this.targetPosition,
    radius : this.explosionRadius,
    startTime : 0,
    lifeTime  : this.effectLastTime
  };

  this.userAniTimeout = false;
  this.fireTimeout = false;
  this.totalTimeout = false;

  this.onUserAniStart = new Function();
  this.onFire = new Function();
  this.onTimeOver = new Function();
};

CSkill.prototype = {
  executeSkill : function(){
    this.userAniTimeout = setTimeout(userAniTimeoutHandler.bind(this), this.userAniStartTime);

    var skillInformTime = this.fireTime - gameConfig.SKILL_INFORM_TIME;
    if(skillInformTime < 0){
      skillInformTime = 0;
    }
    if(this.userAniStartTime > skillInformTime){
      skillInformTime = this.userAniStartTime;
    }
    this.syncFireTime = Date.now() + this.fireTime; // for synchronize
    this.fireTimeout = setTimeout(fireTimeoutHandler.bind(this), skillInformTime);
    this.totalTimeout = setTimeout(totalTimeoutHandler.bind(this), this.totalTime);
  },
  startEffectTimer : function(){
    this.effect.startTime = Date.now();
  },
  destroy : function(){
    if(this.userAniTimeout){
      clearTimeout(this.userAniTimeout);
    }
    if(this.fireTimeout){
      clearTimeout(this.fireTimeout);
    }
    if(this.totalTimeout){
      clearTimeout(this.totalTimeout);
    }
  },
  makeProjectile : function(userCenter, projectileID, direction){
    var forePosition = util.calcForePosition(userCenter, this.radius, direction, gameConfig.PROJECTILE_FIRE_DISTANCE);
    var projectile = new ProjectileSkill(this, forePosition, projectileID, direction)
    return projectile;
  }
};
function userAniTimeoutHandler(){
  this.onUserAniStart();
};
function fireTimeoutHandler(){
  this.onFire(this.syncFireTime);
};
function totalTimeoutHandler(){
  this.onTimeOver();
};

var ProjectileSkill = function(skillInstance, currentPosition, ID, direction){
  this.objectID = ID;

  this.index = skillInstance.index;
  this.position = {
    x : currentPosition.x,
    y : currentPosition.y
  };
  this.direction = direction;
  this.speed = {
    x : skillInstance.maxSpeed * Math.cos(this.direction * Math.PI/180),
    y : skillInstance.maxSpeed * Math.sin(this.direction * Math.PI/180)
  };
  // this.timer = Date.now();
  this.radius = skillInstance.radius;
  this.lifeTime = skillInstance.lifeTime;
  this.explosionRadius = skillInstance.explosionRadius;
};


module.exports = CSkill;

},{"../public/gameConfig.json":8,"../public/util.js":12}],4:[function(require,module,exports){
var util = require('../public/util.js');
var gameConfig = require('../public/gameConfig.json');
var objectAssign = require('../public/objectAssign.js');
var serverList = require('../public/serverList.json');

var skillTable, buffGroupTable, iconResourceTable, userStatTable;
var resourceUI;

var blankFrameData;

var startScene, gameScene, standingScene;
var startButton, restartButton;

// var startSceneHudCenterCenterChar1, startSceneHudCenterCenterChar2, startSceneHudCenterCenterChar3;
var characterType = 1;

var fireCharName = "PYRO";
var fireCharDesc = "PYRO is fa";
var frostCharName = "FROSTER";
var frostCharDesc = "FROSTER is a";
var arcaneCharName = "MYSTER";
var arcaneCharDesc = "MYSTER is blabla";

var baseSkill = 0;
var baseSkillData = null;
var inherentPassiveSkill = 0;
var inherentPassiveSkillData = null;
var equipSkills = new Array(4);
var equipSkillDatas = new Array(4);
var possessSkills = [];
var newSkills = [gameConfig.TUTORIAL_SKILL_INDEX];
var conditions = [], userMP = 0;;
conditions[gameConfig.USER_CONDITION_FREEZE] = false; conditions[gameConfig.USER_CONDITION_SILENCE] = false;

var statPower = 0, statMagic = 0, statSpeed = 0;
var cooldownReduceRate = 0;

var loadingTextDotCount = 1;
var hudBaseSkillImg, hudEquipSkill1Img, hudEquipSkill2Img, hudEquipSkill3Img, hudEquipSkill4Img, hudPassiveSkillImg;
var hudBtnSkillChange;
var gameSceneBuffsContainer;
var userHPProgressBar, userMPProgressBar, userExpProgressBar;

var isBaseSkillCooldownOff = true, isEquipSkill1CooldownOff = true, isEquipSkill2CooldownOff = true, isEquipSkill3CooldownOff = true, isEquipSkill4CooldownOff = true;
var cooldownSkills = [], standbyEquipPassiveList = [];
var hudBaseSkillMask, hudEquipSkill1Mask, hudEquipSkill2Mask, hudEquipSkill3Mask, hudEquipSkill4Mask;
var hudBaseSkillBlockMask, hudEquipSkill1BlockMask, hudEquipSkill2BlockMask, hudEquipSkill3BlockMask, hudEquipSkill4BlockMask, hudPassiveSkillBlockMask;
var hudBaseSkillConditionBlockMask, hudEquipSkill1ConditionBlockMask, hudEquipSkill2ConditionBlockMask, hudEquipSkill3ConditionBlockMask, hudEquipSkill4ConditionBlockMask;
var gameSceneCharNameAndLevel, userStatOffence, userStatDefence, userStatPowerContainer, userStatMagicContainer, userStatSpeedContainer;
var gameSceneHudTopLeft, gameSceneHudTopCenter, selectSkillIcon, selectSkillInfo, btnSelectSkillCancel;
var goldContainer, jewelContainer, gameBoardRank, gameBoardName, gameBoardLevel, gameBoardKillScore, gameBoardTotalScore;
var gameSceneDeadScene, deadSceneBackground, deadSceneTextContainer, deadSceneText, deadSceneToLevel, deadSceneLoseGold, deadSceneLoseJewel;
var chatInputContainer, chatInput;

var flashMessageContainer, risingMessageContainer;
var beforeRisingMessageTime = Date.now();
var killBoardDisableTimeout = false;

var isClearTutorial = false, isPlayingTutorial = false;
var popUpSkillChange, popUpCloseBtn, popUpSkillContainer, popUpBackground;
var popUpSkillInfoAndBtn, popUpSkillInfoIcon, popUpSkillInfoDesc, skillUpgradeEffect, popUpSkillUpgradeCostGold, popUpSkillUpgradeCostJewel, popUpSkillUpgradeBtn, popUpCancelSkillSelectBtn;
var popUpSkillTutorialClickText1, popUpSkillTutorialClickText2, popUpSkillTutorialArrow, popUpSkillTextSkillInfo;
var popUpEquipBaseSkill, popUpEquipSkillsContainer, popUpEquipSkill1, popUpEquipSkill2, popUpEquipSkill3, popUpEquipSkill4, popUpEquipPassiveSkill;

var standingSceneSelectedCharName, standingSceneSelectedCharStatPower, standingSceneSelectedCharStatMagic, standingSceneSelectedCharStatSpeed,
    standingSceneSelectedCharBaseSkill, standingSceneSelectedCharPassiveSkill, standingSceneSelectedCharEquipSkill1, standingSceneSelectedCharEquipSkill2, standingSceneSelectedCharEquipSkill3, standingSceneSelectedCharEquipSkill4,
    standingSceneSkillSettingBtn, userStandingNickName;

var miniMapUser, miniMapChest1, miniMapChest2, miniMapChest3, miniMapChest4, miniMapChest5, miniMapChest6, miniMapChest7, miniMapChest8, miniMapChest9;

var selectedPanel = null;
var selectedDiv = null;
var selectedEquipIndex = null;
var selectedSkillIndex = null;

var isServerResponse = true;

function UIManager(sTable, bTable, iTable, usTable){
  skillTable = sTable;
  buffGroupTable = bTable;
  iconResourceTable = iTable;
  userStatTable = usTable;

  this.serverResponseTimeout = false;

  this.onLoadCompleteServerList = new Function();
  this.onStartBtnClick = new Function();
  this.serverConditionOn = new Function();
  this.serverConditionOff = new Function();

  this.onPopUpSkillChangeClick = new Function();
  this.onSelectCharIcon = new Function();
  this.onSelectSkillCancelBtnClick = new Function();
  this.onSkillIconClick = new Function();
  this.onSkillUpgrade = new Function();
  this.onExchangeSkill = new Function();
  this.onExchangePassive = new Function();
  this.onEquipPassive = new Function();
  this.onUnequipPassive = new Function();
};
UIManager.prototype = {
  initStartScene : function(){
    startScene = document.getElementById('startScene');
    gameScene = document.getElementById('gameScene');
    standingScene = document.getElementById('standingScene');

    startButton = document.getElementById('startButton');

    var startSceneSelectedCharName = document.getElementById('startSceneSelectedCharName');
    var startSceneSelectedCharStatPower = document.getElementById('startSceneSelectedCharStatPower');
    var startSceneSelectedCharStatMagic = document.getElementById('startSceneSelectedCharStatMagic');
    var startSceneSelectedCharStatSpeed = document.getElementById('startSceneSelectedCharStatSpeed');
    var startSceneSelectedCharDesc = document.getElementById('startSceneSelectedCharDesc');

    //init standing scene variables
    restartButton = document.getElementById('restartButton');
    standingSceneSelectedCharName = document.getElementById('standingSceneSelectedCharName');
    standingSceneSelectedCharStatPower = document.getElementById('standingSceneSelectedCharStatPower');
    standingSceneSelectedCharStatMagic = document.getElementById('standingSceneSelectedCharStatMagic');
    standingSceneSelectedCharStatSpeed = document.getElementById('standingSceneSelectedCharStatSpeed');
    standingSceneSelectedCharBaseSkill = document.getElementById('standingSceneSelectedCharBaseSkill');
    standingSceneSelectedCharPassiveSkill = document.getElementById('standingSceneSelectedCharPassiveSkill');
    standingSceneSelectedCharEquipSkill1 = document.getElementById('standingSceneSelectedCharEquipSkill1');
    standingSceneSelectedCharEquipSkill2 = document.getElementById('standingSceneSelectedCharEquipSkill2');
    standingSceneSelectedCharEquipSkill3 = document.getElementById('standingSceneSelectedCharEquipSkill3');
    standingSceneSelectedCharEquipSkill4 = document.getElementById('standingSceneSelectedCharEquipSkill4');
    standingSceneSelectedCharBaseSkill.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharPassiveSkill.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0].src = resourceUI;

    standingSceneSelectedCharBaseSkill.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharBaseSkill);
    standingSceneSelectedCharBaseSkill.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharBaseSkill);
    standingSceneSelectedCharPassiveSkill.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharPassiveSkill);
    standingSceneSelectedCharPassiveSkill.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharPassiveSkill);
    standingSceneSelectedCharEquipSkill1.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharEquipSkill1);
    standingSceneSelectedCharEquipSkill1.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharEquipSkill1);
    standingSceneSelectedCharEquipSkill2.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharEquipSkill2);
    standingSceneSelectedCharEquipSkill2.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharEquipSkill2);
    standingSceneSelectedCharEquipSkill3.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharEquipSkill3);
    standingSceneSelectedCharEquipSkill3.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharEquipSkill3);
    standingSceneSelectedCharEquipSkill4.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharEquipSkill4);
    standingSceneSelectedCharEquipSkill4.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharEquipSkill4);

    standingSceneSkillSettingBtn = document.getElementById('standingSceneSkillSettingBtn');
    userStandingNickName = document.getElementById('userStandingNickName');

    // startButton.addEventListener('click', startBtnClickHandler.bind(this, startButton), false);
    startButton.onclick = startBtnClickHandler.bind(this, startButton);
    startButton.getElementsByTagName('span')[0].classList.remove('disable');
    startButton.getElementsByTagName('img')[0].classList.add('disable');

    setStartSceneCharIconClick();
    // var children = document.getElementById('startSceneHudCenterCenterCharSelect').children;
    // for(var i=0; i<children.length; i++){
    //   children[i].onclick = function(){
    //     var type = parseInt(this.getAttribute('type'));
    //     if(type === gameConfig.CHAR_TYPE_FIRE || type === gameConfig.CHAR_TYPE_FROST || type === gameConfig.CHAR_TYPE_ARCANE){
    //       characterType = type;
    //     }else{
    //       characterType = gameConfig.CHAR_TYPE_FIRE;
    //     }
    //     for(var j=0; j<children.length; j++){
    //       children[j].classList.remove('selectedChar');
    //     }
    //     this.classList.add('selectedChar');
    //
    //     //updateSelectedPanel
    //     var name = "";
    //     var desc = "";
    //     var color = "";
    //     switch (type) {
    //       case gameConfig.CHAR_TYPE_FIRE:
    //         name = fireCharName;
    //         desc = fireCharDesc;
    //         color = "red";
    //         break;
    //       case gameConfig.CHAR_TYPE_FROST:
    //         name = frostCharName;
    //         desc = frostCharDesc;
    //         color = "blue";
    //         break;
    //       case gameConfig.CHAR_TYPE_ARCANE:
    //         name = arcaneCharName;
    //         desc = arcaneCharDesc;
    //         color = "purple";
    //         break;
    //       default:
    //     }
    //     var statData = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', characterType, 'level', 1));
    //     startSceneSelectedCharName.innerHTML = "<span class='" + color + "'>" + name + "</span>";
    //     startSceneSelectedCharDesc.innerHTML = desc;
    //     startSceneSelectedCharStatPower.getElementsByTagName('span')[0].innerHTML = statData.power;
    //     startSceneSelectedCharStatMagic.getElementsByTagName('span')[0].innerHTML = statData.magic;
    //     startSceneSelectedCharStatSpeed.getElementsByTagName('span')[0].innerHTML = statData.speed;
    //
    //     startSceneSelectedCharStatPower.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatPower, gameConfig.STAT_POWER_INDEX, statData.power);
    //     startSceneSelectedCharStatPower.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatPower);
    //
    //     startSceneSelectedCharStatMagic.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatMagic, gameConfig.STAT_MAGIC_INDEX, statData.magic);
    //     startSceneSelectedCharStatMagic.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatMagic);
    //
    //     startSceneSelectedCharStatSpeed.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatSpeed, gameConfig.STAT_SPEED_INDEX, statData.speed);
    //     startSceneSelectedCharStatSpeed.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatSpeed);
    //   };
    // }
    // children[0].onclick();
  },
  setServerList : function(){
    var servers = document.getElementById('servers');
    var req = util.createRequest();
    var startTime = Date.now();

    req.onreadystatechange = function(e){
      if(req.readyState === 4){
        if(req.status === 200){
          var res = JSON.parse(req.response);
          if(res.serverState === 'serverOn'){
            var ping = Date.now() - startTime;
            util.createDomSelectOption(index, ip, false, servers, res, ping);
          }
        }
      }
    }
    util.createDomSelectOption("NA", "", true, servers);
    var ip = "";
    for(var index in serverList.NA){
      ip = 'http://' + serverList.NA[index];
      try {
        startTime = Date.now();
        req.open('POST', ip + '/usersInfo', false);
        // req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.send();
      } catch (e) {
        console.log(e.message);
        console.log(ip + ' is not response');
      }
    }
    util.createDomSelectOption("ASIA", "", true, servers);
    for(var index in serverList.ASIA){
      ip = 'http://' + serverList.ASIA[index];
      try {
        startTime = Date.now();
        req.open('POST', ip + '/usersInfo', false);
        // req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.send();
      } catch (e) {
        console.log(e.message);
        console.log(ip + 'is not response');
      }
    }
    util.createDomSelectOption("EU", "", true, servers);
    for(var index in serverList.EU){
      ip = 'http://' + serverList.EU[index];
      try {
        startTime = Date.now();
        req.open('POST', ip + '/usersInfo', false);
        // req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.send();
      } catch (e) {
        console.log(e.message);
        console.log(ip + 'is not response');
      }
    }
    this.onLoadCompleteServerList();
  },
  getSelectedServer : function(){
    var servers = document.getElementById('servers');
    return servers.options[servers.selectedIndex].value;
  },
  getStartUserName : function(){
    var userStartNickName = document.getElementById('userStartNickName').value;
    if(userStartNickName){
      return util.processMessage(userStartNickName);
    }else{
      return "noname";
    }
  },
  getStandingUserName : function(){
    // var userStandingNickName = document.getElementById('userStandingNickName').value;
    var nickName = userStandingNickName.value;
    if(nickName){
      return util.processMessage(nickName);
    }else{
      return "noname";
    }
  },
  checkServerCondition : function(url){
    var req = util.createRequest();
    var startTime = Date.now();
    var thisServerConditionOn = this.serverConditionOn;
    var thisServerConditionOff = this.serverConditionOff;

    req.onreadystatechange = function(e){
      if(req.readyState === 4){
        if(req.status === 200){
          var res = JSON.parse(req.response);
          var ping = Date.now() - startTime;
          if(res.canJoin){
            if(ping < gameConfig.MAX_PING_LIMIT){
              thisServerConditionOn();
            }else{
              alert('Ping is too high! How about join to other server.');
              thisServerConditionOff();
            }
          }else{
            alert('The server is currently full! How about join to other server.');
            thisServerConditionOff();
          }
        }else{
          alert('Sorry. Unpredicted internet server error!');
          thisServerConditionOff();
        }
      }
    }

    try {
      startTime = Date.now();
      req.open('POST', url + '/serverCheck', false);
      // req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      req.send();
    } catch (e) {
      console.log(e.message);
      console.log(url + ' is not response');
    }
  },
  disableStartButton : function(){
    startButton.onclick = '';
    startButton.getElementsByTagName('span')[0].classList.add('disable');
    startButton.getElementsByTagName('img')[0].classList.remove('disable');

    //char icon disable
    var children = document.getElementById('startSceneHudCenterCenterCharSelect').children;
    for(var i=0; i<children.length; i++){
      children[i].onclick = new Function();
    }
  },
  enableStartButton : function(){
    startButton.onclick = startBtnClickHandler.bind(this, startButton);
    startButton.getElementsByTagName('span')[0].classList.remove('disable');
    startButton.getElementsByTagName('img')[0].classList.add('disable');

    setStartSceneCharIconClick();
  },
  disableStartScene : function(){
    // startScene.classList.add('disable');
    startScene.classList.add('disappearSmoothAni');
    startScene.classList.remove('enable');
    setTimeout(function(){
      startScene.classList.add('disable');
    }, 1000);
    // startScene.addEventListener('animationend', function(){
    //   startScene.classList.add('disable');
    // }, false);
    gameScene.classList.add('appearSmoothAni');
    gameScene.classList.remove('disable');
    setTimeout(function(){
      gameScene.classList.add('enable');
      gameScene.classList.remove('appearSmoothAni');
    }, 1000);
    // startButton.removeEventListener('click', startBtnClickHandler);
  },
  initStandingScene : function(charType, userName){
    standingScene.classList.add('appearSmoothAni');
    standingScene.classList.remove('disable');
    standingScene.classList.add('enable');
    setTimeout(function(){
      // standingScene.classList.add('enable');
      standingScene.classList.remove('appearSmoothAni');
      restartButton.getElementsByTagName('span')[0].classList.remove('disable');
      restartButton.getElementsByTagName('img')[0].classList.add('disable');
    }, 1000);

    if(userName !== 'noname'){
      userStandingNickName.value = userName;
    }

    var index = 0;
    switch (charType) {
      case gameConfig.CHAR_TYPE_FIRE:
        index = 0;
        break;
      case gameConfig.CHAR_TYPE_FROST:
        index = 1;
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        index = 2;
        break;
      default:
    }
    // restartButton.addEventListener('click', startBtnClickHandler.bind(this, restartButton), false);
    restartButton.onclick = startBtnClickHandler.bind(this, restartButton);
    // restartButton.getElementsByTagName('span')[0].classList.remove('disable');
    // restartButton.getElementsByTagName('img')[0].classList.add('disable');

    var thisCharSelectEvent = this.onSelectCharIcon;

    var children = document.getElementById('standingSceneHudCenterCenterCharSelect').children;
    for(var i=0; i<children.length; i++){
      if(index === i){
        for(var j=0; j<children.length; j++){
          children[j].classList.remove('selectedChar');
        }
        children[i].classList.add('selectedChar');
      }

      children[i].onclick = function(){
        var type = parseInt(this.getAttribute('type'));
        if(type === gameConfig.CHAR_TYPE_FIRE || type === gameConfig.CHAR_TYPE_FROST || type === gameConfig.CHAR_TYPE_ARCANE){
          characterType = type;
          for(var j=0; j<children.length; j++){
            children[j].classList.remove('selectedChar');
          }
          this.classList.add('selectedChar');

          // updateCharInfoSelectedPanel(type);
          thisCharSelectEvent(type);
        }else{
          //if type data is changed by user, always click fire
          thisCharSelectEvent(gameConfig.CHAR_TYPE_FIRE);
        }
      };
    }
    children[index].onclick();

    standingSceneSkillSettingBtn.onclick = function(){
      clearSelectedPanel();
      this.onPopUpSkillChangeClick();

      popChange(popUpSkillChange);
      if(!isClearTutorial){
        playPopUpTutorial();
      }else{
        disablePopUpTutorial();
      }
    }
  },
  updateCharInfoSelectedPanel : function(type, level){
    var name = "";
    var color = "white";
    switch (type) {
      case gameConfig.CHAR_TYPE_FIRE:
        name = fireCharName;
        color = "red";
        break;
      case gameConfig.CHAR_TYPE_FROST:
        name = frostCharName;
        color = "blue";
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        name = arcaneCharName;
        color = "purple";
        break;
      default:
    }
    var statData = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', type, 'level', level));
    standingSceneSelectedCharName.innerHTML = "<span class='yellow'>Lv " + level + " </span><span class='" + color + "'>" + name + "</span>";

    standingSceneSelectedCharStatPower.getElementsByTagName('span')[0].innerHTML = statData.power;
    standingSceneSelectedCharStatMagic.getElementsByTagName('span')[0].innerHTML = statData.magic;
    standingSceneSelectedCharStatSpeed.getElementsByTagName('span')[0].innerHTML = statData.speed;

    standingSceneSelectedCharStatPower.onmouseover = statTooltipOnHandler.bind(standingSceneSelectedCharStatPower, gameConfig.STAT_POWER_INDEX, statData.power);
    standingSceneSelectedCharStatPower.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharStatPower);

    standingSceneSelectedCharStatMagic.onmouseover = statTooltipOnHandler.bind(standingSceneSelectedCharStatMagic, gameConfig.STAT_MAGIC_INDEX, statData.magic);
    standingSceneSelectedCharStatMagic.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharStatMagic);

    standingSceneSelectedCharStatSpeed.onmouseover = statTooltipOnHandler.bind(standingSceneSelectedCharStatSpeed, gameConfig.STAT_SPEED_INDEX, statData.speed);
    standingSceneSelectedCharStatSpeed.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharStatSpeed);

    updateCharInfoSelectedPanelSkillImage();
  },
  disableStandingScene : function(){
    //char icon selet event disable
    var children = document.getElementById('standingSceneHudCenterCenterCharSelect').children;
    for(var i=0; i<children.length; i++){
      children[i].onclick = '';
    }

    standingScene.classList.add('disappearSmoothAni');
    standingScene.classList.remove('enable');
    setTimeout(function(){
      standingScene.classList.add('disable');
      standingScene.classList.remove('disappearSmoothAni');
    }, 1000);
    // standingScene.addEventListener('animationend', function(){
    //   standingScene.classList.add('disable');
    // }, false);
    gameScene.classList.add('appearSmoothAni');
    gameScene.classList.remove('disable');
    setTimeout(function(){
      gameScene.classList.add('enable');
      gameScene.classList.remove('appearSmoothAni');
    }, 1000);
    // gameScene.classList.add('enable');
    // gameScene.classList.remove('disable');

    restartButton.onclick = '';
    restartButton.getElementsByTagName('span')[0].classList.add('disable');
    restartButton.getElementsByTagName('img')[0].classList.remove('disable');
    standingSceneSkillSettingBtn.onclick = '';
    // restartButton.removeEventListener('click', startBtnClickHandler);
  },
  initHUD : function(){
    hudBaseSkillImg = document.getElementById('hudBaseSkillImg');
    hudEquipSkill1Img = document.getElementById('hudEquipSkill1Img');
    hudEquipSkill2Img = document.getElementById('hudEquipSkill2Img');
    hudEquipSkill3Img = document.getElementById('hudEquipSkill3Img');
    hudEquipSkill4Img = document.getElementById('hudEquipSkill4Img');
    hudPassiveSkillImg = document.getElementById('hudPassiveSkillImg');

    hudBaseSkillImg.src = resourceUI;
    hudEquipSkill1Img.src = resourceUI;
    hudEquipSkill2Img.src = resourceUI;
    hudEquipSkill3Img.src = resourceUI;
    hudEquipSkill4Img.src = resourceUI;
    hudPassiveSkillImg.src = resourceUI;

    hudBaseSkillImg.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudBaseSkillImg, gameConfig.SKILL_BASIC_INDEX), false);
    hudEquipSkill1Img.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudEquipSkill1Img, gameConfig.SKILL_EQUIP1_INDEX), false);
    hudEquipSkill2Img.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudEquipSkill2Img, gameConfig.SKILL_EQUIP2_INDEX), false);
    hudEquipSkill3Img.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudEquipSkill3Img, gameConfig.SKILL_EQUIP3_INDEX), false);
    hudEquipSkill4Img.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudEquipSkill4Img, gameConfig.SKILL_EQUIP4_INDEX), false);
    hudPassiveSkillImg.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudPassiveSkillImg, gameConfig.SKILL_PASSIVE_INDEX), false);

    hudBaseSkillImg.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudBaseSkillImg), false);
    hudEquipSkill1Img.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudEquipSkill1Img), false);
    hudEquipSkill2Img.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudEquipSkill2Img), false);
    hudEquipSkill3Img.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudEquipSkill3Img), false);
    hudEquipSkill4Img.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudEquipSkill4Img), false);
    hudPassiveSkillImg.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudPassiveSkillImg), false);

    hudBaseSkillImg.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_BASIC_INDEX);
    hudEquipSkill1Img.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_EQUIP1_INDEX);
    hudEquipSkill2Img.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_EQUIP2_INDEX);
    hudEquipSkill3Img.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_EQUIP3_INDEX);
    hudEquipSkill4Img.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_EQUIP4_INDEX);

    hudBtnSkillChange = document.getElementById('hudBtnSkillChange');

    gameSceneBuffsContainer = document.getElementById('gameSceneBuffsContainer');
    userHPProgressBar = document.getElementById('userHPProgressBar');
    userExpProgressBar = document.getElementById('userExpProgressBar');
    userMPProgressBar = document.getElementById('userMPProgressBar');

    hudBaseSkillMask = document.getElementById('hudBaseSkillMask');
    hudEquipSkill1Mask = document.getElementById('hudEquipSkill1Mask');
    hudEquipSkill2Mask = document.getElementById('hudEquipSkill2Mask');
    hudEquipSkill3Mask = document.getElementById('hudEquipSkill3Mask');
    hudEquipSkill4Mask = document.getElementById('hudEquipSkill4Mask');

    hudBaseSkillMask.addEventListener('animationend', cooldownListener.bind(hudBaseSkillMask, gameConfig.SKILL_BASIC_INDEX, this.checkSkillsConditions), false);
    hudEquipSkill1Mask.addEventListener('animationend', cooldownListener.bind(hudEquipSkill1Mask, gameConfig.SKILL_EQUIP1_INDEX, this.checkSkillsConditions), false);
    hudEquipSkill2Mask.addEventListener('animationend', cooldownListener.bind(hudEquipSkill2Mask, gameConfig.SKILL_EQUIP2_INDEX, this.checkSkillsConditions), false);
    hudEquipSkill3Mask.addEventListener('animationend', cooldownListener.bind(hudEquipSkill3Mask, gameConfig.SKILL_EQUIP3_INDEX, this.checkSkillsConditions), false);
    hudEquipSkill4Mask.addEventListener('animationend', cooldownListener.bind(hudEquipSkill4Mask, gameConfig.SKILL_EQUIP4_INDEX, this.checkSkillsConditions), false);

    hudBaseSkillBlockMask = document.getElementById('hudBaseSkillBlockMask');
    hudEquipSkill1BlockMask = document.getElementById('hudEquipSkill1BlockMask');
    hudEquipSkill2BlockMask = document.getElementById('hudEquipSkill2BlockMask');
    hudEquipSkill3BlockMask = document.getElementById('hudEquipSkill3BlockMask');
    hudEquipSkill4BlockMask = document.getElementById('hudEquipSkill4BlockMask');
    hudPassiveSkillBlockMask = document.getElementById('hudPassiveSkillBlockMask');

    hudBaseSkillConditionBlockMask = document.getElementById('hudBaseSkillConditionBlockMask');
    hudEquipSkill1ConditionBlockMask = document.getElementById('hudEquipSkill1ConditionBlockMask');
    hudEquipSkill2ConditionBlockMask = document.getElementById('hudEquipSkill2ConditionBlockMask');
    hudEquipSkill3ConditionBlockMask = document.getElementById('hudEquipSkill3ConditionBlockMask');
    hudEquipSkill4ConditionBlockMask = document.getElementById('hudEquipSkill4ConditionBlockMask');

    gameSceneCharNameAndLevel = document.getElementById('gameSceneCharNameAndLevel');
    userStatOffence = document.getElementById('userStatOffence');
    userStatDefence = document.getElementById('userStatDefence');

    userStatPowerContainer = document.getElementById('userStatPowerContainer');
    userStatMagicContainer = document.getElementById('userStatMagicContainer');
    userStatSpeedContainer = document.getElementById('userStatSpeedContainer');

    miniMapUser = document.getElementById('miniMapUser');
    miniMapChest1 = document.getElementById('miniMapChest1');
    miniMapChest2 = document.getElementById('miniMapChest2');
    miniMapChest3 = document.getElementById('miniMapChest3');
    miniMapChest4 = document.getElementById('miniMapChest4');
    miniMapChest5 = document.getElementById('miniMapChest5');
    miniMapChest6 = document.getElementById('miniMapChest6');
    miniMapChest7 = document.getElementById('miniMapChest7');
    miniMapChest8 = document.getElementById('miniMapChest8');
    miniMapChest9 = document.getElementById('miniMapChest9');

    gameSceneHudTopLeft = document.getElementById('gameSceneHudTopLeft');
    gameSceneHudTopCenter = document.getElementById('gameSceneHudTopCenter');
    selectSkillImgContainer = document.getElementById('selectSkillImgContainer');
    // selectSkillIcon = document.getElementById('selectSkillIcon');
    // selectSkillIcon.src = resourceUI;
    selectSkillInfo = document.getElementById('selectSkillInfo');
    btnSelectSkillCancel = document.getElementById('btnSelectSkillCancel');
    btnSelectSkillCancel.onclick = onSelectSkillCancelBtnClickHandler.bind(this);
    goldContainer = document.getElementById('goldContainer');
    jewelContainer = document.getElementById('jewelContainer');
    gameBoardRank = document.getElementById('gameBoardRank');
    gameBoardName = document.getElementById('gameBoardName');
    gameBoardLevel = document.getElementById('gameBoardLevel');
    gameBoardKillScore = document.getElementById('gameBoardKillScore');
    gameBoardTotalScore = document.getElementById('gameBoardTotalScore');

    gameSceneDeadScene = document.getElementById('gameSceneDeadScene');
    deadSceneBackground = document.getElementById('deadSceneBackground');
    deadSceneTextContainer = document.getElementById('deadSceneTextContainer');
    deadSceneText = document.getElementById('deadSceneText');
    deadSceneToLevel = document.getElementById('deadSceneToLevel');
    deadSceneLoseGold = document.getElementById('deadSceneLoseGold');
    deadSceneLoseJewel = document.getElementById('deadSceneLoseJewel');

    chatInputContainer = document.getElementById('chatInputContainer');
    chatInput = document.getElementById('chatInput');

    flashMessageContainer = document.getElementById('flashMessageContainer');
    risingMessageContainer = document.getElementById('risingMessageContainer');
  },
  changeLoadingText : function(){
    var loadingText = document.getElementById('loadingText');
    var output = "Loading ";
    switch (loadingTextDotCount) {
      case 1:
        output += ".";
        break;
      case 2:
        output += "..";
        break;
      case 3:
        output += "...";
        break;
    }
    loadingTextDotCount ++;
    if(loadingTextDotCount > 3){
      loadingTextDotCount = 1;
    }
    loadingText.innerHTML = output;
  },
  startSceneLoadingComplete : function(){
    var loadingImgContainer = document.getElementById('loadingImgContainer');
    var startSceneHudContent = document.getElementById('startSceneHudContent');
    loadingImgContainer.classList.add('disappearSmoothAni');
    setTimeout(function(){
      loadingImgContainer.classList.remove('disappearSmoothAni');
      loadingImgContainer.classList.add('disable');
    }, 1000);
        startSceneHudContent.classList.remove('disable');
    startSceneHudContent.classList.add('appearSmoothAni');
    setTimeout(function(){
      startSceneHudContent.classList.remove('appearSmoothAni');
    }, 1000);
  },
  drawStartScene : function(){
    // var loadingImgContainer = document.getElementById('loadingImgContainer');
    // var startSceneHudContent = document.getElementById('startSceneHudContent');
    // startSceneHudContent.classList.remove('disable');
    // startScene.classList.add('enable');
    // startScene.classList.remove('disable');
    gameScene.classList.add('disable');
    // gameScene.classList.remove('enable');
    standingScene.classList.add('disable');
    // standingScene.classList.remove('enable');
  },
  drawGameScene : function(){
    startScene.classList.add('disable');
    standingScene.classList.add('disable');
  },
  drawRestartScene : function(){
    startScene.classList.add('disable');
    gameScene.classList.add('disable');
    // standingScene.classList.add('enable');
    // startScene.classList.add('disable');
    // startScene.classList.remove('enable');
    // gameScene.classList.add('disappearSmoothAni');
    // gameScene.classList.remove('enable');
    // setTimeout(function(){
    //   gameScene.classList.add('disable');
    //   gameScene.classList.remove('disappearSmoothAni');
    // }, 1000);

    // standingScene.classList.add('appearSmoothAni');
    // standingScene.classList.remove('disable');
    // setTimeout(function(){
    //   standingScene.classList.add('enable');
    //   standingScene.classList.remove('appearSmoothAni');
    // }, 1000);
    // gameScene.classList.add('disable');
    // gameScene.classList.remove('enable');
    // standingScene.classList.add('enable');
    // standingScene.classList.remove('disable');
  },
  enableSelectSkillInfo : function(skillData){
    // selectSkillIcon.src = skillData.skillIcon;
    var img = document.createElement('img');
    var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
    img.src = resourceUI;
    var rate = 80/72;
    img.style.clip = util.makeCssClipStyle(iconData, rate);
    util.setImgCssStyle(img, iconData, rate);
    selectSkillImgContainer.appendChild(img);
    // selectSkillIcon.style.clip = util.makeCssClipStyle(iconData);
    // util.setImgCssStyle(selectSkillIcon, iconData);
    var color = 'white';
    switch (skillData.property) {
      case gameConfig.SKILL_PROPERTY_FIRE:
        color = 'red'
        break;
      case gameConfig.SKILL_PROPERTY_FROST:
        color = 'blue'
        break;
      case gameConfig.SKILL_PROPERTY_ARCANE:
        color = 'purple'
        break;
      default:
    }
    selectSkillInfo.getElementsByTagName('h4')[0].innerHTML = "<span class='yellow'>Lv " + skillData.level + " </span><span class='" + color + "'>" + skillData.clientName + "</span>";
    selectSkillInfo.getElementsByTagName('div')[0].innerHTML = "<span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span>";
    selectSkillInfo.getElementsByTagName('div')[1].innerHTML = "<span class='yellow'>ManaCost : </span>" + (skillData.consumeMP);
    selectSkillInfo.getElementsByTagName('div')[2].innerHTML = skillData.clientDesc;

    gameSceneHudTopCenter.classList.add('enable');
    gameSceneHudTopCenter.classList.remove('disable');

    switch (skillData.index) {
      case baseSkill:
        hudEquipSkill1BlockMask.classList.remove('disable');
        hudEquipSkill2BlockMask.classList.remove('disable');
        hudEquipSkill3BlockMask.classList.remove('disable');
        hudEquipSkill4BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      case equipSkills[0]:
        hudBaseSkillBlockMask.classList.remove('disable');
        hudEquipSkill2BlockMask.classList.remove('disable');
        hudEquipSkill3BlockMask.classList.remove('disable');
        hudEquipSkill4BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      case equipSkills[1]:
        hudBaseSkillBlockMask.classList.remove('disable');
        hudEquipSkill1BlockMask.classList.remove('disable');
        hudEquipSkill3BlockMask.classList.remove('disable');
        hudEquipSkill4BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      case equipSkills[2]:
        hudBaseSkillBlockMask.classList.remove('disable');
        hudEquipSkill1BlockMask.classList.remove('disable');
        hudEquipSkill2BlockMask.classList.remove('disable');
        hudEquipSkill4BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      case equipSkills[3]:
        hudBaseSkillBlockMask.classList.remove('disable');
        hudEquipSkill1BlockMask.classList.remove('disable');
        hudEquipSkill2BlockMask.classList.remove('disable');
        hudEquipSkill3BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      default:
    }
  },
  disableSelectSkillInfo : function(){
    // selectSkillIcon.src = "";
    while (selectSkillImgContainer.firstChild) {
      selectSkillImgContainer.removeChild(selectSkillImgContainer.firstChild);
    }
    selectSkillInfo.getElementsByTagName('h4')[0].innerHTML = "";

    gameSceneHudTopCenter.classList.add('disable');
    gameSceneHudTopCenter.classList.remove('enable');

    hudBaseSkillBlockMask.classList.add('disable');
    hudEquipSkill1BlockMask.classList.add('disable');
    hudEquipSkill2BlockMask.classList.add('disable');
    hudEquipSkill3BlockMask.classList.add('disable');
    hudEquipSkill4BlockMask.classList.add('disable');
    hudPassiveSkillBlockMask.classList.add('disable');
  },
  syncSkills : function(bSkill, bSkillData, eSkills, eSkillDatas, pSkills, iSkill, iSkillData){
    baseSkill = bSkill;
    baseSkillData = bSkillData;
    equipSkills = eSkills;
    equipSkillDatas = eSkillDatas;
    possessSkills = pSkills;
    inherentPassiveSkill = iSkill;
    inherentPassiveSkillData = iSkillData;
  },
  updatePossessionSkills : function(pSkills){
    possessSkills = pSkills;
  },
  updateNewSkills : function(nSkills){
    for(var i=0; i<nSkills.length; i++){
      // if(!newSkills.includes(nSkills[i])){
      if(newSkills.indexOf(nSkills[i]) === -1){
        newSkills.push(nSkills[i]);
      }
    }
    var imgTags = hudBtnSkillChange.parentNode.getElementsByTagName('img');
    imgTags[0].classList.add('disable');
    var standingSceneImgTags = standingSceneSkillSettingBtn.getElementsByTagName('img');
    standingSceneImgTags[0].classList.add('disable');
    if(newSkills.length){
      imgTags[0].classList.remove('disable');
      standingSceneImgTags[0].classList.remove('disable');
    }
  },
  updateHP : function(userData){
    var percent = userData.HP/userData.maxHP * 100;
    if(percent > 100){
      percent = 100;
    }
    userHPProgressBar.style.height = percent + "%";
    var textDiv = userHPProgressBar.parentNode.getElementsByTagName('div')[1];
    textDiv.innerHTML = Math.floor(userData.HP) + "<br>/ " + Math.floor(userData.maxHP);
  },
  updateMP : function(userData){
    userMP = userData.MP;
    var percent = userData.MP/userData.maxMP * 100;
    if(percent > 100){
      percent = 100;
    }
    userMPProgressBar.style.height = percent + "%";
    var textDiv = userMPProgressBar.parentNode.getElementsByTagName('div')[1];
    textDiv.innerHTML = Math.floor(userData.MP) + "<br>/ " + Math.floor(userData.maxMP);
  },
  updateExp : function(userData, needExp){
    var percent = userData.exp / needExp * 100;
    if(percent > 100){
      percent = 100;
    }
    userExpProgressBar.style.width = percent + "%";
  },
  updateCondition : function(userConditions){
    conditions[gameConfig.USER_CONDITION_FREEZE] = userConditions[gameConfig.USER_CONDITION_FREEZE];
    conditions[gameConfig.USER_CONDITION_SILENCE] = userConditions[gameConfig.USER_CONDITION_SILENCE];
  },
  checkSkillsConditions : function(){
    var allSkillDisable = false;
    var baseSkillDisable = false, equipSkill1Disable = false, equipSkill2Disable = false, equipSkill3Disable = false, equipSkill4Disable = false;

    if(conditions[gameConfig.USER_CONDITION_FREEZE] || conditions[gameConfig.USER_CONDITION_SILENCE]){
      allSkillDisable = true;
    }else{
      //check mana and cooldown
      if(!isBaseSkillCooldownOff){
        baseSkillDisable = true;
      }
      if(equipSkillDatas[0]){
        if(equipSkillDatas[0].consumeMP > userMP){
          equipSkill1Disable = true;
        }else if(!isEquipSkill1CooldownOff){
          equipSkill1Disable = true;
        }else if(equipSkillDatas[0].type === gameConfig.SKILL_TYPE_PASSIVE){
          equipSkill1Disable = true;
        }
      }
      if(equipSkillDatas[1]){
        if(equipSkillDatas[1].consumeMP > userMP){
          equipSkill2Disable = true;
        }else if(!isEquipSkill2CooldownOff){
          equipSkill2Disable = true;
        }else if(equipSkillDatas[1].type === gameConfig.SKILL_TYPE_PASSIVE){
          equipSkill2Disable = true;
        }
      }
      if(equipSkillDatas[2]){
        if(equipSkillDatas[2].consumeMP > userMP){
          equipSkill3Disable = true;
        }else if(!isEquipSkill3CooldownOff){
          equipSkill3Disable = true;
        }else if(equipSkillDatas[2].type === gameConfig.SKILL_TYPE_PASSIVE){
          equipSkill3Disable = true;
        }
      }
      if(equipSkillDatas[3]){
        if(equipSkillDatas[3].consumeMP > userMP){
          equipSkill4Disable = true;
        }else if(!isEquipSkill4CooldownOff){
          equipSkill4Disable = true;
        }else if(equipSkillDatas[3].type === gameConfig.SKILL_TYPE_PASSIVE){
          equipSkill4Disable = true;
        }
      }
    }
    if(allSkillDisable){
      hudBaseSkillConditionBlockMask.classList.remove('disable');
      hudEquipSkill1ConditionBlockMask.classList.remove('disable');
      hudEquipSkill2ConditionBlockMask.classList.remove('disable');
      hudEquipSkill3ConditionBlockMask.classList.remove('disable');
      hudEquipSkill4ConditionBlockMask.classList.remove('disable');
    }else{
      hudBaseSkillConditionBlockMask.classList.add('disable');
      hudEquipSkill1ConditionBlockMask.classList.add('disable');
      hudEquipSkill2ConditionBlockMask.classList.add('disable');
      hudEquipSkill3ConditionBlockMask.classList.add('disable');
      hudEquipSkill4ConditionBlockMask.classList.add('disable');
      if(baseSkillDisable){
        hudBaseSkillConditionBlockMask.classList.remove('disable');
      }
      if(equipSkill1Disable){
        hudEquipSkill1ConditionBlockMask.classList.remove('disable');
      }
      if(equipSkill2Disable){
        hudEquipSkill2ConditionBlockMask.classList.remove('disable');
      }
      if(equipSkill3Disable){
        hudEquipSkill3ConditionBlockMask.classList.remove('disable');
      }
      if(equipSkill4Disable){
        hudEquipSkill4ConditionBlockMask.classList.remove('disable');
      }
    }
  },
  applySkill : function(skillIndex, remainCooldown){
    //check skill slot
    var slotMask = null;
    var cooldownData = {};
    if(baseSkill === skillIndex){
      slotMask = hudBaseSkillMask;
      isBaseSkillCooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_BASIC_INDEX;
    }else if(equipSkills[0] === skillIndex){
      slotMask = hudEquipSkill1Mask;
      isEquipSkill1CooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_EQUIP1_INDEX;
    }else if(equipSkills[1] === skillIndex){
      slotMask = hudEquipSkill2Mask;
      isEquipSkill2CooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_EQUIP2_INDEX;
    }else if(equipSkills[2] === skillIndex){
      slotMask = hudEquipSkill3Mask;
      isEquipSkill3CooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_EQUIP3_INDEX;
    }else if(equipSkills[3] === skillIndex){
      slotMask = hudEquipSkill4Mask;
      isEquipSkill4CooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_EQUIP4_INDEX;
    }else{
      console.log('can not find skill slot');
    }
    //cooldown start
    if(slotMask){
      var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
      if(remainCooldown){
        var cooldown = remainCooldown / 1000;
      }else{
        cooldown = skillData.cooldown * (100 - cooldownReduceRate) / 100000;
        cooldownData.skillIndex = skillData.index;
        cooldownData.startTime = Date.now();
        cooldownData.cooldownTime = cooldown;
        cooldownSkills.push(cooldownData);
      }
      slotMask.style.animationDuration = (cooldown) + 's';
      slotMask.classList.add("cooldownMaskAni");
    }
  },
  applySkillCooldown : function(skillIndex, equipIndex){
    var slot = convertEquipIndexToEnum(equipIndex);
    var slotCooldown = 0;
    for(var i=0; i<cooldownSkills.length; i++){
      if(cooldownSkills[i].slot === slot){
        var delayTime = Date.now() - cooldownSkills[i].startTime;
        slotCooldown = cooldownSkills[i].cooldownTime * 1000 - delayTime;
      }
    }
    for(var i=0; i<cooldownSkills.length; i++){
      if(cooldownSkills[i].skillIndex === skillIndex){
        var delayTime = Date.now() - cooldownSkills[i].startTime;
        var skillCooldown = cooldownSkills[i].cooldownTime * 1000 - delayTime;
        if(skillCooldown > slotCooldown){
          if(skillCooldown >= 500){
            this.applySkill(skillIndex, skillCooldown);
          }
        }
      }
    }
  },
  updateUnEquipSkillSlotCooldown : function(equipIndex){
    //convert equipIndex to enum skill slot index
    var slot = convertEquipIndexToEnum(equipIndex);
    var needClear = true;
    for(var i=0; i<cooldownSkills.length; i++){
      if(cooldownSkills[i].slot === slot){
        needClear = false;
      }
    }
    if(needClear){
      switch (slot) {
        case gameConfig.SKILL_EQUIP1_INDEX:
          isEquipSkill1CooldownOff = true;
          hudEquipSkill1Mask.classList.remove("cooldownMaskAni");
          hudEquipSkill1Mask.style.opacity = 0;
          break;
        case gameConfig.SKILL_EQUIP2_INDEX:
          isEquipSkill2CooldownOff = true;
          hudEquipSkill2Mask.classList.remove("cooldownMaskAni");
          hudEquipSkill2Mask.style.opacity = 0;
          break;
        case gameConfig.SKILL_EQUIP3_INDEX:
          isEquipSkill3CooldownOff = true;
          hudEquipSkill3Mask.classList.remove("cooldownMaskAni");
          hudEquipSkill3Mask.style.opacity = 0;
          break;
        case gameConfig.SKILL_EQUIP4_INDEX:
          isEquipSkill4CooldownOff = true;
          hudEquipSkill4Mask.classList.remove("cooldownMaskAni");
          hudEquipSkill4Mask.style.opacity = 0;
          break;
        default:
      }
      this.checkSkillsConditions();
    }
  },
  checkCooltime : function(skillIndex){
    switch (skillIndex) {
      case baseSkill:
        return isBaseSkillCooldownOff;
      case equipSkills[0]:
        return isEquipSkill1CooldownOff;
      case equipSkills[1]:
        return isEquipSkill2CooldownOff;
      case equipSkills[2]:
        return isEquipSkill3CooldownOff;
      case equipSkills[3]:
        return isEquipSkill4CooldownOff;
      default:
    }
  },
  setHUDSkills : function(){
    var rate = 60 / 72;
    if(baseSkillData){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', baseSkillData.skillIcon));
      hudBaseSkillImg.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudBaseSkillImg, iconData, rate);
    }else{
      hudBaseSkillImg.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudBaseSkillImg, blankFrameData, rate);
    }
    if(inherentPassiveSkillData){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', inherentPassiveSkillData.skillIcon));
      hudPassiveSkillImg.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudPassiveSkillImg, iconData, rate);
    }else{
      hudPassiveSkillImg.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudPassiveSkillImg, blankFrameData, rate);
    }
    rate = 80 / 72;
    if(equipSkillDatas[0]){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[0].skillIcon));
      hudEquipSkill1Img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudEquipSkill1Img, iconData, rate);
    }else{
      hudEquipSkill1Img.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudEquipSkill1Img, blankFrameData, rate);
    }
    if(equipSkillDatas[1]){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[1].skillIcon));
      hudEquipSkill2Img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudEquipSkill2Img, iconData, rate);
    }else{
      hudEquipSkill2Img.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudEquipSkill2Img, blankFrameData, rate);
    }
    if(equipSkillDatas[2]){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[2].skillIcon));
      hudEquipSkill3Img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudEquipSkill3Img, iconData, rate);
    }else{
      hudEquipSkill3Img.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudEquipSkill3Img, blankFrameData, rate);
    }
    if(equipSkillDatas[3]){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[3].skillIcon));
      hudEquipSkill4Img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudEquipSkill4Img, iconData, rate);
    }else{
      hudEquipSkill4Img.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudEquipSkill4Img, blankFrameData, rate);
    }
  },
  setHUDStats : function(data){
    var color = 'white'
    switch (characterType) {
      case gameConfig.CHAR_TYPE_FIRE:
        var charName = fireCharName;
        color = 'red';
        break;
      case gameConfig.CHAR_TYPE_FROST:
        charName = frostCharName;
        color = 'blue';
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        charName = arcaneCharName;
        color = "purple";
        break;
      default:
    }

    gameSceneCharNameAndLevel.innerHTML = "<span class='yellow'>Lv " + data.level + "</span><span class='" + color + "'>" + charName + "</span>";

    var offenceRate = Math.floor((data.damageRate + (data.fireDamageRate + data.frostDamageRate + data.arcaneDamageRate) / 3 - 200) * 10) / 10;
    var defenceRate = Math.floor((data.resistAll + (data.resistFire + data.resistFrost + data.resistArcane) / 3)* 10) / 10;

    userStatOffence.getElementsByTagName('span')[0].innerHTML = offenceRate + " %";
    userStatOffence.onmouseover = offenceDefenceStatOnHandler.bind(userStatOffence, gameConfig.STAT_OFFENCE_INDEX, data);
    userStatOffence.onmouseout = bottomTooltipOffHandler.bind(userStatOffence);
    userStatDefence.getElementsByTagName('span')[0].innerHTML = defenceRate + " %";
    userStatDefence.onmouseover = offenceDefenceStatOnHandler.bind(userStatDefence, gameConfig.STAT_DEFENCE_INDEX, data);
    userStatDefence.onmouseout = bottomTooltipOffHandler.bind(userStatDefence);

    userStatPowerContainer.getElementsByTagName('span')[0].innerHTML = statPower = data.statPower;
    userStatPowerContainer.onmouseover = statTooltipOnHandler.bind(userStatPowerContainer, gameConfig.STAT_POWER_INDEX, statPower);
    userStatPowerContainer.onmouseout = bottomTooltipOffHandler.bind(userStatPowerContainer);
    userStatMagicContainer.getElementsByTagName('span')[0].innerHTML = statMagic = data.statMagic;
    userStatMagicContainer.onmouseover = statTooltipOnHandler.bind(userStatMagicContainer, gameConfig.STAT_MAGIC_INDEX, statMagic);
    userStatMagicContainer.onmouseout = bottomTooltipOffHandler.bind(userStatMagicContainer);
    userStatSpeedContainer.getElementsByTagName('span')[0].innerHTML = statSpeed = data.statSpeed;
    userStatSpeedContainer.onmouseover = statTooltipOnHandler.bind(userStatSpeedContainer, gameConfig.STAT_SPEED_INDEX, statSpeed);
    userStatSpeedContainer.onmouseout = bottomTooltipOffHandler.bind(userStatSpeedContainer);
  },
  setCooldownReduceRate : function(reduceRate){
    cooldownReduceRate = reduceRate;
  },
  setSkillChangeBtn : function(){
    hudBtnSkillChange.onclick = function(){
      clearSelectedPanel();
      popChange(popUpSkillChange);
      if(!isClearTutorial){
        playPopUpTutorial();
      }else{
        disablePopUpTutorial();
      }
    }
    popUpCloseBtn.onclick = function(){
      clearSelectedPanel();
      popChange(popUpSkillChange);
    }
    // standingSceneSkillSettingBtn.onclick = function(){
    //   clearSelectedPanel();
    //   popChange(popUpSkillChange);
    //   if(!isClearTutorial){
    //     playPopUpTutorial();
    //   }else{
    //     disablePopUpTutorial();
    //   }
    // }
    popUpBackground.onclick = function(){
      clearSelectedPanel();
      popChange(popUpSkillChange);
    }
  },
  setSkillIconResource : function(resource){
    resourceUI = resource.src;

    blankFrameData = objectAssign({}, util.findData(iconResourceTable, 'index', gameConfig.UI_RESOURCE_INDEX_BLANK));
  },
  setResource : function(resourceData){
    goldContainer.innerHTML = resourceData.gold;
    jewelContainer.innerHTML = resourceData.jewel;
  },
  addResource : function(gold, jewel){
    var goldAmount = parseInt(goldContainer.innerHTML);
    var jewelAmount = parseInt(jewelContainer.innerHTML);
    if(util.isNumeric(gold) && util.isNumeric(goldAmount)){
      goldContainer.innerHTML = goldAmount + gold;
    }
    if(util.isNumeric(jewel) && util.isNumeric(jewelAmount)){
      jewelContainer.innerHTML = jewelAmount + jewel;
    }
  },
  makeFlashMessage : function(msg){
    var message = document.createElement('p');
    message.innerHTML = msg;
    message.classList.add('flashMessage');
    setTimeout(function(){
      message.classList.add('flashMessageAni');
    }, 2000);
    flashMessageContainer.appendChild(message);
    // centerMessageContainer.insertBefore(messageDiv, centerMessageContainer.childNodes[0]);
    setTimeout(function(){
      flashMessageContainer.removeChild(message);
    }, 5000);
  },
  makeRisingMessage : function(addResource){
    var delayTime = 0;
    if(Date.now() > beforeRisingMessageTime + 300){
      delayTime = 0;
      beforeRisingMessageTime = Date.now();
    }else{
      delayTime = beforeRisingMessageTime + 300 - Date.now();
      beforeRisingMessageTime = Date.now() + delayTime;
    }

    setTimeout(function(){
      var div = document.createElement('div');
      div.classList.add('risingMessage');
      if(addResource.type === gameConfig.GET_RESOURCE_TYPE_EXP){
        var text = "<span class='yellow'>EXP + </span>" + addResource.amount;
        div.innerHTML = text;
      }else if(addResource.type === gameConfig.GET_RESOURCE_TYPE_GOLD){
        var img = document.createElement('img');
        img.src = "../images/GoldIcon.png";
        div.appendChild(img);
        var span = document.createElement('span');
        span.innerHTML = "<span class='yellow'> + </span>" + addResource.amount;
        div.appendChild(span);
      }else if(addResource.type === gameConfig.GET_RESOURCE_TYPE_JEWEL){
        var img = document.createElement('img');
        img.src = "../images/JewelIcon.png";
        div.appendChild(img);
        var span = document.createElement('span');
        span.innerHTML = "<span class='yellow'> + </span>" + addResource.amount;
        div.appendChild(span);
      }
      risingMessageContainer.appendChild(div);
      setTimeout(function(){
        div.classList.add('risingMessageAni');
      }, 50);
      setTimeout(function(){
        risingMessageContainer.removeChild(div);
      }, 4000);
    }, delayTime);
  },
  makeRisingMessageForSkill : function(skillData, isChangeToResource){
    var delayTime = 0;
    if(Date.now() > beforeRisingMessageTime + 300){
      delayTime = 0;
      beforeRisingMessageTime = Date.now();
    }else{
      delayTime = beforeRisingMessageTime + 300 - Date.now();
      beforeRisingMessageTime = Date.now() + delayTime;
    }
    setTimeout(function(){
      var div = document.createElement('div');
      div.classList.add('risingMessageSkill');

      var imgContainer = document.createElement('div');

      var rate = 40 / 72;
      var img = document.createElement('img');
      img.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
      img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(img, iconData, rate);

      imgContainer.appendChild(img);
      div.appendChild(imgContainer);

      if(isChangeToResource){
        imgContainer.classList.add('risingMessageSkillImgToChange');

        var arrowDiv = document.createElement('div');
        arrowDiv.classList.add('risingMessageArrow');
        div.appendChild(arrowDiv);

        var resourceContainer = document.createElement('div');
        resourceContainer.classList.add('risingMessageResource');
        var img = document.createElement('img');
        if(skillData.exchangeToGold){
          img.src = "../images/GoldIcon.png";
          var amount = skillData.exchangeToGold;
        }else if(skillData.exchangeToJewel){
          img.src = "../images/JewelIcon.png";
          amount = skillData.exchangeToJewel;
        }
        resourceContainer.appendChild(img);
        var span = document.createElement('span');
        span.innerHTML = "<span class='yellow'> : </span>" + amount;
        resourceContainer.appendChild(span);

        div.appendChild(resourceContainer);
      }else{
        imgContainer.classList.add('risingMessageSkillImg');
      }

      risingMessageContainer.appendChild(div);
      setTimeout(function(){
        div.classList.add('risingMessageAniForSkill');
      }, 50);
      setTimeout(function(){
        risingMessageContainer.removeChild(div);
      }, 4000);
    }, delayTime);
  },
  updateBuffIcon : function(passiveList, buffList){
    while(gameSceneBuffsContainer.firstChild){
      gameSceneBuffsContainer.removeChild(gameSceneBuffsContainer.firstChild);
    }
    gameSceneBuffsContainer.innerHTML = '';
    var rate = 45 / 72;
    if(inherentPassiveSkillData){
      var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', inherentPassiveSkillData.buffToSelf));
      var div = document.createElement('div');
      div.setAttribute('buffGroupIndex', inherentPassiveSkillData.buffToSelf);
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('buffImgContainer');
      var img = document.createElement('img');
      // img.src = buffGroupData.buffIcon;
      img.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', buffGroupData.buffIcon));
      img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(img, iconData, rate);

      imgContainer.appendChild(img);
      div.appendChild(imgContainer);
      gameSceneBuffsContainer.appendChild(div);
      div.addEventListener('mouseover', buffTooltipOnHandler.bind(div), false);
      div.addEventListener('mouseout', bottomTooltipOffHandler.bind(div), false);
    }
    if(passiveList){
      for(var i=0; i<passiveList.length; i++){
        var passiveData = objectAssign({}, util.findData(buffGroupTable, 'index', passiveList[i]));
        var div = document.createElement('div');
        var imgContainer = document.createElement('div');
        imgContainer.classList.add('buffImgContainer');
        div.setAttribute('buffGroupIndex', passiveData.index);
        var img = document.createElement('img');
        // img.src = passiveData.buffIcon;
        img.src = resourceUI;
        var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', passiveData.buffIcon));
        img.style.clip = util.makeCssClipStyle(iconData, rate);
        util.setImgCssStyle(img, iconData, rate);

        imgContainer.appendChild(img);
        div.appendChild(imgContainer);
        gameSceneBuffsContainer.appendChild(div);
        div.addEventListener('mouseover', buffTooltipOnHandler.bind(div), false);
        div.addEventListener('mouseout', bottomTooltipOffHandler.bind(div), false);
      }
    }
    if(buffList){
      for(var i=0; i<buffList.length; i++){
        var buffData = objectAssign({}, util.findData(buffGroupTable, 'index', buffList[i].index));
        var lifeTime = buffData.buffLifeTime;
        var pastTime = Date.now() - buffList[i].startTime;
        var buffListItem = buffList[i];

        var div = document.createElement('div');
        div.setAttribute('buffGroupIndex', buffData.index);
        var imgContainer = document.createElement('div');
        imgContainer.classList.add('buffImgContainer');
        var img = document.createElement('img');
        // img.src = buffData.buffIcon;
        img.src = resourceUI;
        var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', buffData.buffIcon));
        img.style.clip = util.makeCssClipStyle(iconData, rate);
        util.setImgCssStyle(img, iconData, rate);

        imgContainer.appendChild(img);
        div.appendChild(imgContainer);
        gameSceneBuffsContainer.appendChild(div);
        div.addEventListener('mouseover', buffTooltipOnHandler.bind(div), false);
        div.addEventListener('mouseout', bottomTooltipOffHandler.bind(div), false);

        var checkBuffLifeTimeHandler = function(){
          pastTime = Date.now() - buffListItem.startTime;
          if(lifeTime - pastTime <= 5000){
            div.classList.add('buffBeforeEndAni');
          }else{
            setTimeout(checkBuffLifeTimeHandler, 100);
          }
        }
        setTimeout(checkBuffLifeTimeHandler, 100);
      }
    }
  },
  initPopUpSkillChanger : function(){
    popUpSkillChange = document.getElementById('popUpSkillChange');
    popUpCloseBtn = document.getElementById('popUpCloseBtn');
    popUpSkillContainer = document.getElementById('popUpSkillContainer');
    popUpBackground = document.getElementById('popUpBackground');

    popUpSkillInfoAndBtn = document.getElementById('popUpSkillInfoAndBtn');
    popUpSkillInfoIcon = document.getElementById('popUpSkillInfoIcon');
    popUpSkillInfoIcon.onclick = clearSelectedPanel;
    popUpSkillInfoDesc = document.getElementById('popUpSkillInfoDesc');
    skillUpgradeEffect = document.getElementById('skillUpgradeEffect');
    popUpSkillUpgradeCostGold = document.getElementById('popUpSkillUpgradeCostGold');
    popUpSkillUpgradeCostJewel = document.getElementById('popUpSkillUpgradeCostJewel');
    popUpSkillUpgradeBtn = document.getElementById('popUpSkillUpgradeBtn');
    popUpSkillTutorialClickText1 = document.getElementById('popUpSkillTutorialClickText1');
    popUpSkillTutorialClickText2 = document.getElementById('popUpSkillTutorialClickText2');
    popUpSkillTutorialArrow = document.getElementById('popUpSkillTutorialArrow');
    popUpSkillTextSkillInfo = document.getElementById('popUpSkillTextSkillInfo');
    popUpCancelSkillSelectBtn = document.getElementById('popUpCancelSkillSelectBtn');
    popUpCancelSkillSelectBtn.onclick = clearSelectedPanel;

    popUpEquipBaseSkill = document.getElementById('popUpEquipBaseSkill');
    popUpEquipSkillsContainer = document.getElementById('popUpEquipSkillsContainer');
    popUpEquipSkill1 = document.getElementById('popUpEquipSkill1');
    popUpEquipSkill2 = document.getElementById('popUpEquipSkill2');
    popUpEquipSkill3 = document.getElementById('popUpEquipSkill3');
    popUpEquipSkill4 = document.getElementById('popUpEquipSkill4');
    popUpEquipPassiveSkill = document.getElementById('popUpEquipPassiveSkill');
  },
  checkPopUpSkillChange : function(){
    var needRefresh = false;

    var equipSkillIndex1 = parseInt(popUpEquipSkill1.getAttribute('skillIndex'));
    var equipSkillIndex2 = parseInt(popUpEquipSkill2.getAttribute('skillIndex'));
    var equipSkillIndex3 = parseInt(popUpEquipSkill3.getAttribute('skillIndex'));
    var equipSkillIndex4 = parseInt(popUpEquipSkill4.getAttribute('skillIndex'));
    if(equipSkills[0] && equipSkillIndex1 !== equipSkills[0]){
      needRefresh = true;
    }
    if(equipSkills[1] && equipSkillIndex2 !== equipSkills[1]){
      needRefresh = true;
    }
    if(equipSkills[2] && equipSkillIndex3 !== equipSkills[2]){
      needRefresh = true;
    }
    if(equipSkills[3] && equipSkillIndex4 !== equipSkills[3]){
      needRefresh = true;
    }

    var containerItems = popUpSkillContainer.children;
    for(var i=0; i<containerItems.length; i++){
      var isExist = false;
      var skillIndex = parseInt(containerItems[i].getAttribute('skillIndex'));
      for(var j=0; j<possessSkills.length; j++){
        if(skillIndex === possessSkills[j]){
          isExist = true;
          break;
        }
      }
      if(!isExist){
        needRefresh = true;
      }
    }
    return needRefresh;
  },
  upgradeBaseSkill : function(afterSkillIndex, afterSkillData){
    var beforeSkillIndex = baseSkill;
    baseSkill = afterSkillIndex;
    baseSkillData = afterSkillData;
    if(selectedSkillIndex === beforeSkillIndex){
      this.updateSelectedPanel(afterSkillIndex);
    }
    this.updateDOMElementsSkillIndex(beforeSkillIndex, afterSkillIndex);
    isServerResponse = true;
    popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.remove('disable');
    popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.add('disable');
    if(this.serverResponseTimeout){
      clearTimeout(this.serverResponseTimeout);
      this.serverResponseTimeout = false;
    }
  },
  upgradeInherentSkill : function(afterSkillIndex, afterSkillData){
    var beforeSkillIndex = inherentPassiveSkill;
    inherentPassiveSkill = afterSkillIndex;
    inherentPassiveSkillData = afterSkillData;
    if(selectedSkillIndex === beforeSkillIndex){
      this.updateSelectedPanel(afterSkillIndex);
    }
    this.updateDOMElementsSkillIndex(beforeSkillIndex, afterSkillIndex);
    isServerResponse = true;
    popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.remove('disable');
    popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.add('disable');
    if(this.serverResponseTimeout){
      clearTimeout(this.serverResponseTimeout);
      this.serverResponseTimeout = false;
    }
  },
  upgradePossessionSkill : function(beforeSkillIndex, afterSkillIndex){
    for(var i=0; i<possessSkills.length; i++){
      if(possessSkills[i] === beforeSkillIndex){
        var index = possessSkills.indexOf(beforeSkillIndex);
        possessSkills.splice(index, 1, afterSkillIndex);
        break;
      }
    }
    for(var i=0; i<equipSkills.length; i++){
      if(equipSkills[i] === beforeSkillIndex){
        var index = equipSkills.indexOf(beforeSkillIndex);
        equipSkills.splice(index, 1, afterSkillIndex);
        var skillData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));
        equipSkillDatas.splice(index, 1, skillData);
        break;
      }
    }
    if(selectedSkillIndex === beforeSkillIndex){
      this.updateSelectedPanel(afterSkillIndex);
    }
    this.updateDOMElementsSkillIndex(beforeSkillIndex, afterSkillIndex);
    isServerResponse = true;
    popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.remove('disable');
    popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.add('disable');
    if(this.serverResponseTimeout){
      clearTimeout(this.serverResponseTimeout);
      this.serverResponseTimeout = false;
    }
  },
  playSkillUpgradeEffect : function(){
    skillUpgradeEffect.classList.remove('skillUpgradeEffectAni');
    setTimeout(function(){
      skillUpgradeEffect.classList.add('skillUpgradeEffectAni');
    }, 50);
  },
  updateDOMElementsSkillIndex : function(beforeSkillIndex, afterSkillIndex){
    var divs = document.querySelectorAll('[skillIndex="' + beforeSkillIndex + '"]');
    var afterData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));

    // var rate = 85 / 72;
    for(var i=0; i<divs.length; i++){
      divs[i].setAttribute('skillIndex', afterSkillIndex);
      // divs[i].getElementsByTagName('img')[0].src = afterData.skillIcon;
      // divs[i].getElementsByTagName('img')[0].src = resourceUI;

      // var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', afterData.skillIcon));
      // divs[i].getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
      // util.setImgCssStyle(divs[i].getElementsByTagName('img')[0], iconData, rate);
    }
    this.setHUDSkills()
  },
  setPopUpSkillChange : function(dontUpdateEquip){
    while (popUpSkillContainer.firstChild) {
      popUpSkillContainer.removeChild(popUpSkillContainer.firstChild);
    }
    while(popUpEquipBaseSkill.firstChild){
      popUpEquipBaseSkill.removeChild(popUpEquipBaseSkill.firstChild);
    }
    while(popUpEquipSkill1.firstChild){
      popUpEquipSkill1.removeChild(popUpEquipSkill1.firstChild);
    }
    while(popUpEquipSkill2.firstChild){
      popUpEquipSkill2.removeChild(popUpEquipSkill2.firstChild);
    }
    while(popUpEquipSkill3.firstChild){
      popUpEquipSkill3.removeChild(popUpEquipSkill3.firstChild);
    }
    while(popUpEquipSkill4.firstChild){
      popUpEquipSkill4.removeChild(popUpEquipSkill4.firstChild);
    }
    while(popUpEquipPassiveSkill.firstChild){
      popUpEquipPassiveSkill.removeChild(popUpEquipPassiveSkill.firstChild);
    }
    popUpEquipSkill1.removeAttribute('skillIndex');
    popUpEquipSkill2.removeAttribute('skillIndex');
    popUpEquipSkill3.removeAttribute('skillIndex');
    popUpEquipSkill4.removeAttribute('skillIndex');

    var imgContainer = document.createElement('div');
    imgContainer.classList.add('popUpskillImgContainer');
    var baseImg = document.createElement('img');
    // baseImg.src = baseSkillData.skillIcon;
    baseImg.src = resourceUI;
    var rate = 75 / 72;
    var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', baseSkillData.skillIcon));
    baseImg.style.clip = util.makeCssClipStyle(iconData, rate);
    util.setImgCssStyle(baseImg, iconData, rate);

    popUpEquipBaseSkill.setAttribute('skillIndex', baseSkill);
    imgContainer.appendChild(baseImg);
    popUpEquipBaseSkill.appendChild(imgContainer);
    popUpEquipBaseSkill.onclick = changeEquipSkillHandler.bind(this, popUpEquipBaseSkill, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);

    var imgContainer = document.createElement('div');
    imgContainer.classList.add('popUpskillImgContainer');
    var inherentPassiveSkillImg = document.createElement('img');
    // inherentPassiveSkillImg.src = inherentPassiveSkillData.skillIcon;
    inherentPassiveSkillImg.src = resourceUI;
    var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', inherentPassiveSkillData.skillIcon));
    inherentPassiveSkillImg.style.clip = util.makeCssClipStyle(iconData, rate);
    util.setImgCssStyle(inherentPassiveSkillImg, iconData, rate);

    popUpEquipPassiveSkill.setAttribute('skillIndex', inherentPassiveSkill);
    imgContainer.appendChild(inherentPassiveSkillImg);
    popUpEquipPassiveSkill.appendChild(imgContainer);
    popUpEquipPassiveSkill.onclick = changeEquipSkillHandler.bind(this, popUpEquipPassiveSkill, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);

    var rate = 85 / 72;
    if(equipSkillDatas[0]){
      var equipSkills1 = document.createElement('img');
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      // equipSkills1.src = equipSkillDatas[0].skillIcon;
      equipSkills1.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[0].skillIcon));
      equipSkills1.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(equipSkills1, iconData, rate);

      popUpEquipSkill1.setAttribute('skillIndex', equipSkillDatas[0].index);
      imgContainer.appendChild(equipSkills1);
      popUpEquipSkill1.appendChild(imgContainer);
    }
    if(equipSkillDatas[1]){
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      var equipSkills2 = document.createElement('img');
      // equipSkills2.src = equipSkillDatas[1].skillIcon;
      equipSkills2.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[1].skillIcon));
      equipSkills2.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(equipSkills2, iconData, rate);
      popUpEquipSkill2.setAttribute('skillIndex', equipSkillDatas[1].index);
      imgContainer.appendChild(equipSkills2);
      popUpEquipSkill2.appendChild(imgContainer);
    }
    if(equipSkillDatas[2]){
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      var equipSkills3 = document.createElement('img');
      // equipSkills3.src = equipSkillDatas[2].skillIcon;
      equipSkills3.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[2].skillIcon));
      equipSkills3.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(equipSkills3, iconData, rate);
      popUpEquipSkill3.setAttribute('skillIndex', equipSkillDatas[2].index);
      imgContainer.appendChild(equipSkills3);
      popUpEquipSkill3.appendChild(imgContainer);
    }
    if(equipSkillDatas[3]){
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      var equipSkills4 = document.createElement('img');
      // equipSkills4.src = equipSkillDatas[3].skillIcon;
      equipSkills4.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[3].skillIcon));
      equipSkills4.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(equipSkills4, iconData, rate);
      popUpEquipSkill4.setAttribute('skillIndex', equipSkillDatas[3].index);
      imgContainer.appendChild(equipSkills4);
      popUpEquipSkill4.appendChild(imgContainer);
    }
    popUpEquipSkill1.onclick = changeEquipSkillHandler.bind(this, popUpEquipSkill1, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);
    popUpEquipSkill2.onclick = changeEquipSkillHandler.bind(this, popUpEquipSkill2, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);
    popUpEquipSkill3.onclick = changeEquipSkillHandler.bind(this, popUpEquipSkill3, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);
    popUpEquipSkill4.onclick = changeEquipSkillHandler.bind(this, popUpEquipSkill4, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);

    var equipSkillIndexes = [];
    // equipSkillIndexes.push(baseSkill);
    for(var i=0; i<equipSkills.length; i++){
      equipSkillIndexes.push(equipSkills[i]);
    }

    for(var i=0; i<possessSkills.length; i++){
      var isEquipSkill = false;
      // if(equipSkillIndexes.includes(possessSkills[i])){
      if(equipSkillIndexes.indexOf(possessSkills[i]) !== -1){
        isEquipSkill = true;
      }
      // for(var j=0; j<equipSkillIndexes.length; j++){
      //   if(equipSkillIndexes[j] === possessSkills[i]){
      //     isEquipSkill = true;
      //     break;
      //   }
      // }
      if(!isEquipSkill){
        var isNewSkill = false;
        // if(newSkills.includes(possessSkills[i])){
        if(newSkills.indexOf(possessSkills[i]) !== -1){
          isNewSkill = true;
        }
        var skillData = objectAssign({}, util.findData(skillTable, 'index', possessSkills[i]));
        var skillDiv = document.createElement('div');
        var imgContainer = document.createElement('div');
        imgContainer.classList.add('popUpskillImgContainer');
        var skillImg = document.createElement('img');
        skillDiv.setAttribute('skillIndex', possessSkills[i]);

        var newImg = document.createElement('img');
        newImg.src = '../images/newIcon.png';
        if(!isNewSkill){
          newImg.classList.add('disable');
        }
        skillDiv.appendChild(newImg);

        skillDiv.classList.add('popUpSkillContainerItem');
        // skillImg.src = skillData.skillIcon;
        skillImg.src = resourceUI;
        var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
        skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
        util.setImgCssStyle(skillImg, iconData, rate);

        imgContainer.appendChild(skillImg);
        skillDiv.appendChild(imgContainer);
        popUpSkillContainer.appendChild(skillDiv);

        skillDiv.onclick = changeEquipSkillHandler.bind(this, skillDiv, gameConfig.SKILL_CHANGE_PANEL_CONTAINER, dontUpdateEquip);
      }
    }
  },
  updateSelectedPanel : function(skillIndex){
    while(popUpSkillInfoIcon.firstChild){
      popUpSkillInfoIcon.removeChild(popUpSkillInfoIcon.firstChild);
    }
    while(popUpSkillInfoDesc.firstChild){
      popUpSkillInfoDesc.removeChild(popUpSkillInfoDesc.firstChild);
    }

    popUpSkillUpgradeCostGold.innerHTML = "";
    popUpSkillUpgradeCostJewel.innerHTML = "";

    popUpCancelSkillSelectBtn.classList.add('disable');

    if(skillIndex){
      selectedSkillIndex = skillIndex;

      var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
      var skillImg = document.createElement('img');

      var output = makeSkillTooltipString(skillData);
      popUpSkillInfoDesc.innerHTML = output;

      // skillImg.src = skillData.skillIcon;
      skillImg.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
      var rate = 85/72;
      skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(skillImg, iconData, rate);

      var goldAmount = parseInt(goldContainer.innerHTML);
      var jewelAmount = parseInt(jewelContainer.innerHTML);

      var color = "white";
      if(goldAmount >= skillData.upgradeGoldAmount){
        color = "green"
      }else{
        color = "red"
      }
      popUpSkillUpgradeCostGold.innerHTML = "<span class='" + color + "'>" + skillData.upgradeGoldAmount + "<br>/ " + goldAmount;

      if(jewelAmount >= skillData.upgradeJewelAmount){
        color = "green"
      }else{
        color = "red"
      }
      popUpSkillUpgradeCostJewel.innerHTML = "<span class='" + color + "'>" + skillData.upgradeJewelAmount + "<br>/ " + jewelAmount;

      popUpSkillInfoIcon.appendChild(skillImg);
      // popUpSkillUpgradeBtn.addEventListener('click', skillUpgradeBtnHandler, false);
      popUpSkillUpgradeBtn.onclick = skillUpgradeBtnHandler.bind(this, skillData);

      popUpCancelSkillSelectBtn.classList.remove('disable');
      if(skillData.nextSkillIndex !== -1){
        popUpSkillUpgradeBtn.getElementsByTagName('span')[0].innerHTML = "Upgrade";
        skillUpgradeBlockMask.classList.add('disable');
      }else{
        popUpSkillUpgradeBtn.getElementsByTagName('span')[0].innerHTML = "Max Level";
        skillUpgradeBlockMask.classList.remove('disable');
        popUpSkillUpgradeCostGold.innerHTML = "";
        popUpSkillUpgradeCostJewel.innerHTML = "";
      }
    }else{
      popUpSkillUpgradeBtn.onclick = new Function();
      popUpSkillUpgradeBtn.getElementsByTagName('span')[0].innerHTML = " ";
      skillUpgradeBlockMask.classList.remove('disable');
    }
  },
  closePopUpSkillChange : function(){
    if(popUpSkillChange.classList.contains('enable')){
      clearSelectedPanel();
      popChange(popUpSkillChange);
    }
  },
  setBoard : function(userDatas, userID){
    var rank = [];
    var userRank = 0;
    var userName = "";
    var userKillScore = 0;
    userDatas.sort(function(a, b){
      return b.totalScore - a.totalScore;
    });
    for(var i=0; i<userDatas.length; i++){
      if(userID === userDatas[i].name){
        userRank = i + 1;
        userName = userDatas[i].name;
        userLevel = userDatas[i].level;
        userKillScore = userDatas[i].killScore;
        userScore = userDatas[i].totalScore;
      }
      rank.push({rank : i + 1, name : userDatas[i].name, level:userDatas[i].level, kill : userDatas[i].killScore, score : userDatas[i].totalScore});
    }
    var rankOutput = "<h3>Rank</h3><hr>";
    var nameOutput = "<h3>Name</h3><hr>";
    var levelOutput = "<h3>Level</h3><hr>";
    var killScoreOutput = "<h3>Kills</h3><hr>";
    var totalScoreOutput = "<h3>Score</h3><hr>";
    var output = "";
    var length = rank.length > 10 ? 10 : rank.length;

    for(var i=0; i<length; i++){
      if(userRank <= 10 && userRank === i + 1){
        rankOutput += "<p class='user'>" + rank[i].rank + "</p>";
        nameOutput += "<p class='user'>" + rank[i].name + "</p>";
        levelOutput += "<p class='user'>" + rank[i].level + "</p>";
        killScoreOutput += "<p class='user'>" + rank[i].kill + "</p>";
        totalScoreOutput += "<p class='user'>" + rank[i].score + "</p>";
      }else{
        rankOutput += "<p>" + rank[i].rank + "</p>";
        nameOutput += "<p>" + rank[i].name + "</p>";
        levelOutput += "<p>" + rank[i].level + "</p>";
        killScoreOutput += "<p>" + rank[i].kill + "</p>";
        totalScoreOutput += "<p>" + rank[i].score + "</p>";
      }
    }
    if(userRank > 10){
      rankOutput += "<p class='user' style='font-size: 13px'>" + userRank + "</p>";
      nameOutput += "<p class='user' style='font-size: 13px'>" + userName + "</p>";
      levelOutput += "<p class='user' style='font-size: 13px'>" + userLevel + "</p>";
      killScoreOutput += "<p class='user' style='font-size: 13px'>" + userKillScore + "</p>";
      totalScoreOutput += "<p class='user' style='font-size: 13px'>" + userKillScore + "</p>";
    }
    // if(userRank > 10){
    //   output += rank[i].rank + ' : ' + rank[i].name + ' : ' + rank[i].kill;
    // }
    // gameSceneHudTopRight.innerHTML = "";
    // gameSceneHudTopRight.innerHTML = output;
    gameBoardRank.innerHTML = rankOutput;
    gameBoardName.innerHTML = nameOutput;
    gameBoardLevel.innerHTML = levelOutput;
    gameBoardKillScore.innerHTML = killScoreOutput;
    gameBoardTotalScore.innerHTML = totalScoreOutput;
  },
  updateBoard : function(userDatas, userID){
    this.setBoard(userDatas, userID);
  },
  updateKillBoard : function(attackUserInfo, deadUserInfo){
    gameSceneHudTopLeft.classList.remove('disappearSmoothAni');
    gameSceneHudTopLeft.classList.remove('disable');

    if(killBoardDisableTimeout){
      clearTimeout(killBoardDisableTimeout);
    }
    var spanEle = document.createElement('span');
    spanEle.classList.add('killFeedBack');

    var output = "";
    var attackUserColor = "white";
    var deadUserColor = "white";
    switch (attackUserInfo.userType) {
      case gameConfig.CHAR_TYPE_FIRE:
        attackUserColor = 'red';
        break;
      case gameConfig.CHAR_TYPE_FROST:
        attackUserColor = 'blue';
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        attackUserColor = 'purple';
        break;
    }
    switch (deadUserInfo.userType) {
      case gameConfig.CHAR_TYPE_FIRE:
        deadUserColor = 'red';
        break;
      case gameConfig.CHAR_TYPE_FROST:
        deadUserColor = 'blue';
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        deadUserColor = 'purple';
        break;
    }
    if(!attackUserInfo.userName){
      var attackUserName = 'noname';
    }else{
      attackUserName = attackUserInfo.userName;
    }
    if(!deadUserInfo.userName){
      var deadUserName = 'noname';
    }else{
      deadUserName = deadUserInfo.userName;
    }
    if(attackUserInfo.userID === deadUserInfo.userID){
      output += '&nbsp; <span class=' + attackUserColor + '>' + attackUserName + '</span>';
      output += '&nbsp; kill oneself'
    }else if(attackUserInfo.feedBackLevel){
      switch (attackUserInfo.feedBackLevel) {
        case gameConfig.KILL_FEEDBACK_LEVEL_0:
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_1:
          output += '<span class="feedbackLevel1 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_1_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_1_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel1')[0];
            prefix.classList.remove('feedbackLevel1');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_2:
          output += '<span class="feedbackLevel2 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_2_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_2_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel2')[0];
            prefix.classList.remove('feedbackLevel2');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_3:
          output += '<span class="feedbackLevel3 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_3_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_3_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel3')[0];
            prefix.classList.remove('feedbackLevel3');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_4:
          output += '<span class="feedbackLevel4 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_4_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_4_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel4')[0];
            prefix.classList.remove('feedbackLevel4');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_5:
          output += '<span class="feedbackLevel5 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_5_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_5_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel5')[0];
            prefix.classList.remove('feedbackLevel5');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_6:
          output += '<span class="feedbackLevel6 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_6_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_6_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel6')[0];
            prefix.classList.remove('feedbackLevel6');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_7:
          output += '<span class="feedbackLevel7 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_7_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_7_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel7')[0];
            prefix.classList.remove('feedbackLevel7');
          }, 50);
          break;
      }
      output += '&nbsp; <span class=' + attackUserColor + '>' + attackUserName + '</span>';
      output += '&nbsp;&nbsp; kill ';
      output += '&nbsp; <span class=' + deadUserColor + '>' + deadUserName + '</span>';
    }else{
      output += '&nbsp; <span class=' + attackUserColor + '>' + attackUserName + '</span>';
      output += '&nbsp;&nbsp;  kill ';
      output += '&nbsp; <span class=' + deadUserColor + '>' + deadUserName + '</span>';
    }
    output += '&nbsp;!!!<br>';

    spanEle.innerHTML = output;
    var spans = gameSceneHudTopLeft.getElementsByClassName('killFeedBack');
    while(spans.length >= 5){
      gameSceneHudTopLeft.removeChild(spans[0]);
    }
    gameSceneHudTopLeft.appendChild(spanEle);
    killBoardDisableTimeout = setTimeout(function(){
      gameSceneHudTopLeft.classList.add('disappearSmoothAni');
      setTimeout(function(){
        if(gameSceneHudTopLeft.classList.contains('disappearSmoothAni')){
          gameSceneHudTopLeft.classList.remove('disappearSmoothAni');
          gameSceneHudTopLeft.classList.add('disable');
        }
      }, 1000);
    }, 5000);
  },
  setMiniMapChests : function(chestDatas, chestLocationDatas){
    miniMapChest1.setAttribute('locationID', chestLocationDatas[0].id);
    miniMapChest1.style.left = Math.floor(chestLocationDatas[0].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest1.style.top = Math.floor(chestLocationDatas[0].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest2.setAttribute('locationID', chestLocationDatas[1].id);
    miniMapChest2.style.left = Math.floor(chestLocationDatas[1].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest2.style.top = Math.floor(chestLocationDatas[1].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest3.setAttribute('locationID', chestLocationDatas[2].id);
    miniMapChest3.style.left = Math.floor(chestLocationDatas[2].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest3.style.top = Math.floor(chestLocationDatas[2].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest4.setAttribute('locationID', chestLocationDatas[3].id);
    miniMapChest4.style.left = Math.floor(chestLocationDatas[3].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest4.style.top = Math.floor(chestLocationDatas[3].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest5.setAttribute('locationID', chestLocationDatas[4].id);
    miniMapChest5.style.left = Math.floor(chestLocationDatas[4].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest5.style.top = Math.floor(chestLocationDatas[4].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest6.setAttribute('locationID', chestLocationDatas[5].id);
    miniMapChest6.style.left = Math.floor(chestLocationDatas[5].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest6.style.top = Math.floor(chestLocationDatas[5].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest7.setAttribute('locationID', chestLocationDatas[6].id);
    miniMapChest7.style.left = Math.floor(chestLocationDatas[6].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest7.style.top = Math.floor(chestLocationDatas[6].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest8.setAttribute('locationID', chestLocationDatas[7].id);
    miniMapChest8.style.left = Math.floor(chestLocationDatas[7].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest8.style.top = Math.floor(chestLocationDatas[7].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest9.setAttribute('locationID', chestLocationDatas[8].id);
    miniMapChest9.style.left = Math.floor(chestLocationDatas[8].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest9.style.top = Math.floor(chestLocationDatas[8].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';

    // var parentDiv = miniMapChest1.parentNode;
    var childDivs = miniMapChest1.parentNode.getElementsByTagName('div');
    for(var i=0; i<childDivs.length - 1; i++){
      var imgTags = childDivs[i].getElementsByTagName('img');
      imgTags[0].src = gameConfig.MINIMAP_CHEST_GROUND_SRC;
      // childDivs[i].classList.add('chestOff');
    }
    for(var i=0; i<chestDatas.length; i++){
      for(var j=0; j<childDivs.length - 1; j++){
        var locationID = childDivs[j].getAttribute('locationID');
        if(chestDatas[i].locationID === locationID){
          var imgTags = childDivs[j].getElementsByTagName('img');
          if(chestDatas[i].grade === 1 || chestDatas[i].grade === 2){
            imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_1;
          }else if(chestDatas[i].grade === 3 || chestDatas[i].grade === 4){
            imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_2;
          }else if(chestDatas[i].grade === 5){
            imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_3;
          }
          // childDivs[j].classList.remove('chestOff');
          // childDivs[j].classList.add('chestOn');
          break;
        }
      }
    }
  },
  createChest : function(locationID, grade){
    var childDivs = miniMapChest1.parentNode.getElementsByTagName('div');
    for(var i=0; i<childDivs.length; i++){
      if(locationID === childDivs[i].getAttribute('locationID')){
        var imgTags = childDivs[i].getElementsByTagName('img');
        if(grade === 1 || grade ===2){
          imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_1;
          imgTags[0].classList.add('chestAni1');
          imgTags[1].classList.add('chestAni1');
        }else if(grade === 3 || grade === 4){
          imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_2;
          imgTags[0].classList.add('chestAni2');
          imgTags[1].classList.add('chestAni2');
        }else if(grade === 5){
          imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_3;
          imgTags[0].classList.add('chestAni3');
          imgTags[1].classList.add('chestAni3');
        }
        imgTags[0].classList.add('chestAni');
        imgTags[1].classList.add('chestAni');
      }
    }
  },
  deleteChest : function(locationID){
    var childDivs = miniMapChest1.parentNode.getElementsByTagName('div');
    for(var i=0; i<childDivs.length; i++){
      if(locationID === childDivs[i].getAttribute('locationID')){
        var imgTags = childDivs[i].getElementsByTagName('img');
        imgTags[0].src = gameConfig.MINIMAP_CHEST_GROUND_SRC;
        imgTags[0].classList.remove('chestAni');
        imgTags[1].classList.remove('chestAni');
        imgTags[0].classList.remove('chestAni1');
        imgTags[1].classList.remove('chestAni1');
        imgTags[0].classList.remove('chestAni2');
        imgTags[1].classList.remove('chestAni2');
        imgTags[0].classList.remove('chestAni3');
        imgTags[1].classList.remove('chestAni3');
      }
    }
  },
  setUserPosition : function(position){
    miniMapUser.style.left = Math.floor(position.x * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapUser.style.top = Math.floor(position.y * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
  },
  updateUserPosition : function(position){
    miniMapUser.style.left = Math.floor(position.x * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapUser.style.top = Math.floor(position.y * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
  },
  showChatInput : function(){
    chatInputContainer.classList.remove('disable');
    chatInput.select();
  },
  getChatMessage : function(){
    return chatInput.value;
  },
  disableChatInput : function(){
    chatInputContainer.classList.add('disable');
  },
  clearChatInput : function(){
    chatInput.value = "";
  },
  playDeadScene : function(userID, killUser, toLevel, loseResource, isLostSkill){
    // gameSceneDeadScene.style.display = 'block';
    gameSceneDeadScene.style.width = "100%";
    gameSceneDeadScene.style.height = "100%";

    deadSceneBackground.classList.remove('deadSceneBackgroundDefault')
    deadSceneBackground.classList.add('deadSceneBackgroundAni');

    var text = "";
    if(killUser){
      if(userID === killUser){
        text = "You kill yourself";
      }else{
        text = "You are slain by <span class='yellow'>" + killUser + "</span>";
      }
    }else{
      text = "You are dead";
    }
    deadSceneText.innerHTML = text;
    var levelText = "";
    switch (characterType) {
      case gameConfig.CHAR_TYPE_FIRE:
        levelText += "<span class='red'>" + fireCharName + "</span> level down to <span class='yellow'>" + toLevel + "</span>";
        break;
      case gameConfig.CHAR_TYPE_FROST:
        levelText += "<span class='blue'>" + frostCharName + "</span> level down to <span class='yellow'>" + toLevel + "</span>";
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        levelText += "<span class='purple'>" + arcaneCharName + "</span> level down to <span class='yellow'>" + toLevel + "</span>";
        break;
      default:
    }
    if(isLostSkill){
      levelText += "<br><span class='red'>Some knowledges have lost...<span class='smallFont'>[Some skills level down]</span></span>";
    }
    deadSceneToLevel.innerHTML = levelText;
    if(loseResource.gold){
      var loseResourceGoldText = "<span class='red'> -" + loseResource.gold + "</span>";
    }else{
      loseResourceGoldText = loseResource.gold;
    }
    if(loseResource.jewel){
      var loseResourceJewelText = "<span class='red'> -" + loseResource.jewel + "</span>";
    }else{
      loseResourceJewelText = loseResource.jewel;
    }
    deadSceneLoseGold.innerHTML = loseResourceGoldText;
    deadSceneLoseJewel.innerHTML = loseResourceJewelText;

    setTimeout(function(){
      deadSceneTextContainer.classList.remove('deadSceneTextDefault');
      deadSceneTextContainer.classList.add('deadSceneTextAni');
    }, gameConfig.DEAD_SCENE_TEXT_ANI_PLAY_DELAY_TIME);

    var goldAmount = util.isNumeric(parseInt(goldContainer.innerHTML) - loseResource.gold) ? parseInt(goldContainer.innerHTML) - loseResource.gold : 0;
    var jewelAmount = util.isNumeric(parseInt(jewelContainer.innerHTML) - loseResource.jewel) ? parseInt(jewelContainer.innerHTML) - loseResource.jewel : 0;

    this.setResource({gold: goldAmount, jewel: jewelAmount});
  },
  disableDeadScene : function(){
    deadSceneText.innerHTML = '';
    deadSceneBackground.classList.remove('deadSceneBackgroundAni');
    deadSceneBackground.classList.add('deadSceneBackgroundDefault');
    deadSceneTextContainer.classList.remove('deadSceneTextAni');
    deadSceneTextContainer.classList.add('deadSceneTextDefault');
    gameSceneDeadScene.style.width = "0%";
    gameSceneDeadScene.style.height = "0%";

    gameScene.classList.add('disappearSmoothAni');
    gameScene.classList.remove('enable');
    setTimeout(function(){
      gameScene.classList.add('disable');
      gameScene.classList.remove('disappearSmoothAni');
    }, 1000);
  },
  // getUserGold : function(){
  //   return parseInt(goldContainer.innerHTML);
  // },
  // getUserJewel : function(){
  //   return parseInt(jewelContainer.innerHTML);
  // }
};
function popChange(popWindow){
  if(popWindow.classList.contains('disable')){
    popWindow.classList.add('enable');
    popWindow.classList.remove('disable');
    popUpBackground.classList.add('enable');
    popUpBackground.classList.remove('disable');
  }else if(popWindow.classList.contains('enable')){
    popWindow.classList.add('disable');
    popWindow.classList.remove('enable');
    popUpBackground.classList.add('disable')
    popUpBackground.classList.remove('enable');
  }
};
function changeEquipSkillHandler(selectDiv, selectPanel, dontUpdateEquip){
  //clear selected and equipable class
  // if(selectedDiv){
  //   selectedDiv.classList.remove('selected');
  // }
  // popUpEquipSkill1.classList.remove('equipable');
  // popUpEquipSkill2.classList.remove('equipable');
  // popUpEquipSkill3.classList.remove('equipable');
  // popUpEquipSkill4.classList.remove('equipable');
  //
  // for(var i=0; i<popUpSkillContainer.children.length; i++){
  //   popUpSkillContainer.children[i].classList.remove('equipable');
  // }
  this.onPopUpSkillChangeClick();
  clearPopSkillChangeClass();
  var selectEquipIndex = null;
  var rate = 85 / 72;
  var equipSlot = null;

  if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP){
    //set selectedEquipIndex
    if(selectDiv === popUpEquipBaseSkill){
      selectEquipIndex = -1;
    }else if(selectDiv === popUpEquipSkill1){
      selectEquipIndex = 0;
    }else if(selectDiv === popUpEquipSkill2){
      selectEquipIndex = 1;
    }else if(selectDiv === popUpEquipSkill3){
      selectEquipIndex = 2;
    }else if(selectDiv === popUpEquipSkill4){
      selectEquipIndex = 3;
    }else if(selectDiv === popUpEquipPassiveSkill){
      selectEquipIndex = -1;
    }
  }
  //update new skills
  var skillIndex = parseInt(selectDiv.getAttribute('skillIndex'));
  if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_CONTAINER){
    var index = newSkills.indexOf(skillIndex);
    if(index !== -1){
      newSkills.splice(index, 1);
    }
    selectDiv.getElementsByTagName('img')[0].classList.add('disable');

    var imgTags = hudBtnSkillChange.parentNode.getElementsByTagName('img');
    imgTags[0].classList.add('disable');
    var standingSceneImgTags = standingSceneSkillSettingBtn.getElementsByTagName('img');
    standingSceneImgTags[0].classList.add('disable');
    if(newSkills.length){
      imgTags[0].classList.remove('disable');
      standingSceneImgTags[0].classList.remove('disable');
    }
  }
  if(selectedPanel){
    if(selectedPanel !== selectPanel){
      //exchange
      if(selectedPanel === gameConfig.SKILL_CHANGE_PANEL_CONTAINER){
        //find skill in container
        //selected === equipSkill selectDiv === container skill
        if(selectEquipIndex === -1){
          this.makeFlashMessage('Can not change character spell!!!');
          // alert('cant change base skill');
        }else{
          var nodeIndex = 0;
          for(var i=0; i<popUpSkillContainer.childNodes.length; i++){
            if(popUpSkillContainer.childNodes[i] === selectedDiv){
              nodeIndex = i;
              break;
            }
          }
          popUpSkillContainer.removeChild(selectedDiv);
          if(skillIndex){
            var beforeSkillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
            var skillDiv = document.createElement('div');
            var imgContainer = document.createElement('div');
            imgContainer.classList.add('popUpskillImgContainer');
            var skillImg = document.createElement('img');
            skillDiv.setAttribute('skillIndex', skillIndex);

            var newImg = document.createElement('img');
            newImg.classList.add('disable');
            skillDiv.appendChild(newImg);

            skillDiv.classList.add('popUpSkillContainerItem');
            // skillImg.src = beforeSkillData.skillIcon;
            skillImg.src = resourceUI;
            var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', beforeSkillData.skillIcon));
            skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
            util.setImgCssStyle(skillImg, iconData, rate);

            imgContainer.appendChild(skillImg);
            skillDiv.appendChild(imgContainer);

            popUpSkillContainer.insertBefore(skillDiv, popUpSkillContainer.childNodes[nodeIndex]);
            // popUpSkillContainer.appendChild(skillDiv);

            skillDiv.onclick = changeEquipSkillHandler.bind(this, skillDiv, gameConfig.SKILL_CHANGE_PANEL_CONTAINER);
          }

          while (selectDiv.firstChild) {
            selectDiv.removeChild(selectDiv.firstChild);
          }
          equipSlot = convertEquipIndexToEnum(selectEquipIndex);

          //data change
          equipSkills.splice(selectEquipIndex, 1);
          equipSkillDatas.splice(selectEquipIndex, 1);

          equipSkills.splice(selectEquipIndex, 0, selectedSkillIndex);
          var skillData = objectAssign({}, util.findData(skillTable, 'index', selectedSkillIndex));
          equipSkillDatas.splice(selectEquipIndex, 0, skillData);

          var imgContainer = document.createElement('div');
          imgContainer.classList.add('popUpskillImgContainer');

          var skillImg = document.createElement('img');
          // skillImg.src = skillData.skillIcon;
          skillImg.src = resourceUI;
          var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
          skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
          util.setImgCssStyle(skillImg, iconData, rate);

          selectDiv.setAttribute('skillIndex', skillData.index);
          imgContainer.appendChild(skillImg);
          selectDiv.appendChild(imgContainer);
          this.applySkillCooldown(skillData.index, selectEquipIndex);
        }
      }else{
        if(selectedEquipIndex === -1){
          this.makeFlashMessage('Can not change character spell!!!');
          // alert('cant change base skill');
        }else{
          var nodeIndex = 0;
          for(var i=0; i<popUpSkillContainer.childNodes.length; i++){
            if(popUpSkillContainer.childNodes[i] === selectDiv){
              nodeIndex = i;
              break;
            }
          }
          popUpSkillContainer.removeChild(selectDiv);
          if(selectedSkillIndex){
            var beforeSkillData = objectAssign({}, util.findData(skillTable, 'index', selectedSkillIndex));
            var skillDiv = document.createElement('div');
            var imgContainer = document.createElement('div');
            imgContainer.classList.add('popUpskillImgContainer');
            var skillImg = document.createElement('img');

            var newImg = document.createElement('img');
            newImg.classList.add('disable');
            skillDiv.appendChild(newImg);

            skillDiv.setAttribute('skillIndex', selectedSkillIndex);

            skillDiv.classList.add('popUpSkillContainerItem');
            // skillImg.src = beforeSkillData.skillIcon;
            skillImg.src = resourceUI;
            var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', beforeSkillData.skillIcon));
            skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
            util.setImgCssStyle(skillImg, iconData, rate);

            imgContainer.appendChild(skillImg);
            skillDiv.appendChild(imgContainer);
            popUpSkillContainer.insertBefore(skillDiv, popUpSkillContainer.childNodes[nodeIndex]);
            // popUpSkillContainer.appendChild(skillDiv);

            skillDiv.onclick = changeEquipSkillHandler.bind(this, skillDiv, gameConfig.SKILL_CHANGE_PANEL_CONTAINER);
          }

          while (selectedDiv.firstChild) {
            selectedDiv.removeChild(selectedDiv.firstChild);
          }
          equipSlot = convertEquipIndexToEnum(selectedEquipIndex);
          //data change
          equipSkills.splice(selectedEquipIndex, 1);
          equipSkillDatas.splice(selectedEquipIndex, 1);

          equipSkills.splice(selectedEquipIndex, 0, skillIndex);
          var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
          equipSkillDatas.splice(selectedEquipIndex, 0, skillData);

          var imgContainer = document.createElement('div');
          imgContainer.classList.add('popUpskillImgContainer');

          var skillImg = document.createElement('img');
          // skillImg.src = skillData.skillIcon;
          skillImg.src = resourceUI;
          var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
          skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
          util.setImgCssStyle(skillImg, iconData, rate);

          selectedDiv.setAttribute('skillIndex', skillData.index);
          imgContainer.appendChild(skillImg);
          selectedDiv.appendChild(imgContainer);
          this.applySkillCooldown(skillData.index, selectedEquipIndex);
        }
      }
      this.onExchangeSkill(characterType);
      //set equipSkills
      if(!dontUpdateEquip){
        var slotCooldown = checkSlotCooldown(equipSlot);
        if(skillData && beforeSkillData){
          if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE && beforeSkillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            var beforeBuffIndex = objectAssign({}, util.findData(skillTable, 'index', beforeSkillData.index)).buffToSelf;
            var afterBuffIndex = objectAssign({}, util.findData(skillTable, 'index', skillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onExchangePassive(beforeBuffIndex, afterBuffIndex);
            }else{
              if(isStandbyEquipPassive(beforeBuffIndex)){
                deleteStandbyEquipPassive(beforeBuffIndex);
                addStandbyEquipPassive(afterBuffIndex);
                setTimeout(delayedEquipPassiveHandler.bind(this.onEquipPassive, afterBuffIndex), slotCooldown);
              }else{
                this.onUnequipPassive(beforeBuffIndex);
                addStandbyEquipPassive(afterBuffIndex);
                setTimeout(delayedEquipPassiveHandler.bind(this.onEquipPassive, afterBuffIndex), slotCooldown);
              }
            }
          }else if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            var buffIndex = objectAssign({}, util.findData(skillTable, 'index', skillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onEquipPassive(buffIndex);
            }else{
              addStandbyEquipPassive(buffIndex);
              setTimeout(delayedEquipPassiveHandler.bind(this.onEquipPassive, buffIndex), slotCooldown);
            }
          }else if(beforeSkillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            buffIndex = objectAssign({}, util.findData(skillTable, 'index', beforeSkillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onUnequipPassive(buffIndex);
            }else{
              if(isStandbyEquipPassive(buffIndex)){
                deleteStandbyEquipPassive(buffIndex);
              }else{
                this.onUnequipPassive(buffIndex);
              }
            }
          }
        }else if(skillData){
          if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            buffIndex = objectAssign({}, util.findData(skillTable, 'index', skillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onEquipPassive(buffIndex);
            }else{
              addStandbyEquipPassive(buffIndex);
              setTimeout(delayedEquipPassiveHandler.bind(this.onEquipPassive, buffIndex), slotCooldown);
            }
          }
        }else if(beforeSkillData){
          if(beforeSkillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            buffIndex = objectAssign({}, util.findData(skillTable, 'index', beforeSkillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onUnequipPassive(buffIndex);
            }else{
              if(isStandbyEquipPassive(buffIndex)){
                deleteStandbyEquipPassive(buffIndex);
              }else{
                this.onUnequipPassive(buffIndex);
              }
            }
          }
        }
      }

      this.setHUDSkills();
      updateCharInfoSelectedPanelSkillImage();

      selectedSkillIndex = null;
      selectedPanel = null;
      selectedDiv = null;
      selectedEquipIndex = null;

    }else if(skillIndex === selectedSkillIndex){
      //if click same icon
      if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP && selectEquipIndex !== -1){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', selectedSkillIndex));
        var skillDiv = document.createElement('div');
        var imgContainer = document.createElement('div');
        imgContainer.classList.add('popUpskillImgContainer');
        var skillImg = document.createElement('img');

        var newImg = document.createElement('img');
        newImg.classList.add('disable');
        skillDiv.appendChild(newImg);

        skillDiv.setAttribute('skillIndex', selectedSkillIndex);

        skillDiv.classList.add('popUpSkillContainerItem');
        // skillImg.src = skillData.skillIcon;
        skillImg.src = resourceUI;
        var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
        skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
        util.setImgCssStyle(skillImg, iconData, rate);

        imgContainer.appendChild(skillImg);
        skillDiv.appendChild(imgContainer);
        popUpSkillContainer.appendChild(skillDiv);

        skillDiv.onclick = changeEquipSkillHandler.bind(this, skillDiv, gameConfig.SKILL_CHANGE_PANEL_CONTAINER);

        while (selectedDiv.firstChild) {
          selectedDiv.removeChild(selectedDiv.firstChild);
          selectedDiv.setAttribute('skillIndex', '');
        }

        //data delete
        if(equipSkills[selectedEquipIndex]){
          equipSkills.splice(selectedEquipIndex, 1);
          equipSkillDatas.splice(selectedEquipIndex, 1);
        }
        equipSkills.splice(selectedEquipIndex, 0, undefined);
        equipSkillDatas.splice(selectedEquipIndex, 0, undefined);

        this.updateUnEquipSkillSlotCooldown(selectedEquipIndex);

        if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
          var buffIndex = objectAssign({}, util.findData(skillTable, 'index', skillData.index)).buffToSelf;
          equipSlot = convertEquipIndexToEnum(selectedEquipIndex);
          var slotCooldown = checkSlotCooldown(equipSlot);
          if(!slotCooldown){
            this.onUnequipPassive(buffIndex);
          }else{
            if(isStandbyEquipPassive(buffIndex)){
              deleteStandbyEquipPassive(buffIndex);
            }else{
              this.onUnequipPassive(buffIndex);
            }
          }
        }
      }

      this.setHUDSkills();
      updateCharInfoSelectedPanelSkillImage();

      selectedSkillIndex = null;
      selectedPanel = null;
      selectedDiv = null;
      selectedEquipIndex = null;
    }else if(selectedDiv === selectDiv){
      clearSelectedPanel();
    }else{
      selectedSkillIndex = skillIndex ? skillIndex : null;
      selectedPanel = selectPanel;
      selectedDiv = selectDiv;
      selectedEquipIndex = selectEquipIndex;

      selectDiv.classList.add('selected');
      if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_CONTAINER){
        popUpEquipSkill1.classList.add('equipable');
        popUpEquipSkill2.classList.add('equipable');
        popUpEquipSkill3.classList.add('equipable');
        popUpEquipSkill4.classList.add('equipable');
      }else if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP){
        if(selectEquipIndex !== -1){
          for(var i=0; i<popUpSkillContainer.children.length; i++){
            popUpSkillContainer.children[i].classList.add('equipable');
          }
        }
      }
    }
  }else{
    selectedSkillIndex = skillIndex ? skillIndex : null;
    selectedPanel = selectPanel;
    selectedDiv = selectDiv;
    selectedEquipIndex = selectEquipIndex;

    selectDiv.classList.add('selected');
    if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_CONTAINER){
      popUpEquipSkill1.classList.add('equipable');
      popUpEquipSkill2.classList.add('equipable');
      popUpEquipSkill3.classList.add('equipable');
      popUpEquipSkill4.classList.add('equipable');
    }else if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP){
      switch (selectEquipIndex) {
        case -1:
          //case base or inherentPassiveSkill
          break;
        default:
          for(var i=0; i<popUpSkillContainer.children.length; i++){
            popUpSkillContainer.children[i].classList.add('equipable');
          }
      }
    }
  }
  if(this.checkPopUpSkillChange()){
    this.setPopUpSkillChange(dontUpdateEquip);
    selectedSkillIndex = null;
    selectedPanel = null;
    selectedDiv = null;
    selectedEquipIndex = null;
    clearPopSkillChangeClass();
    this.updateSelectedPanel();
  }else{
    this.updateSelectedPanel(selectedSkillIndex);
  }
  this.checkSkillsConditions();
  if(!isClearTutorial){
    // for(var i=0; i<equipSkills.length; i++){
    var equipSkillsLength = 0;
    for(var i=0; i<equipSkills.length; i++){
      if(equipSkills[i]){
        equipSkillsLength++;
      }
    }
    if(equipSkillsLength >= 2){
    // if(equipSkills[i]===gameConfig.TUTORIAL_SKILL_INDEX){
      isClearTutorial = true;
    }else if(equipSkills[0] !== gameConfig.SKILL_INDEX_PYRO_GIVEN && equipSkills[0] !== gameConfig.SKILL_INDEX_FROST_GIVEN &&
             equipSkills[0] !== gameConfig.SKILL_INDEX_ARCANE_GIVEN){
      isClearTutorial = true;
    }
    // }
  }
};
function skillUpgradeBtnHandler(skillData){
  if(isServerResponse){
    if(selectedSkillIndex){
      //check resource
      if(skillData.nextSkillIndex !== -1){
        var goldAmount = parseInt(goldContainer.innerHTML);
        var jewelAmount = parseInt(jewelContainer.innerHTML);
        if(goldAmount >= skillData.upgradeGoldAmount && jewelAmount >= skillData.upgradeJewelAmount){
          this.onSkillUpgrade(selectedSkillIndex);
          isServerResponse = false;
          popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.add('disable');
          popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.remove('disable');
          this.serverResponseTimeout = setTimeout(function(){
            if(!isServerResponse){
              isServerResponse = true;
              popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.remove('disable');
              popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.add('disable');
            }
          }, gameConfig.MAX_SERVER_RESPONSE_TIME);
        }else{
          this.makeFlashMessage('Not enough resource!!!');
          // alert('need more resource');
        }
      }else{
        this.makeFlashMessage('Spell reach max level!!!');
      }
    }
  }
};
function startBtnClickHandler(button){
  if(button === startButton){
    var clickButton = gameConfig.START_BUTTON;
  }else if(button === restartButton){
    clickButton = gameConfig.RESTART_BUTTON;
  }
  if(clickButton === gameConfig.RESTART_BUTTON && standingScene.classList.contains('appearSmoothAni')){
    //do nothing
  }else{
    this.onStartBtnClick(characterType, clickButton);
  }
};
function cooldownListener(slot, checkSkillsConditions, e){
  this.classList.remove("cooldownMaskAni");
  this.style.opacity = 0;
  switch (slot) {
    case gameConfig.SKILL_BASIC_INDEX:
      isBaseSkillCooldownOff = true;
      break;
    case gameConfig.SKILL_EQUIP1_INDEX:
      isEquipSkill1CooldownOff = true;
      break;
    case gameConfig.SKILL_EQUIP2_INDEX:
      isEquipSkill2CooldownOff = true;
      break;
    case gameConfig.SKILL_EQUIP3_INDEX:
      isEquipSkill3CooldownOff = true;
      break;
    case gameConfig.SKILL_EQUIP4_INDEX:
      isEquipSkill4CooldownOff = true;
      break;
    default:
  }
  for(var i=0; i<cooldownSkills.length; i++){
    if(cooldownSkills[i].slot === slot){
      cooldownSkills.splice(i, 1);
      break;
    }
  }
  checkSkillsConditions();
};
function clearSelectedPanel(){
  while(popUpSkillInfoIcon.firstChild){
    popUpSkillInfoIcon.removeChild(popUpSkillInfoIcon.firstChild);
  }
  while(popUpSkillInfoDesc.firstChild){
    popUpSkillInfoDesc.removeChild(popUpSkillInfoDesc.firstChild);
  }

  popUpSkillUpgradeCostGold.innerHTML = "";
  popUpSkillUpgradeCostJewel.innerHTML = "";

  selectedSkillIndex = null;
  popUpSkillUpgradeBtn.onclick = new Function();

  selectedPanel = null;
  selectedDiv = null;
  selectedEquipIndex = null;

  popUpCancelSkillSelectBtn.classList.add('disable');
  skillUpgradeEffect.classList.remove('skillUpgradeEffectAni');

  clearPopSkillChangeClass();
};
function clearPopSkillChangeClass(){
  popUpEquipBaseSkill.classList.remove('selected');
  popUpEquipPassiveSkill.classList.remove('selected');
  popUpEquipSkill1.classList.remove('selected');
  popUpEquipSkill2.classList.remove('selected');
  popUpEquipSkill3.classList.remove('selected');
  popUpEquipSkill4.classList.remove('selected');

  popUpEquipSkill1.classList.remove('equipable');
  popUpEquipSkill2.classList.remove('equipable');
  popUpEquipSkill3.classList.remove('equipable');
  popUpEquipSkill4.classList.remove('equipable');

  for(var i=0; i<popUpSkillContainer.children.length; i++){
    popUpSkillContainer.children[i].classList.remove('equipable');
    popUpSkillContainer.children[i].classList.remove('selected');
  }
};
function bottomSkillTooltipOnHandler(slot){
  switch (slot) {
    case gameConfig.SKILL_BASIC_INDEX:
      if(baseSkillData){
        var skillData = baseSkillData;
      }
      break;
    case gameConfig.SKILL_EQUIP1_INDEX:
      if(equipSkillDatas[0]){
        skillData = equipSkillDatas[0];
      }
      break;
    case gameConfig.SKILL_EQUIP2_INDEX:
      if(equipSkillDatas[1]){
        skillData = equipSkillDatas[1];
      }
      break;
    case gameConfig.SKILL_EQUIP3_INDEX:
      if(equipSkillDatas[2]){
        skillData = equipSkillDatas[2];
      }
      break;
    case gameConfig.SKILL_EQUIP4_INDEX:
      if(equipSkillDatas[3]){
        skillData = equipSkillDatas[3];
      }
      break;
    case gameConfig.SKILL_PASSIVE_INDEX:
      if(inherentPassiveSkillData){
        skillData = inherentPassiveSkillData;
      }
      break;
    default:
  }
  if(skillData){
    var output = makeSkillTooltipString(skillData).replace(/&nbsp;/g, '<br>');

    var tooltipDiv = document.createElement('div');
    tooltipDiv.innerHTML = output;
    tooltipDiv.classList.add('bottomTooltip');

    var parentDiv = this.parentNode.parentNode;
    parentDiv.appendChild(tooltipDiv);
  }
};
function bottomSkillTooltipOffHandler(){
  var parentDiv = this.parentNode.parentNode;
  var tooltipDivs = parentDiv.getElementsByClassName('bottomTooltip');
  for(var i=0; tooltipDivs.length; i++){
    parentDiv.removeChild(tooltipDivs[i]);
  }
};
function skillTooltipHandler(){
  var skillIndex = parseInt(this.getAttribute('skillIndex'));
  if(skillIndex && util.isNumeric(skillIndex)){
    var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));

    var output = makeSkillTooltipString(skillData).replace(/&nbsp;/g, '<br>');

    var tooltipDiv = document.createElement('div');
    tooltipDiv.innerHTML = output;
    tooltipDiv.classList.add('bottomTooltip');

    this.appendChild(tooltipDiv);
  }
};
function statTooltipOnHandler(type, stat){
  var tooltipDiv = document.createElement('div');
  var output = "";
  switch (type) {
    case gameConfig.STAT_POWER_INDEX:
      var damageRate = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_POWER_TO_DAMAGE_RATE * 100) / 100;
      var HP = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_POWER_TO_HP * 100) / 100;
      var HPRegen = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_POWER_TO_HP_REGEN * 100) / 100;
      output += "Damage Rate <span class='green'>+" + damageRate + "%</span><br>";
      output += "Max HP <span class='green'>+" + HP + "</span><br>";
      output += "HP Regen <span class='green'>+" + HPRegen + "</span><br>";
      break;
    case gameConfig.STAT_MAGIC_INDEX:
      var Resistance = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_MAGIC_TO_RESISTANCE * 100) / 100;
      var MP = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_MAGIC_TO_MP * 100) / 100;
      var MPRegen = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_MAGIC_TO_MP_REGEN * 100) / 100;
      output += "All Resistance <span class='green'>+" + Resistance + "%</span><br>";
      output += "Max MP <span class='green'>+" + MP + "</span><br>";
      output += "MP Regen <span class='green'>+" + MPRegen + "</span><br>";
      break;
    case gameConfig.STAT_SPEED_INDEX:
      var castSpeed = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_SPEED_TO_CAST_SPEED * 100) / 100;
      var cooldownReduceRate = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_SPEED_TO_COOLDOWN_REDUCE_RATE * 100) / 100;
      output += "Casting Speed <span class='green'>+" + castSpeed + "%</span><br>";
      output += "Cooldown Reduce <span class='green'>+" + cooldownReduceRate + "%</span><br>";
      break;
    default:
  }
  tooltipDiv.innerHTML = output;
  tooltipDiv.classList.add('bottomTooltip');
  this.appendChild(tooltipDiv);
};
function offenceDefenceStatOnHandler(type, data){
  var tooltipDiv = document.createElement('div');
  var output = "";
  if(type === gameConfig.STAT_OFFENCE_INDEX){
    output += "<p><strong>All Damage <span class='green'>+" + (Math.floor((data.damageRate - 100) * 10) / 10) + "%</span></strong></p>";
    output += "<p>Fire Damage <span class='green'>+" + (Math.floor((data.fireDamageRate - 100) * 10) / 10) + "%</span></p>";
    output += "<p>Frost Damage <span class='green'>+" + (Math.floor((data.frostDamageRate - 100) * 10) / 10) + "%</span></p>";
    output += "<p>Arcane Damage <span class='green'>+" + (Math.floor((data.arcaneDamageRate - 100) * 10) / 10) + "%</span></p>";
  }else if(type === gameConfig.STAT_DEFENCE_INDEX){
    output += "<p><strong>All Resistance <span class='green'>+" + (Math.floor(data.resistAll * 10) / 10) + "%</span></strong></p>";
    output += "<p>Fire Resistance <span class='green'>+" + (Math.floor(data.resistFire * 10) / 10) + "%</span></p>";
    output += "<p>Frost Resistance <span class='green'>+" + (Math.floor(data.resistFrost * 10) / 10) + "%</span></p>";
    output += "<p>Arcane Resistance <span class='green'>+" + (Math.floor(data.resistArcane * 10) / 10) + "%</span></p>";
  }
  tooltipDiv.innerHTML = output;
  tooltipDiv.classList.add('bottomTooltip');
  this.appendChild(tooltipDiv);
};
function buffTooltipOnHandler(){
  var tooltipDiv = document.createElement('div');

  var buffGroupIndex = parseInt(this.getAttribute('buffGroupIndex'));
  var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupIndex));
  var output = "<h4 class='yellow'>" + buffGroupData.clientName + "</h4><hr>" + buffGroupData.clientDesc.replace(/&nbsp;/g, '<br>');

  tooltipDiv.innerHTML = output;
  tooltipDiv.classList.add('bottomTooltip');

  this.appendChild(tooltipDiv);
};
function bottomTooltipOffHandler(){
  var tooltipDivs = util.getElementsByClassName(this, 'bottomTooltip');
  for(var i=0; i<tooltipDivs.length; i++){
    this.removeChild(tooltipDivs[i]);
  }
};
function onSkillIconClickHandler(skillSlot){
  this.onSkillIconClick(skillSlot);
};
function onSelectSkillCancelBtnClickHandler(){
  this.onSelectSkillCancelBtnClick();
};
// function makeFlashMessage(msg){
//   var message = document.createElement('p');
//   message.innerHTML = msg;
//   message.classList.add('flashMessage');
//   setTimeout(function(){
//     message.classList.add('flashMessageAni');
//   }, 2000);
//   flashMessageContainer.appendChild(message);
//   // centerMessageContainer.insertBefore(messageDiv, centerMessageContainer.childNodes[0]);
//   setTimeout(function(){
//     flashMessageContainer.removeChild(message);
//   }, 5000);
// };
function updateCharInfoSelectedPanelSkillImage(){
  var rate = 45/72;
  var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', baseSkillData.skillIcon));
  standingSceneSelectedCharBaseSkill.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
  standingSceneSelectedCharBaseSkill.setAttribute('skillIndex', baseSkillData.index);
  util.setImgCssStyle(standingSceneSelectedCharBaseSkill.getElementsByTagName('img')[0], iconData, rate);

  iconData = objectAssign({}, util.findData(iconResourceTable, 'index', inherentPassiveSkillData.skillIcon));
  standingSceneSelectedCharPassiveSkill.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
  standingSceneSelectedCharPassiveSkill.setAttribute('skillIndex', inherentPassiveSkillData.index);
  util.setImgCssStyle(standingSceneSelectedCharPassiveSkill.getElementsByTagName('img')[0], iconData, rate);

  rate = 55/72;
  if(equipSkillDatas[0]){
    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[0].skillIcon));
    standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    standingSceneSelectedCharEquipSkill1.setAttribute('skillIndex', equipSkillDatas[0].index);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0], iconData, rate);
  }else{
    standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(blankFrameData, rate);
    standingSceneSelectedCharEquipSkill1.setAttribute('skillIndex', 0);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0], blankFrameData, rate);
  }
  if(equipSkillDatas[1]){
    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[1].skillIcon));
    standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    standingSceneSelectedCharEquipSkill2.setAttribute('skillIndex', equipSkillDatas[1].index);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0], iconData, rate);
  }else{
    standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(blankFrameData, rate);
    standingSceneSelectedCharEquipSkill2.setAttribute('skillIndex', 0);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0], blankFrameData, rate);
  }
  if(equipSkillDatas[2]){
    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[2].skillIcon));
    standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    standingSceneSelectedCharEquipSkill3.setAttribute('skillIndex', equipSkillDatas[2].index);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0], iconData, rate);
  }else{
    standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(blankFrameData, rate);
    standingSceneSelectedCharEquipSkill3.setAttribute('skillIndex', 0);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0], blankFrameData, rate);
  }
  if(equipSkillDatas[3]){
    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[3].skillIcon));
    standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    standingSceneSelectedCharEquipSkill4.setAttribute('skillIndex', equipSkillDatas[3].index);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0], iconData, rate);
  }else{
    standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(blankFrameData, rate);
    standingSceneSelectedCharEquipSkill4.setAttribute('skillIndex', 0);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0], blankFrameData, rate);
  }
};
function makeSkillTooltipString(skillData){
  var output = "";

  var color = 'white';
  switch (skillData.property) {
    case gameConfig.SKILL_PROPERTY_FIRE:
      color = 'red'
      break;
    case gameConfig.SKILL_PROPERTY_FROST:
      color = 'blue'
      break;
    case gameConfig.SKILL_PROPERTY_ARCANE:
      color = 'purple'
      break;
    default:
  }

  output += "<h4 class='" + color + "'><span class='yellow'>Lv " + skillData.level + "</span> " + skillData.clientName + "</h4><hr>";
  output += "<div class='tierLavel'><span class='green'>Tier : </span>" + skillData.tier + "</span></div>";
  if(skillData.type !== gameConfig.SKILL_TYPE_PASSIVE){
    output += "<div class='titleLabel'><span class='green'>Active</span></div>"
    switch (skillData.type) {
      case gameConfig.SKILL_TYPE_INSTANT_RANGE:
        if(skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage){
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span></div>";
          output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
        }else{
          output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
        }
        break;
      case gameConfig.SKILL_TYPE_INSTANT_PROJECTILE:
        output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span></div>";
        output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
        break;
      case gameConfig.SKILL_TYPE_PROJECTILE:
        output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span></div>";
        output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
        break;
      case gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION:
        output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span></div>";
        output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
        break;
      case gameConfig.SKILL_TYPE_PROJECTILE_TICK:
        output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span></div>";
        output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
        break;
      case gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION:
        output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span></div>";
        output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
        break;
      case gameConfig.SKILL_TYPE_RANGE:
        if(skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage){
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span></div>";
        }
        output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
        break;
      case gameConfig.SKILL_TYPE_SELF:
        var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', skillData.buffToSelf));
        var duration = Math.floor(buffGroupData.buffLifeTime * 10) / 10000;
        if(isNaN(duration) || duration <= 0.1){
          // output += "<div></div>"
          // output += "<div></div>"
        }else{
          output += "<div><span class='yellow'>Buff Duration : </span>" + duration + "(s)</div>";
          output += "<div></div>"
        }
        break;
      case gameConfig.SKILL_TYPE_SELF_EXPLOSION:
        output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span></div>";
        output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
        break;
      case gameConfig.SKILL_TYPE_TELEPORT:
        output += "<div><span class='yellow'>Range : </span>" + (skillData.range) + "</div>";
        output += "<div></div>"
        break;
      default:
    }
    output += "<div><span class='yellow'>MP Cost : </span>" + skillData.consumeMP + "</div>";
    var cooldown = Math.floor(skillData.cooldown * 10) / 10000;
    if(skillData.type !== gameConfig.SKILL_TYPE_INSTANT_RANGE || skillData.type !== gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
      output += "<div><span class='yellow'>Cooldown : </span>" + cooldown + "(s)</div>";
    }

    output += "<hr>"
  }else{
    output += "<div class='titleLabel'><span class='green'>Passive</span></div>"
    output += "<div></div><div></div><hr>"
  }
  output += "<p>" + skillData.clientDesc + "</p>";
  return output;
};
function convertEquipIndexToEnum(equipIndex){
  switch (equipIndex) {
    case 0:
      return gameConfig.SKILL_EQUIP1_INDEX;
    case 1:
      return gameConfig.SKILL_EQUIP2_INDEX;
    case 2:
      return gameConfig.SKILL_EQUIP3_INDEX;
    case 3:
      return gameConfig.SKILL_EQUIP4_INDEX;
    default:
  }
};
function checkSlotCooldown(slot){
  var slotCooldown = 0;
  for(var i=0; i<cooldownSkills.length; i++){
    if(slot === cooldownSkills[i].slot){
      var timeDelay = Date.now() - cooldownSkills[i].startTime;
      slotCooldown = cooldownSkills[i].cooldownTime * 1000 - timeDelay;
      break;
    }
  }
  return slotCooldown;
};
function isStandbyEquipPassive(buffIndex){
  for(var i=0; i<standbyEquipPassiveList.length; i++){
    if(standbyEquipPassiveList[i] === buffIndex){
      return true;
    }
  }
  return false;
};
function addStandbyEquipPassive(buffIndex){
  for(var i=standbyEquipPassiveList.length - 1; i>=0; i--){
    if(standbyEquipPassiveList[i] === buffIndex){
      standbyEquipPassiveList.splice(i, 1);
    }
  }
  standbyEquipPassiveList.push(buffIndex);
};
function deleteStandbyEquipPassive(buffIndex){
  var arrayIndex = standbyEquipPassiveList.indexOf(buffIndex);
  if(arrayIndex !== -1){
    standbyEquipPassiveList.splice(arrayIndex, 1);
  }
};
function delayedEquipPassiveHandler(buffIndex){
  for(var i=standbyEquipPassiveList.length - 1; i>=0; i--){
    if(standbyEquipPassiveList[i] === buffIndex){
      standbyEquipPassiveList.splice(i, 1);
      this(buffIndex);
      break;
    }
  }
};
function playPopUpTutorial(){
  if(!isPlayingTutorial){
    isPlayingTutorial = true;
    popUpSkillInfoAndBtn.classList.add('disable');
    popUpSkillTextSkillInfo.classList.add('disable');
    //animate tutorial
    setTimeout(function(){
      if(!isClearTutorial){
        popUpSkillContainer.classList.add('skillEquipTutorialHighlight');
      }else{
        disablePopUpTutorial();
      }
    }, 200);
    setTimeout(function(){
      if(!isClearTutorial){
        popUpSkillTutorialClickText2.classList.add('disable');
        popUpSkillTutorialClickText1.classList.remove('disable');
        popUpSkillTutorialClickText1.classList.add('skillEquipTutorialAni');
      }else{
        disablePopUpTutorial();
      }
    }, 500);
    setTimeout(function(){
      if(!isClearTutorial){
        popUpSkillTutorialClickText1.classList.add('disable');
        popUpSkillTutorialArrow.classList.remove('disable');
        popUpSkillTutorialArrow.classList.add('skillEquipTutorialAni');
        popUpSkillTutorialArrow.style.animationIterationCount = 1;
      }else{
        disablePopUpTutorial();
      }
      popUpSkillContainer.classList.remove('skillEquipTutorialHighlight');
    }, 2500);
    setTimeout(function(){
      if(!isClearTutorial){
        popUpEquipSkillsContainer.classList.add('skillEquipTutorialHighlight');
      }else{
        disablePopUpTutorial();
      }
    }, 3500);
    setTimeout(function(){
      if(!isClearTutorial){
        popUpSkillTutorialClickText2.classList.remove('disable');
        popUpSkillTutorialArrow.classList.add('disable');
        popUpSkillTutorialClickText2.classList.add('skillEquipTutorialAni');
      }else{
        disablePopUpTutorial();
      }
    }, 3800);
    setTimeout(function(){
      popUpEquipSkillsContainer.classList.remove('skillEquipTutorialHighlight');
      isPlayingTutorial = false;
      disablePopUpTutorial();
      if(!isClearTutorial){
        popUpSkillTutorialClickText2.classList.add('disable');
        playPopUpTutorial();
      }
    }, 5800);
  }
};
function disablePopUpTutorial(){
  popUpSkillInfoAndBtn.classList.remove('disable');
  popUpSkillTextSkillInfo.classList.remove('disable');

  popUpSkillContainer.classList.remove('skillEquipTutorialHighlight');
  popUpEquipSkillsContainer.classList.remove('skillEquipTutorialHighlight');
  popUpSkillTutorialClickText1.classList.add('disable');
  popUpSkillTutorialClickText2.classList.add('disable');
  popUpSkillTutorialArrow.classList.add('disable');
};
function setStartSceneCharIconClick(){
  var children = document.getElementById('startSceneHudCenterCenterCharSelect').children;
  for(var i=0; i<children.length; i++){
    children[i].onclick = function(){
      var type = parseInt(this.getAttribute('type'));
      if(type === gameConfig.CHAR_TYPE_FIRE || type === gameConfig.CHAR_TYPE_FROST || type === gameConfig.CHAR_TYPE_ARCANE){
        characterType = type;
      }else{
        characterType = gameConfig.CHAR_TYPE_FIRE;
      }
      for(var j=0; j<children.length; j++){
        children[j].classList.remove('selectedChar');
      }
      this.classList.add('selectedChar');

      //updateSelectedPanel
      var name = "";
      var desc = "";
      var color = "";
      switch (type) {
        case gameConfig.CHAR_TYPE_FIRE:
          name = fireCharName;
          desc = fireCharDesc;
          color = "red";
          break;
        case gameConfig.CHAR_TYPE_FROST:
          name = frostCharName;
          desc = frostCharDesc;
          color = "blue";
          break;
        case gameConfig.CHAR_TYPE_ARCANE:
          name = arcaneCharName;
          desc = arcaneCharDesc;
          color = "purple";
          break;
        default:
      }
      var statData = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', characterType, 'level', 1));
      startSceneSelectedCharName.innerHTML = "<span class='" + color + "'>" + name + "</span>";
      startSceneSelectedCharDesc.innerHTML = desc;
      startSceneSelectedCharStatPower.getElementsByTagName('span')[0].innerHTML = statData.power;
      startSceneSelectedCharStatMagic.getElementsByTagName('span')[0].innerHTML = statData.magic;
      startSceneSelectedCharStatSpeed.getElementsByTagName('span')[0].innerHTML = statData.speed;

      startSceneSelectedCharStatPower.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatPower, gameConfig.STAT_POWER_INDEX, statData.power);
      startSceneSelectedCharStatPower.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatPower);

      startSceneSelectedCharStatMagic.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatMagic, gameConfig.STAT_MAGIC_INDEX, statData.magic);
      startSceneSelectedCharStatMagic.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatMagic);

      startSceneSelectedCharStatSpeed.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatSpeed, gameConfig.STAT_SPEED_INDEX, statData.speed);
      startSceneSelectedCharStatSpeed.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatSpeed);
    };
  }
  children[0].onclick();
};
module.exports = UIManager;

},{"../public/gameConfig.json":8,"../public/objectAssign.js":9,"../public/serverList.json":11,"../public/util.js":12}],5:[function(require,module,exports){
var util = require('../public/util.js');
var Skill = require('./CSkill.js');
var gameConfig = require('../public/gameConfig.json');

var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;

var User = function(userData){
  this.objectID = userData.objectID;

  this.name = userData.name;
  this.type = userData.type;
  this.imgData = userData.imgData;

  this.hitImgDataList = [];
  this.buffImgDataList = [];

  this.imgHandIndex = 0;

  this.level = userData.level;
  this.exp = userData.exp;

  this.maxHP = userData.maxHP;
  this.maxMP = userData.maxMP;
  this.HP = userData.HP;
  this.MP = userData.MP;
  this.castSpeed = userData.castSpeed;
  this.conditions = userData.conditions;

  this.currentState = null;
  this.currentSkill = undefined;
  //use for execute skill only once.
  this.isExecutedSkill = false;
  //Effect around user skill effect, when cast skill. skill onFire set false.
  this.skillCastEffectPlay = false;
  this.castEffectFactor = 1;

  this.effectTimer = Date.now();
  this.effectRotateDegree = 0;
  this.effectIndex = 0;

  this.size = userData.size;

  this.position = userData.position;
  this.targetPosition = userData.targetPosition;
  this.direction = userData.direction;
  this.rotateSpeed = userData.rotateSpeed;

  this.maxSpeed = userData.maxSpeed;

  this.center = {x : 0, y : 0};
  this.speed = {x : 0, y : 0};
  this.targetDirection = 0;

  this.timer = Date.now();
  this.castingEndTime = false;

  this.setCenter();
  this.setSpeed();
  this.setTargetDirection();

  this.chatMessage = "";

  this.updateInterval = false;
  this.imgHandTimeout = false;
  this.chatMessageTimeout = false;

  this.updateFunction = null;

  this.entityTreeEle = {
    x : this.position.x,
    y : this.position.y,
    width : this.size.width,
    height : this.size.height,
    id : this.objectID
  };

  this.onMove = new Function();
  this.onMainUserMove = new Function();
};

User.prototype = {
  changeState : function(newState){
    this.currentState = newState;

    this.stop();
    switch (this.currentState) {
      case gameConfig.OBJECT_STATE_IDLE:
        this.updateFunction = this.idle.bind(this);
        break;
      case gameConfig.OBJECT_STATE_MOVE:
        this.updateFunction = this.rotate.bind(this);
        break;
      // case gameConfig.OBJECT_STATE_MOVE_OFFSET:
        // this.updateFunction = this.rotate.bind(this);
        // break;
      case gameConfig.OBJECT_STATE_ATTACK:
        this.updateFunction = this.attack.bind(this);
        break;
      case gameConfig.OBJECT_STATE_CAST:
        this.updateFunction = this.rotate.bind(this);
        break;
      case gameConfig.OBJECT_STATE_DEATH:
        this.updateFunction = this.idle.bind(this);
        break;
      case gameConfig.OBJECT_STATE_MOVE_AND_ATTACK:
        this.updateFunction = this.rotate.bind(this);
        break;
    }
    this.update();
  },
  update : function(){
    this.updateInterval = setInterval(this.updateFunction, INTERVAL_TIMER);
  },
  setCenter : function(){
    this.center.x = this.position.x + this.size.width/2,
    this.center.y = this.position.y + this.size.height/2
  },
  idle : function(){
    this.doEveryTick();
  },
  rotate : function(){
    var deltaTime = (Date.now() - this.timer)/1000;
    util.rotate.call(this, deltaTime);
    this.doEveryTick();
  },
  move : function(deltaTime, isMoveSlight){
    if(isMoveSlight){
      util.move.call(this, deltaTime, isMoveSlight)
    }else{
      util.move.call(this, deltaTime);
    }
    this.onMainUserMove();
  },
  setTargetDirection : function(moveBackward){
    util.setTargetDirection.call(this, moveBackward);
  },
  setSpeed : function(decreaseRate){
    util.setSpeed.call(this, decreaseRate);
  },
  moveOffset : function(){
    util.moveOffset.call(this);
  },
  attack : function(){
    this.executeSkill();
    this.doEveryTick();
  },
  doEveryTick : function(){
    this.timer = Date.now();
    if(Date.now() - this.effectTimer >= gameConfig.USER_ATTACH_EFFECT_CHANGE_TIME){
      this.effectTimer = Date.now();
      this.effectRotateDegree += 10;
      if(this.effectIndex > 100){
        this.effectIndex = 0;
      }else{
        this.effectIndex += 1;
      }
    }
    for(var i=this.hitImgDataList.length - 1; i>=0; i--){
      if(Date.now() - this.hitImgDataList[i].startTime >= this.hitImgDataList[i].resourceLifeTime){
        this.hitImgDataList.splice(i, 1);
      }
    }
  },
  updateBuffImgData : function(buffImgDataList){
    this.buffImgDataList = [];
    for(var i=0; i<buffImgDataList.length; i++){
      this.buffImgDataList.push(buffImgDataList[i]);
    }
  },
  updateSkillHitImgData : function(skillImgData){
    skillImgData.startTime = Date.now();
    this.hitImgDataList.push(skillImgData);
  },
  addPosAndTargetPos : function(addPosX , addPosY){
    this.position.x += addPosX;
    this.position.y += addPosY;

    this.targetPosition.x += addPosX;
    this.targetPosition.y += addPosY;

    this.setCenter();
  },
  stop : function(){
    if(this.updateInterval){
      clearInterval(this.updateInterval);
      this.updateInterval = false;
    }
    if(this.currentSkill){
      this.currentSkill.destroy();
      this.currentSkill = undefined;
      this.isExecutedSkill = false;
      this.skillCastEffectPlay = false;
    }
    if(this.imgHandTimeout){
      clearTimeout(this.imgHandTimeout);
      this.imgHandTimeout = false;
    }
    this.imgHandIndex = 0;
    this.castingEndTime = false;
  },
  setEntityEle : function(){
    this.entityTreeEle = {
      x : this.position.x,
      y : this.position.y,
      width : this.size.width,
      height : this.size.height,
      id : this.objectID
    };
  },
  makeSkillInstance : function(skillData){
    var userAniTime = Math.floor(gameConfig.USER_ANI_TIME * (100 / this.castSpeed));
    var skillInstance = new Skill(skillData, skillData.fireTime - userAniTime);
    skillInstance.onUserAniStart = onCastSkillHandler.bind(this, skillInstance, userAniTime);
    skillInstance.onTimeOver = onTimeOverHandler.bind(this, skillInstance);
    return skillInstance;
  },
  setSkill : function(skillInstance){
    this.currentSkill = skillInstance;
  },
  executeSkill : function(){
    if(!this.isExecutedSkill){
      this.skillCastEffectPlay = true;
      this.skillCastEffectStartTime = Date.now();
      this.isExecutedSkill = true;
      this.currentSkill.executeSkill();
    }
    this.setCastEffectFactor();
  },
  setCastEffectFactor : function(){
    var timeDiff = Date.now() - this.skillCastEffectStartTime;
    this.castEffectFactor = util.interpolationSine(timeDiff);
  },
  updateSkillPossessions : function(possessSkills){
    this.possessSkills = possessSkills;
  },
  makeProjectile : function(projectileID, skillInstance, direction){
    var projectile = skillInstance.makeProjectile(this.center, projectileID, direction);
    return projectile;
  },
  changePosition : function(newCenter){
    this.position.x = newCenter.x - this.size.width/2;
    this.position.y = newCenter.y - this.size.height/2;
    this.setCenter();
  },
  setChatMsg : function(msg){
    if(this.chatMessageTimeout){
      clearTimeout(this.chatMessageTimeout);
      this.chatMessageTimeout = false;
    }
    this.chatMessage = msg;
    var thisUser = this;
    this.chatMessageTimeout = setTimeout(function(){
      thisUser.chatMessageTimeout = false;
      thisUser.chatMessage = "";
    }, gameConfig.CHAT_MESSAGE_TIME);
  }
};

function onTimeOverHandler(skillInstance){
  skillInstance.destroy();
  this.currentSkill = undefined;
  this.isExecutedSkill = false;
  this.skillCastEffectPlay = false;

  this.castingEndTime = false;
  this.changeState(gameConfig.OBJECT_STATE_IDLE);
};
function onCastSkillHandler(skillInstance, userAniTime){
  var tickTime = userAniTime/5;
  // this.castingEndTime = Date.now() + userAniTime;
  this.castingEndTime = Date.now() + (skillInstance.totalTime - skillInstance.userAniStartTime);
  this.imgHandTimeout = setTimeout(imgHandTimeoutHandler.bind(this, tickTime), tickTime);
  console.log('cast ani start');
};
function imgHandTimeoutHandler(tickTime){
  if(this.imgHandIndex < 4){
    this.imgHandIndex++;
    this.imgHandTimeout = setTimeout(imgHandTimeoutHandler.bind(this, tickTime), tickTime);
  }else{
    this.imgHandIndex = 0;
    // this.castingEndTime = false;
  }
};
module.exports = User;

},{"../public/gameConfig.json":8,"../public/util.js":12,"./CSkill.js":3}],6:[function(require,module,exports){

module.exports = {
    toObject        : toObject,
    toArray         : toArray,
    toColumnArray   : toColumnArray,
    toSchemaObject  : toSchemaObject,
    toCSV           : toCSV
}


function toColumnArray(data, opts){

    opts = opts || { };

    var delimiter   = (opts.delimiter || ',');
    var quote       = _getQuote(opts.quote);
    var content     = data;
    var headers     = null;

    if(typeof(content) !== "string"){
        throw new Error("Invalid input, input data should be a string");
    }

    content         = content.split(/[\n\r]+/ig);

    if(typeof(opts.headers) === "string"){
        headers = opts.headers.split(/[\n\r]+/ig);
        headers = quote ?
                _convertArray(headers.shift(), delimiter, quote) :
                headers.shift().split(delimiter);
    }else{
        headers = quote ?
                _convertArray(content.shift(), delimiter, quote) :
                content.shift().split(delimiter);
    }


    var hashData    = { };

    headers.forEach(function(item){
        hashData[item] = [];
    });

    content.forEach(function(item){
        if(item){
            item = quote ?
                  _convertArray(item, delimiter, quote) :
                  item.split(delimiter);
            item.forEach(function(val, index){
                hashData[headers[index]].push(_trimQuote(val));
            });
        }
    });

    return hashData;
}

function toObject(data, opts){

    opts = opts || { };

    var delimiter   = (opts.delimiter || ',');
    var quote       = _getQuote(opts.quote);
    var content     = data;
    var headers     = null;

    if(typeof(content) !== "string"){
        throw new Error("Invalid input, input data should be a string");
    }

    content = content.split(/[\n\r]+/ig);

    if(typeof(opts.headers) === "string"){
        headers = opts.headers.split(/[\n\r]+/ig);
        headers = quote ?
                _convertArray(headers.shift(), delimiter, quote) :
                headers.shift().split(delimiter);
    }else{
        headers = quote ?
                _convertArray(content.shift(), delimiter, quote) :
                content.shift().split(delimiter);
    }

    var hashData = [ ];
    content.forEach(function(item){
        if(item){
          item = quote ?
                _convertArray(item, delimiter, quote) :
                item.split(delimiter);
          var hashItem = { };
          headers.forEach(function(headerItem, index){
              var tempItem = _trimQuote(item[index]);
              if(parseInt(tempItem) || parseInt(tempItem) === 0){
                hashItem[headerItem] = parseInt(tempItem);
              }else if(parseFloat(tempItem)){
                hashItem[headerItem] = parseFloat(tempItem);
              }else{
                hashItem[headerItem] = tempItem;
              }
          });
          hashData.push(hashItem);
        }
    });
    return hashData;
}

function toSchemaObject(data, opts){

    opts = opts || { };

    var delimiter   = (opts.delimiter || ',');
    var quote       = _getQuote(opts.quote);
    var content     = data;
    var headers     = null;
    if(typeof(content) !== "string"){
        throw new Error("Invalid input, input should be a string");
    }

    content         = content.split(/[\n\r]+/ig);


    if(typeof(opts.headers) === "string"){
        headers = opts.headers.split(/[\n\r]+/ig);
        headers = quote ?
                _convertArray(headers.shift(), delimiter, quote) :
                headers.shift().split(delimiter);
    }else{
        headers = quote ?
                _convertArray(content.shift(), delimiter, quote) :
                content.shift().split(delimiter);
    }


    var hashData    = [ ];

    content.forEach(function(item){
        if(item){
          item = quote ?
                _convertArray(item, delimiter, quote) :
                item.split(delimiter);
            var schemaObject = {};
            item.forEach(function(val, index){
                _putDataInSchema(headers[index], val, schemaObject , delimiter, quote);
            });
            hashData.push(schemaObject);
        }
    });

    return hashData;
}

function toArray(data, opts){

    opts = opts || { };

    var delimiter   = (opts.delimiter || ',');
    var quote       = _getQuote(opts.quote);
    var content     = data;

    if(typeof(content) !== "string"){
        throw new Error("Invalid input, input data should be a string");
    }

    content = content.split(/[\n\r]+/ig);
    var arrayData = [ ];
    content.forEach(function(item){
        if(item){
            item = quote ?
                _convertArray(item, delimiter, quote) :
                item.split(delimiter);

            item = item.map(function(cItem){
                return _trimQuote(cItem);
            });
            arrayData.push(item);
        }
    });
    return arrayData;
}

function _getQuote(q){
  if(typeof(q) === "string"){
    return q;
  }else if(q === true){
    return '"';
  }
  return null;
}

function _dataType(arg) {
    if (arg === null) {
        return 'null';
    }
    else if (arg && (arg.nodeType === 1 || arg.nodeType === 9)) {
        return 'element';
    }
    var type = (Object.prototype.toString.call(arg)).match(/\[object (.*?)\]/)[1].toLowerCase();
    if (type === 'number') {
        if (isNaN(arg)) {
            return 'nan';
        }
        if (!isFinite(arg)) {
            return 'infinity';
        }
    }
    return type;
}

function toCSV(data, opts){

    opts                = (opts || { });
    opts.delimiter      = (opts.delimiter || ',');
    opts.wrap           = (opts.wrap || '');
    opts.arrayDenote    = (opts.arrayDenote && String(opts.arrayDenote).trim() ? opts.arrayDenote : '[]');
    opts.objectDenote   = (opts.objectDenote && String(opts.objectDenote).trim() ? opts.objectDenote : '.');
    opts.detailedOutput = (typeof(opts.detailedOutput) !== "boolean" ? true : opts.detailedOutput);
    opts.headers        = String(opts.headers).toLowerCase();
    var csvJSON         = { };
    var csvData         = "";

    if(!opts.headers.match(/none|full|relative|key/)){
      opts.headers = 'full';
    }else{
      opts.headers = opts.headers.match(/none|full|relative|key/)[0];
    }

    if(opts.wrap === true){
        opts.wrap = '"';
    }

    if(typeof(data) === "string"){
        data = JSON.parse(data);
    }

    _toCsv(data, csvJSON, "", 0, opts);

    var headers = _getHeaders(opts.headers, csvJSON, opts);

    if(headers){
      if(opts.wrap){
        headers = headers.map(function(item){
          return opts.wrap + item + opts.wrap;
        });
      }
      csvData = headers.join(opts.delimiter);
    }

    var bigArrayLen = _getBigArrayLength(csvJSON);
    var keys        = Object.keys(csvJSON);
    var row         = [ ];

    var replaceNewLinePattern = /\n|\r/g;
    if(!opts.wrap){
        replaceNewLinePattern = new RegExp('\n|\r|' + opts.delimiter, 'g');
    }


    for(var i = 0; i < bigArrayLen; i++){
        row = [ ];
        for(var j = 0; j < keys.length; j++){
            if(csvJSON[keys[j]][i]){
                csvJSON[keys[j]][i] = csvJSON[keys[j]][i].replace(replaceNewLinePattern, '\t');
                if(opts.wrap){
                    csvJSON[keys[j]][i] = opts.wrap + csvJSON[keys[j]][i] + opts.wrap;
                }
                row[row.length] = csvJSON[keys[j]][i];
            }else{
                row[row.length] = "";
            }
        }
      csvData += '\n' + row.join(opts.delimiter);
    }
    return csvData;
}

function _toCsv(data, table, parent, row, opt){
    if(_dataType(data) === 'undefined'){
        return _putData('', table, parent, row, opt);
    }else if(_dataType(data) === 'null'){
        return _putData('null', table, parent, row, opt);
    }else if(Array.isArray(data)){
        return _arrayToCsv(data, table, parent, row, opt);
    }else if(typeof(data) === "object"){
        return _objectToCsv(data, table, parent, row, opt);
    }else{
        return _putData(String(data), table, parent, row, opt);
    }
}

function _putData(data, table, parent, row, opt){
  if(!table || !table[parent]){
      table[parent] = [ ];
  }
  if(row < table[parent].length){
    row = table[parent].length;
  }
  table[parent][row] = data;
  return table;
}

function _arrayToCsv(data, table, parent, row, opt){
    if(_doesNotContainsObjectAndArray(data)){
      return _putData(data.join(';'), table, parent + opt.arrayDenote, row, opt);
    }
    data.forEach(function(item, index){
        return _toCsv(item, table, parent + opt.arrayDenote, index, opt);
    });
}

function _doesNotContainsObjectAndArray(array){
  return array.every(function(item){
        var datatype = _dataType(item);
        if(!datatype.match(/array|object/)){
          return true;
        }
        return false;
  });
}

function _objectToCsv(data, table, parent, row, opt){
  Object.keys(data).forEach(function(item){
      return _toCsv(data[item], table, parent + opt.objectDenote + item, row, opt);
  });
}

function _getHeaders(headerType, table, opt){
  var keyMatchPattern       = /([^\[\]\.]+)$/;
  var relativeMatchPattern  = /\[\]\.?([^\[\]]+)$/;
  switch(headerType){
    case "none":
      return null;
    case "full":
      return Object.keys(table);
    case "key":
      return Object.keys(table).map(function(header){
        var head = header.match(keyMatchPattern);
        if(head && head.length === 2){
          return head[1];
        }
        return header;
      });
    case "relative":
      return Object.keys(table).map(function(header){
        var head = header.match(relativeMatchPattern);
        if(head && head.length === 2){
          return head[1];
        }
        return header;
      });
  }
}

function _getBigArrayLength(table){
  var len = 0;
  Object.keys(table).forEach(function(item){
      if(Array.isArray(table[item]) && table[item].length > len){
        len = table[item].length;
      }
  });
  return len;
}

function _putDataInSchema(header, item, schema, delimiter, quote){
    var match = header.match(/\[*[\d]\]\.(\w+)|\.|\[\]|\[(.)\]|-|\+/ig);
    var headerName, currentPoint;
    if(match){
        var testMatch = match[0];
        if(match.indexOf('-') !== -1){
            return true;
        }else if(match.indexOf('.') !== -1){
            var headParts = header.split('.');
            currentPoint = headParts.shift();
            schema[currentPoint] = schema[currentPoint] || {};
            _putDataInSchema(headParts.join('.'), item, schema[currentPoint], delimiter, quote);
        }else if(match.indexOf('[]') !== -1){
            headerName = header.replace(/\[\]/ig,'');
            if(!schema[headerName]){
            schema[headerName] = [];
            }
            schema[headerName].push(item);
        }else if(/\[*[\d]\]\.(\w+)/.test(testMatch)){
            headerName = header.split('[').shift();
            var index = parseInt(testMatch.match(/\[(.)\]/).pop(),10);
            currentPoint = header.split('.').pop();
            schema[headerName] = schema[headerName] || [];
            schema[headerName][index] = schema[headerName][index] || {};
            schema[headerName][index][currentPoint] = item;
        }else if(/\[(.)\]/.test(testMatch)){
            var delimiter = testMatch.match(/\[(.)\]/).pop();
            headerName = header.replace(/\[(.)\]/ig,'');
            schema[headerName] = _convertArray(item, delimiter, quote);
        }else if(match.indexOf('+') !== -1){
            headerName = header.replace(/\+/ig,"");
            schema[headerName] = Number(item);
        }
    }else{
        schema[header] = _trimQuote(item);
    }
    return schema ;
}

function _trimQuote(str){
    if(str){
        return String(str).trim().replace(/^["|'](.*)["|']$/, '$1');
    }
    return "";
}

function _convertArray(str, delimiter, quote) {
    if(quote && str.indexOf(quote) !== -1){
      return _csvToArray(str, delimiter, quote);
    }
    var output = [];
    var arr = str.split(delimiter);
    arr.forEach(function(val) {
        var trimmed = val.trim();
        output.push(trimmed);
    });
    return output;
}

function _csvToArray(text, delimit, quote) {

    delimit = delimit || ",";
    quote   = quote || '"';

    var value = new RegExp("(?!\\s*$)\\s*(?:" +  quote + "([^" +  quote + "\\\\]*(?:\\\\[\\S\\s][^" +  quote + "\\\\]*)*)" +  quote + "|([^" +  delimit  +  quote + "\\s\\\\]*(?:\\s+[^" +  delimit  +  quote + "\\s\\\\]+)*))\\s*(?:" +  delimit + "|$)", "g");

    var a = [ ];

    text.replace(value,
        function(m0, m1, m2) {
            if(m1 !== undefined){
                a.push(m1.replace(/\\'/g, "'"));
            }else if(m2 !== undefined){
                a.push(m2);
            }
            return '';
        }
    );

    if (/,\s*$/.test(text)){
        a.push('');
    }
    return a;
}

},{}],7:[function(require,module,exports){
module.exports={
  "userStatData" : "index,level,needExp,type,power,magic,speed,imgData\n1,1,150,1,22,14,19,1\n2,2,225,1,24,15,21,1\n3,3,300,1,27,17,23,1\n4,4,375,1,29,18,25,1\n5,5,450,1,32,20,27,1\n6,6,550,1,34,21,29,2\n7,7,650,1,37,23,31,2\n8,8,750,1,39,24,33,2\n9,9,850,1,42,26,35,2\n10,10,950,1,44,27,37,2\n11,11,1050,1,47,29,39,3\n12,12,1150,1,49,30,41,3\n13,13,1300,1,52,32,43,3\n14,14,1450,1,54,33,45,3\n15,15,1600,1,57,35,47,3\n16,16,1750,1,59,36,49,4\n17,17,1900,1,62,38,51,4\n18,18,2050,1,64,39,53,4\n19,19,2200,1,67,41,55,4\n20,20,-1,1,69,42,57,5\n101,1,150,2,17,21,17,6\n102,2,225,2,19,23,18,6\n103,3,300,2,21,26,20,6\n104,4,375,2,23,28,21,6\n105,5,450,2,25,31,23,6\n106,6,550,2,27,33,24,7\n107,7,650,2,29,36,26,7\n108,8,750,2,31,38,27,7\n109,9,850,2,33,41,29,7\n110,10,950,2,35,43,30,7\n111,11,1050,2,37,46,32,8\n112,12,1150,2,39,48,33,8\n113,13,1300,2,41,51,35,8\n114,14,1450,2,43,53,36,8\n115,15,1600,2,45,56,38,8\n116,16,1750,2,47,58,39,9\n117,17,1900,2,49,61,41,9\n118,18,2050,2,51,63,42,9\n119,19,2200,2,53,66,44,9\n120,20,-1,2,55,68,45,10\n201,1,150,3,18,15,22,11\n202,2,225,3,20,16,24,11\n203,3,300,3,22,18,27,11\n204,4,375,3,24,19,29,11\n205,5,450,3,26,21,32,11\n206,6,550,3,28,22,34,12\n207,7,650,3,30,24,37,12\n208,8,750,3,32,25,39,12\n209,9,850,3,34,27,42,12\n210,10,950,3,36,28,44,12\n211,11,1050,3,38,30,47,13\n212,12,1150,3,40,31,49,13\n213,13,1300,3,42,33,52,13\n214,14,1450,3,44,34,54,13\n215,15,1600,3,46,36,57,13\n216,16,1750,3,48,37,59,14\n217,17,1900,3,50,39,62,14\n218,18,2050,3,52,40,64,14\n219,19,2200,3,54,42,67,14\n220,20,-1,3,56,43,69,15\n",
  "skillData" : "index,name,level,type,property,tier,groupIndex,nextSkillIndex,totalTime,fireTime,cooldown,range,explosionRadius,explosionDamageRate,consumeMP,fireDamage,frostDamage,arcaneDamage,doDamageToMP,damageToMPRate,doDamageToSelf,damageToSelfRate,healHP,healHPRate,healMP,healMPRate,repeatLifeTime,repeatTime,buffToSelf,buffToTarget,projectileCount,radius,maxSpeed,lifeTime,tickTime,upgradeGoldAmount,upgradeJewelAmount,clientName,clientDesc,effectLastTime,skillIcon,hitEffectGroup,explosionEffectGroup,projectileEffectGroup,exchangeToGold,exchangeToJewel\n11,PyroBaseAttack1,1,1,1,1,10,12,600,400,150,80,45,0,0,125,0,0,0,0,0,0,0,0,0,0,0,0,,1,0,0,0,0,0,300,0,Pyro Attack,화염 기본 공격,300,1,6,,,200,\n12,PyroBaseAttack2,2,1,1,1,10,13,600,400,150,80,47,0,0,150,0,0,0,0,0,0,0,0,0,0,0,0,,1,0,0,0,0,0,600,0,Pyro Attack,화염 기본 공격,300,1,6,,,200,\n13,PyroBaseAttack3,3,1,1,1,10,14,600,400,150,80,49,0,0,175,0,0,0,0,0,0,0,0,0,0,0,0,,1,0,0,0,0,0,1200,1,Pyro Attack,화염 기본 공격,300,1,6,,,200,\n14,PyroBaseAttack4,4,1,1,1,10,15,600,400,150,80,51,0,0,200,0,0,0,0,0,0,0,0,0,0,0,0,,1,0,0,0,0,0,2100,3,Pyro Attack,화염 기본 공격,300,1,6,,,200,\n15,PyroBaseAttack5,5,1,1,1,10,-1,600,400,150,80,53,0,0,225,0,0,0,0,0,0,0,0,0,0,0,0,,1,0,0,0,0,0,0,0,Pyro Attack,화염 기본 공격,300,1,6,,,200,\n21,FireBolt1,1,3,1,1,20,22,500,300,2500,0,0,0,40,400,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,30,650,2000,0,300,0,Fire Bolt,파이어 볼트,0,2,6,,,200,\n22,FireBolt2,2,3,1,1,20,23,500,300,2500,0,0,0,50,450,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,30,650,2000,0,600,0,Fire Bolt,파이어 볼트,0,2,6,,,200,\n23,FireBolt3,3,3,1,1,20,24,500,300,2500,0,0,0,60,500,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,30,650,2000,0,1200,1,Fire Bolt,파이어 볼트,0,2,6,,,200,\n24,FireBolt4,4,3,1,1,20,25,500,300,2500,0,0,0,70,550,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,30,650,2000,0,2100,3,Fire Bolt,파이어 볼트,0,2,6,,,200,\n25,FireBolt5,5,3,1,1,20,-1,500,300,2500,0,0,0,80,600,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,30,650,2000,0,0,0,Fire Bolt,파이어 볼트,0,2,6,,,200,\n31,BurningSoul1,1,11,1,1,30,32,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,,0,0,0,0,0,300,0,Burning Soul,초당 체력 회복 + 4,0,3,,,,200,\n32,BurningSoul2,2,11,1,1,30,33,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,,0,0,0,0,0,600,0,Burning Soul,초당 체력 회복 + 6,0,3,,,,200,\n33,BurningSoul3,3,11,1,1,30,34,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,,0,0,0,0,0,1200,1,Burning Soul,초당 체력 회복 + 8,0,3,,,,200,\n34,BurningSoul4,4,11,1,1,30,35,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,,0,0,0,0,0,2100,3,Burning Soul,초당 체력 회복 + 10,0,3,,,,200,\n35,BurningSoul5,5,11,1,1,30,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,,0,0,0,0,0,0,0,Burning Soul,초당 체력 회복 + 12,0,3,,,,200,\n41,FireBall1,1,4,1,2,40,42,800,600,10000,0,110,0,100,400,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,35,550,2000,0,500,0,Fire Ball,충돌하면 폭발하는 구체를 발사,300,4,6,,,400,\n42,FireBall2,2,4,1,2,40,43,800,600,10000,0,115,0,120,450,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,35,550,2000,0,1000,0,Fire Ball,충돌하면 폭발하는 구체를 발사,300,4,6,,,400,\n43,FireBall3,3,4,1,2,40,44,800,600,10000,0,120,0,140,500,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,35,550,2000,0,2000,3,Fire Ball,충돌하면 폭발하는 구체를 발사,300,4,6,,,400,\n44,FireBall4,4,4,1,2,40,45,800,600,10000,0,125,0,160,550,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,35,550,2000,0,3500,5,Fire Ball,충돌하면 폭발하는 구체를 발사,300,4,6,,,400,\n45,FireBall5,5,4,1,2,40,-1,800,600,10000,0,130,0,180,600,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,35,550,2000,0,0,0,Fire Ball,충돌하면 폭발하는 구체를 발사,300,4,6,,,400,\n51,InnerFire1,1,8,1,2,50,52,500,300,30000,0,0,0,100,0,0,0,0,0,1,100,0,0,0,0,0,0,7,22,0,0,0,0,0,500,0,Inner Fire,자신을 ignite 상태로 만들며 공격력을 14% 증가 시킨다.,0,5,,,,400,\n52,InnerFire2,2,8,1,2,50,53,500,300,30000,0,0,0,120,0,0,0,0,0,1,100,0,0,0,0,0,0,8,22,0,0,0,0,0,1000,0,Inner Fire,자신을 ignite 상태로 만들며 공격력을 18% 증가 시킨다.,0,5,,,,400,\n53,InnerFire3,3,8,1,2,50,54,500,300,30000,0,0,0,140,0,0,0,0,0,1,100,0,0,0,0,0,0,9,22,0,0,0,0,0,2000,3,Inner Fire,자신을 ignite 상태로 만들며 공격력을 22% 증가 시킨다.,0,5,,,,400,\n54,InnerFire4,4,8,1,2,50,55,500,300,30000,0,0,0,160,0,0,0,0,0,1,100,0,0,0,0,0,0,10,22,0,0,0,0,0,3500,5,Inner Fire,자신을 ignite 상태로 만들며 공격력을 26% 증가 시킨다.,0,5,,,,400,\n55,InnerFire5,5,8,1,2,50,-1,500,300,30000,0,0,0,180,0,0,0,0,0,1,100,0,0,0,0,0,0,11,22,0,0,0,0,0,0,0,Inner Fire,자신을 ignite 상태로 만들며 공격력을 30% 증가 시킨다.,0,5,,,,400,\n61,RollingFire1,1,5,1,3,60,62,800,600,15000,0,0,0,130,82,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,51,280,3000,60,700,0,Rolling Fire,매 틱(0.1초)당 30의 데미지를 가하는 구체를 발사,0,6,6,,1007,,1\n62,RollingFire2,2,5,1,3,60,63,800,600,15000,0,0,0,160,94,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,52,280,3000,60,1400,2,Rolling Fire,매 틱(0.1초)당 32의 데미지를 가하는 구체를 발사,0,6,6,,1007,,1\n63,RollingFire3,3,5,1,3,60,64,800,600,15000,0,0,0,190,106,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,53,280,3000,60,2800,4,Rolling Fire,매 틱(0.1초)당 33의 데미지를 가하는 구체를 발사,0,6,6,,1007,,1\n64,RollingFire4,4,5,1,3,60,65,800,600,15000,0,0,0,220,118,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,54,280,3000,60,4900,7,Rolling Fire,매 틱(0.1초)당 34의 데미지를 가하는 구체를 발사,0,6,6,,1007,,1\n65,RollingFire5,5,5,1,3,60,-1,800,600,15000,0,0,0,250,130,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,55,280,3000,60,0,0,Rolling Fire,매 틱(0.1초)당 35의 데미지를 가하는 구체를 발사,0,6,6,,1007,,1\n71,Fury1,1,11,1,3,70,72,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,,0,0,0,0,0,700,0,Fury,이동 속도와 캐스팅 속도 7% 증가. 자신이 ignite 상태일 경우 추가로 7%증가,0,7,,,,,1\n72,Fury2,2,11,1,3,70,73,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,13,,0,0,0,0,0,1400,2,Fury,이동 속도와 캐스팅 속도 9% 증가. 자신이 ignite 상태일 경우 추가로 9%증가,0,7,,,,,1\n73,Fury3,3,11,1,3,70,74,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,,0,0,0,0,0,2800,4,Fury,이동 속도와 캐스팅 속도 11% 증가. 자신이 ignite 상태일 경우 추가로 11%증가,0,7,,,,,1\n74,Fury4,4,11,1,3,70,75,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15,,0,0,0,0,0,4900,7,Fury,이동 속도와 캐스팅 속도 13% 증가. 자신이 ignite 상태일 경우 추가로 13%증가,0,7,,,,,1\n75,Fury5,5,11,1,3,70,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,,0,0,0,0,0,0,0,Fury,이동 속도와 캐스팅 속도 15% 증가. 자신이 ignite 상태일 경우 추가로 15%증가,0,7,,,,,1\n81,Explosion1,1,9,1,4,80,82,1300,1100,20000,0,260,0,130,450,0,0,0,0,1,60,0,0,0,0,0,0,,22,0,0,0,0,0,900,0,Explosion,자신과 주변에 광역 데미지 100%확률로 ignite 시킴,300,8,6,,,,2\n82,Explosion2,2,9,1,4,80,83,1300,1100,20000,0,270,0,160,500,0,0,0,0,1,55,0,0,0,0,0,0,,22,0,0,0,0,0,1800,3,Explosion,자신과 주변에 광역 데미지 100%확률로 ignite 시킴,300,8,6,,,,2\n83,Explosion3,3,9,1,4,80,84,1300,1100,20000,0,280,0,190,550,0,0,0,0,1,50,0,0,0,0,0,0,,22,0,0,0,0,0,3600,6,Explosion,자신과 주변에 광역 데미지 100%확률로 ignite 시킴,300,8,6,,,,2\n84,Explosion4,4,9,1,4,80,85,1300,1100,20000,0,290,0,220,600,0,0,0,0,1,45,0,0,0,0,0,0,,22,0,0,0,0,0,6300,10,Explosion,자신과 주변에 광역 데미지 100%확률로 ignite 시킴,300,8,6,,,,2\n85,Explosion5,5,9,1,4,80,-1,1300,1100,20000,0,300,0,250,650,0,0,0,0,1,40,0,0,0,0,0,0,,22,0,0,0,0,0,0,0,Explosion,자신과 주변에 광역 데미지 100%확률로 ignite 시킴,300,8,6,,,,2\n91,Pyromaniac1,1,11,1,4,90,92,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,17,,0,0,0,0,0,900,0,Pyromaniac,◈ Power +5 &nbsp;  ◈ Fire Damage +10%,0,9,,,,,2\n92,Pyromaniac2,2,11,1,4,90,93,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,,0,0,0,0,0,1800,3,Pyromaniac,◈ Power +8 &nbsp;  ◈ Fire Damage +14%,0,9,,,,,2\n93,Pyromaniac3,3,11,1,4,90,94,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,19,,0,0,0,0,0,3600,6,Pyromaniac,◈ Power +10 &nbsp;  ◈ Fire Damage +17% &nbsp; ◈ 2% Damage Rate Per 10% Life,0,9,,,,,2\n94,Pyromaniac4,4,11,1,4,90,95,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,20,,0,0,0,0,0,6300,10,Pyromaniac,◈ Power +13 &nbsp;  ◈ Fire Damage +21% &nbsp; ◈ 3% Damage Rate Per 10% Life,0,9,,,,,2\n95,Pyromaniac5,5,11,1,4,90,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,21,,0,0,0,0,0,0,0,Pyromaniac,◈ Power +15 &nbsp;  ◈ Fire Damage +25% &nbsp; ◈ Cast Speed +15% &nbsp; ◈ +4% Damage Rate Per 10% Life,0,9,,,,,2\n1001,FrosterBaseAttack1,1,1,2,1,1000,1002,600,400,150,80,45,0,0,0,100,0,0,0,0,0,0,0,0,0,0,0,,101,0,0,0,0,0,300,0,Froster Attack,냉기 기본 공격,300,101,7,,,200,\n1002,FrosterBaseAttack2,2,1,2,1,1000,1003,600,400,150,80,47,0,0,0,125,0,0,0,0,0,0,0,0,0,0,0,,101,0,0,0,0,0,600,0,Froster Attack,냉기 기본 공격,300,101,7,,,200,\n1003,FrosterBaseAttack3,3,1,2,1,1000,1004,600,400,150,80,49,0,0,0,150,0,0,0,0,0,0,0,0,0,0,0,,101,0,0,0,0,0,1200,1,Froster Attack,냉기 기본 공격,300,101,7,,,200,\n1004,FrosterBaseAttack4,4,1,2,1,1000,1005,600,400,150,80,51,0,0,0,175,0,0,0,0,0,0,0,0,0,0,0,,101,0,0,0,0,0,2100,3,Froster Attack,냉기 기본 공격,300,101,7,,,200,\n1005,FrosterBaseAttack5,5,1,2,1,1000,-1,600,400,150,80,53,0,0,0,200,0,0,0,0,0,0,0,0,0,0,0,,101,0,0,0,0,0,0,0,Froster Attack,냉기 기본 공격,300,101,7,,,200,\n1011,IceBolt1,1,3,2,1,1010,1012,500,300,2500,0,0,0,50,0,350,0,0,0,0,0,0,0,0,0,0,0,,101,1,30,650,2000,0,300,0,Ice Bolt,아이스 볼트,300,102,7,,,200,\n1012,IceBolt2,2,3,2,1,1010,1013,500,300,2500,0,0,0,60,0,400,0,0,0,0,0,0,0,0,0,0,0,,101,1,30,650,2000,0,600,0,Ice Bolt,아이스 볼트,300,102,7,,,200,\n1013,IceBolt3,3,3,2,1,1010,1014,500,300,2500,0,0,0,70,0,450,0,0,0,0,0,0,0,0,0,0,0,,101,1,30,650,2000,0,1200,1,Ice Bolt,아이스 볼트,300,102,7,,,200,\n1014,IceBolt4,4,3,2,1,1010,1015,500,300,2500,0,0,0,80,0,500,0,0,0,0,0,0,0,0,0,0,0,,101,1,30,650,2000,0,2100,3,Ice Bolt,아이스 볼트,300,102,7,,,200,\n1015,IceBolt5,5,3,2,1,1010,-1,500,300,2500,0,0,0,90,0,550,0,0,0,0,0,0,0,0,0,0,0,,101,1,30,650,2000,0,0,0,Ice Bolt,아이스 볼트,300,102,7,,,200,\n1021,Healing1,1,8,2,1,1020,1022,500,300,9000,0,0,0,80,0,0,0,0,0,0,0,250,0,0,0,0,0,2000,,0,0,0,0,0,300,0,Healing,Heal 270,300,103,,,,200,\n1022,Healing2,2,8,2,1,1020,1023,500,300,9000,0,0,0,95,0,0,0,0,0,0,0,325,0,0,0,0,0,2000,,0,0,0,0,0,600,0,Healing,Heal 324,300,103,,,,200,\n1023,Healing3,3,8,2,1,1020,1024,500,300,9000,0,0,0,110,0,0,0,0,0,0,0,400,0,0,0,0,0,2000,,0,0,0,0,0,1200,1,Healing,Heal 389,300,103,,,,200,\n1024,Healing4,4,8,2,1,1020,1025,500,300,9000,0,0,0,125,0,0,0,0,0,0,0,475,0,0,0,0,0,2000,,0,0,0,0,0,2100,3,Healing,Heal 467,300,103,,,,200,\n1025,Healing5,5,8,2,1,1020,-1,500,300,9000,0,0,0,140,0,0,0,0,0,0,0,550,0,0,0,0,0,2000,,0,0,0,0,0,0,0,Healing,Heal 560,300,103,,,,200,\n1031,FrozenSoul1,1,11,2,1,1030,1032,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,102,,0,0,0,0,0,300,0,Frozen Soul,초당 마나 회복 2,300,104,,,,200,\n1032,FrozenSoul2,2,11,2,1,1030,1033,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,103,,0,0,0,0,0,600,0,Frozen Soul,초당 마나 회복 3,300,104,,,,200,\n1033,FrozenSoul3,3,11,2,1,1030,1034,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,104,,0,0,0,0,0,1200,1,Frozen Soul,초당 마나 회복 4,300,104,,,,200,\n1034,FrozenSoul4,4,11,2,1,1030,1035,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,105,,0,0,0,0,0,2100,3,Frozen Soul,초당 마나 회복 5,300,104,,,,200,\n1035,FrozenSoul5,5,11,2,1,1030,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,106,,0,0,0,0,0,0,0,Frozen Soul,초당 마나 회복 6,300,104,,,,200,\n1041,Purify1,1,8,2,2,1040,1042,500,300,9000,0,0,0,80,0,0,0,0,0,0,0,100,0,0,0,0,0,107,,0,0,0,0,0,500,0,Purify,자신에게 걸린 해로운 효과를 제거하고 체력을 20 회복,300,105,,,,400,\n1042,Purify2,2,8,2,2,1040,1043,500,300,8000,0,0,0,95,0,0,0,0,0,0,0,125,0,0,0,0,0,107,,0,0,0,0,0,1000,0,Purify,자신에게 걸린 해로운 효과를 제거하고 체력을 30 회복,300,105,,,,400,\n1043,Purify3,3,8,2,2,1040,1044,500,300,7000,0,0,0,110,0,0,0,0,0,0,0,150,0,0,0,0,0,107,,0,0,0,0,0,2000,3,Purify,자신에게 걸린 해로운 효과를 제거하고 체력을 40 회복,300,105,,,,400,\n1044,Purify4,4,8,2,2,1040,1045,500,300,6000,0,0,0,125,0,0,0,0,0,0,0,175,0,0,0,0,0,107,,0,0,0,0,0,3500,5,Purify,자신에게 걸린 해로운 효과를 제거하고 체력을 50 회복,300,105,,,,400,\n1045,Purify5,5,8,2,2,1040,-1,500,300,5000,0,0,0,140,0,0,0,0,0,0,0,200,0,0,0,0,0,107,,0,0,0,0,0,0,0,Purify,자신에게 걸린 해로운 효과를 제거하고 체력을 60 회복,300,105,,,,400,\n1051,IceBlock1,1,8,2,2,1050,1052,500,300,9000,0,0,0,80,0,0,0,0,0,1,100,0,0,0,0,0,0,108,122,0,0,0,0,0,500,0,Ice Block,화염 저항력 34% 증가 냉기 저항 17% 증가. 자신을 chill 상태로 만듬,300,106,,,,400,\n1052,IceBlock2,2,8,2,2,1050,1053,500,300,9000,0,0,0,95,0,0,0,0,0,1,100,0,0,0,0,0,0,109,122,0,0,0,0,0,1000,0,Ice Block,화염 저항력 38% 증가 냉기 저항 19% 증가. 자신을 chill 상태로 만듬,300,106,,,,400,\n1053,IceBlock3,3,8,2,2,1050,1054,500,300,9000,0,0,0,110,0,0,0,0,0,1,100,0,0,0,0,0,0,110,122,0,0,0,0,0,2000,3,Ice Block,화염 저항력 42% 증가 냉기 저항 21% 증가. 자신을 chill 상태로 만듬,300,106,,,,400,\n1054,IceBlock4,4,8,2,2,1050,1055,500,300,9000,0,0,0,125,0,0,0,0,0,1,100,0,0,0,0,0,0,111,122,0,0,0,0,0,3500,5,Ice Block,화염 저항력 46% 증가 냉기 저항 23% 증가. 자신을 chill 상태로 만듬,300,106,,,,400,\n1055,IceBlock5,5,8,2,2,1050,-1,500,300,9000,0,0,0,140,0,0,0,0,0,1,100,0,0,0,0,0,0,112,122,0,0,0,0,0,0,0,Ice Block,화염 저항력 50% 증가 냉기 저항 25% 증가. 자신을 chill 상태로 만듬,300,106,,,,400,\n1061,ColdSnap1,1,7,2,3,1060,1062,800,600,15000,370,120,0,140,0,250,0,0,0,0,0,0,0,0,0,0,0,,121,0,0,0,0,0,700,0,Cold Snap,소용돌이,300,107,7,,,,1\n1062,ColdSnap2,2,7,2,3,1060,1063,800,600,15000,390,125,0,160,0,300,0,0,0,0,0,0,0,0,0,0,0,,121,0,0,0,0,0,1400,2,Cold Snap,소용돌이,300,107,7,,,,1\n1063,ColdSnap3,3,7,2,3,1060,1064,800,600,15000,410,130,0,180,0,350,0,0,0,0,0,0,0,0,0,0,0,,121,0,0,0,0,0,2800,4,Cold Snap,소용돌이,300,107,7,,,,1\n1064,ColdSnap4,4,7,2,3,1060,1065,800,600,15000,430,135,0,200,0,400,0,0,0,0,0,0,0,0,0,0,0,,121,0,0,0,0,0,4900,7,Cold Snap,소용돌이,300,107,7,,,,1\n1065,ColdSnap5,5,7,2,3,1060,-1,800,600,15000,450,140,0,220,0,450,0,0,0,0,0,0,0,0,0,0,0,,121,0,0,0,0,0,0,0,Cold Snap,소용돌이,300,107,7,,,,1\n1071,FrozenOrb1,1,6,2,4,1070,1072,800,600,20000,0,110,800,160,0,72,0,0,0,0,0,0,0,0,0,0,0,,101,1,51,280,2500,60,900,0,Frozen Orb,매 틱(0.1초)당 30의 데미지를 가하는 구체를 발사. 구체는 폭발하여 주위에 틱 데미지의 10배를 가함.,300,108,7,1008,1008,,2\n1072,FrozenOrb2,2,6,2,4,1070,1073,800,600,20000,0,115,800,180,0,84,0,0,0,0,0,0,0,0,0,0,0,,101,1,52,280,2500,60,1800,3,Frozen Orb,매 틱(0.1초)당 32의 데미지를 가하는 구체를 발사. 구체는 폭발하여 주위에 틱 데미지의 10배를 가함.,300,108,7,1008,1008,,2\n1073,FrozenOrb3,3,6,2,4,1070,1074,800,600,20000,0,120,800,200,0,96,0,0,0,0,0,0,0,0,0,0,0,,101,1,53,280,2500,60,3600,6,Frozen Orb,매 틱(0.1초)당 33의 데미지를 가하는 구체를 발사. 구체는 폭발하여 주위에 틱 데미지의 10배를 가함.,300,108,7,1008,1008,,2\n1074,FrozenOrb4,4,6,2,4,1070,1075,800,600,20000,0,125,800,220,0,108,0,0,0,0,0,0,0,0,0,0,0,,101,1,54,280,2500,60,6300,10,Frozen Orb,매 틱(0.1초)당 34의 데미지를 가하는 구체를 발사. 구체는 폭발하여 주위에 틱 데미지의 10배를 가함.,300,108,7,1008,1008,,2\n1075,FrozenOrb5,5,6,2,4,1070,-1,800,600,20000,0,130,800,240,0,120,0,0,0,0,0,0,0,0,0,0,0,,101,1,55,280,2500,60,0,0,Frozen Orb,매 틱(0.1초)당 35의 데미지를 가하는 구체를 발사. 구체는 폭발하여 주위에 틱 데미지의 10배를 가함.,300,108,7,1008,1008,,2\n1081,Freezer1,1,11,2,4,1080,1082,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,113,,0,0,0,0,0,900,0,Freezer,◈ Magic +5 &nbsp;  ◈ Frost Damage +10%,0,109,,,,,2\n1082,Freezer2,2,11,2,4,1080,1083,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,114,,0,0,0,0,0,1800,3,Freezer,◈ Magic +8 &nbsp;  ◈ Frost Damage +14%,0,109,,,,,2\n1083,Freezer3,3,11,2,4,1080,1084,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,115,,0,0,0,0,0,3600,6,Freezer,◈ Magic +10 &nbsp;  ◈ Frost Damage +17% &nbsp; ◈ Can Make Freezing,0,109,,,,,2\n1084,Freezer4,4,11,2,4,1080,1085,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,116,,0,0,0,0,0,6300,10,Freezer,◈ Magic +13 &nbsp;  ◈ Frost Damage +21% &nbsp; ◈ Can Make Freezing,0,109,,,,,2\n1085,Freezer5,5,11,2,4,1080,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,117,,0,0,0,0,0,0,0,Freezer,◈ Magic +15 &nbsp;  ◈ Frost Damage +25% &nbsp; ◈ Move Speed +15% &nbsp; ◈ Can Make Freezing,0,109,,,,,2\n2001,MysterBaseAttack1,1,1,3,1,2000,2002,600,400,150,80,45,0,0,0,0,125,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,300,0,Myster Attack,아케인 기본 공격. 적의 마나에도 데미지를 가한다,300,201,8,,,200,\n2002,MysterBaseAttack2,2,1,3,1,2000,2003,600,400,150,80,47,0,0,0,0,150,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,600,0,Myster Attack,아케인 기본 공격. 적의 마나에도 데미지를 가한다,300,201,8,,,200,\n2003,MysterBaseAttack3,3,1,3,1,2000,2004,600,400,150,80,49,0,0,0,0,175,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,1200,1,Myster Attack,아케인 기본 공격. 적의 마나에도 데미지를 가한다,300,201,8,,,200,\n2004,MysterBaseAttack4,4,1,3,1,2000,2005,600,400,150,80,51,0,0,0,0,200,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,2100,3,Myster Attack,아케인 기본 공격. 적의 마나에도 데미지를 가한다,300,201,8,,,200,\n2005,MysterBaseAttack5,5,1,3,1,2000,-1,600,400,150,80,53,0,0,0,0,225,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,0,0,Myster Attack,아케인 기본 공격. 적의 마나에 30% 데미지,300,201,8,,,200,\n2011,ArcaneBolt1,1,3,3,1,2010,2012,500,300,2500,0,0,0,40,0,0,400,1,30,0,0,0,0,0,0,0,0,,,1,30,650,2000,0,300,0,Arcane Bolt,아케인 볼트. 적의 마나에 30%데미지,300,202,8,,,200,\n2012,ArcaneBolt2,2,3,3,1,2010,2013,500,300,2500,0,0,0,50,0,0,450,1,30,0,0,0,0,0,0,0,0,,,1,30,650,2000,0,600,0,Arcane Bolt,아케인 볼트. 적의 마나에 30%데미지,300,202,8,,,200,\n2013,ArcaneBolt3,3,3,3,1,2010,2014,500,300,2500,0,0,0,60,0,0,500,1,30,0,0,0,0,0,0,0,0,,,1,30,650,2000,0,1200,1,Arcane Bolt,아케인 볼트. 적의 마나에 30%데미지,300,202,8,,,200,\n2014,ArcaneBolt4,4,3,3,1,2010,2015,500,300,2500,0,0,0,70,0,0,550,1,30,0,0,0,0,0,0,0,0,,,1,30,650,2000,0,2100,3,Arcane Bolt,아케인 볼트. 적의 마나에 30%데미지,300,202,8,,,200,\n2015,ArcaneBolt5,5,3,3,1,2010,-1,500,300,2500,0,0,0,80,0,0,600,1,30,0,0,0,0,0,0,0,0,,,1,30,650,2000,0,0,0,Arcane Bolt,아케인 볼트. 적의 마나에 30%데미지,300,202,8,,,200,\n2021,ArcaneCloak1,1,11,3,1,2020,2022,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,201,,0,0,0,0,0,300,0,Arcane Cloak,All resistance 7%,0,203,,,,200,\n2022,ArcaneCloak2,2,11,3,1,2020,2023,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,202,,0,0,0,0,0,600,0,Arcane Cloak,All resistance 9%,0,203,,,,200,\n2023,ArcaneCloak3,3,11,3,1,2020,2024,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,203,,0,0,0,0,0,1200,1,Arcane Cloak,All resistance 11%,0,203,,,,200,\n2024,ArcaneCloak4,4,11,3,1,2020,2025,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,204,,0,0,0,0,0,2100,3,Arcane Cloak,All resistance 13%,0,203,,,,200,\n2025,ArcaneCloak5,5,11,3,1,2020,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,205,,0,0,0,0,0,0,0,Arcane Cloak,All resistance 15%,0,203,,,,200,\n2031,ArcaneMissile1,1,3,3,2,2030,2032,500,300,9000,0,0,0,100,0,0,200,1,30,0,0,0,0,0,0,0,0,,,1,35,500,2000,0,500,0,Arcane Missile,아케인 볼트를 3방향으로 발사. 적의 마나에 30%데미지,300,204,8,,,400,\n2032,ArcaneMissile2,2,3,3,2,2030,2033,500,300,9000,0,0,0,120,0,0,220,1,30,0,0,0,0,0,0,0,0,,,2,35,500,2000,0,1000,0,Arcane Missile,아케인 볼트를 3방향으로 발사. 적의 마나에 30%데미지,300,204,8,,,400,\n2033,ArcaneMissile3,3,3,3,2,2030,2034,500,300,9000,0,0,0,140,0,0,240,1,30,0,0,0,0,0,0,0,0,,,3,35,500,2000,0,2000,3,Arcane Missile,아케인 볼트를 3방향으로 발사. 적의 마나에 30%데미지,300,204,8,,,400,\n2034,ArcaneMissile4,4,3,3,2,2030,2035,500,300,9000,0,0,0,160,0,0,260,1,30,0,0,0,0,0,0,0,0,,,4,35,500,2000,0,3500,5,Arcane Missile,아케인 볼트를 3방향으로 발사. 적의 마나에 30%데미지,300,204,8,,,400,\n2035,ArcaneMissile5,5,3,3,2,2030,-1,500,300,9000,0,0,0,180,0,0,280,1,30,0,0,0,0,0,0,0,0,,,5,35,500,2000,0,0,0,Arcane Missile,아케인 볼트를 3방향으로 발사. 적의 마나에 30%데미지,300,204,8,,,400,\n2041,Silence1,1,7,3,2,2040,2042,500,300,10000,320,110,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,,206,0,0,0,0,0,500,0,Silence,적을 침묵 시킨다.,300,205,,1009,,400,\n2042,Silence2,2,7,3,2,2040,2043,500,300,10000,340,115,0,90,0,0,0,0,0,0,0,0,0,0,0,0,0,,206,0,0,0,0,0,1000,0,Silence,적을 침묵 시킨다.,300,205,,1009,,400,\n2043,Silence3,3,7,3,2,2040,2044,500,300,10000,360,120,0,80,0,0,0,0,0,0,0,0,0,0,0,0,0,,206,0,0,0,0,0,2000,3,Silence,적을 침묵 시킨다.,300,205,,1009,,400,\n2044,Silence4,4,7,3,2,2040,2045,500,300,10000,380,125,0,70,0,0,0,0,0,0,0,0,0,0,0,0,0,,206,0,0,0,0,0,3500,5,Silence,적을 침묵 시킨다.,300,205,,1009,,400,\n2045,Silence5,5,7,3,2,2040,-1,500,300,10000,400,130,0,60,0,0,0,0,0,0,0,0,0,0,0,0,0,,206,0,0,0,0,0,0,0,Silence,적을 침묵 시킨다.,300,205,,1009,,400,\n2051,Dispel1,1,7,3,2,2050,2052,500,300,8000,320,110,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,,207,0,0,0,0,0,500,0,Dispel,적의 버프를 제거한다.,300,206,,1009,,400,\n2052,Dispel2,2,7,3,2,2050,2053,500,300,8000,340,115,0,90,0,0,0,0,0,0,0,0,0,0,0,0,0,,207,0,0,0,0,0,1000,0,Dispel,적의 버프를 제거한다.,300,206,,1009,,400,\n2053,Dispel3,3,7,3,2,2050,2054,500,300,8000,360,120,0,80,0,0,0,0,0,0,0,0,0,0,0,0,0,,207,0,0,0,0,0,2000,3,Dispel,적의 버프를 제거한다.,300,206,,1009,,400,\n2054,Dispel4,4,7,3,2,2050,2055,500,300,8000,380,125,0,70,0,0,0,0,0,0,0,0,0,0,0,0,0,,207,0,0,0,0,0,3500,5,Dispel,적의 버프를 제거한다.,300,206,,1009,,400,\n2055,Dispel5,5,7,3,2,2050,-1,500,300,8000,400,130,0,60,0,0,0,0,0,0,0,0,0,0,0,0,0,,207,0,0,0,0,0,0,0,Dispel,적의 버프를 제거한다.,300,206,,1009,,400,\n2061,Blink1,1,10,3,3,2060,2062,500,300,8000,320,40,0,50,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,700,0,Blink,지정 위치로 이동,300,207,,,,,1\n2062,Blink2,2,10,3,3,2060,2063,500,300,7500,340,40,0,60,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,1400,2,Blink,지정 위치로 이동,300,207,,,,,1\n2063,Blink3,3,10,3,3,2060,2064,500,300,7000,360,40,0,70,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,2800,4,Blink,지정 위치로 이동,300,207,,,,,1\n2064,Blink4,4,10,3,3,2060,2065,500,300,6500,380,40,0,80,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,4900,7,Blink,지정 위치로 이동,300,207,,,,,1\n2065,Blink5,5,10,3,3,2060,-1,500,300,6000,400,40,0,90,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,0,0,Blink,지정 위치로 이동,300,207,,,,,1\n2071,ArcaneBlast1,1,7,3,3,2070,2072,800,600,15000,370,120,0,100,0,0,400,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,700,0,Arcane Blast,범위 공격. 적의 마나에 30%데미지,300,208,8,,,,1\n2072,ArcaneBlast2,2,7,3,3,2070,2073,800,600,15000,390,125,0,125,0,0,450,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,1400,2,Arcane Blast,범위 공격. 적의 마나에 30%데미지,300,208,8,,,,1\n2073,ArcaneBlast3,3,7,3,3,2070,2074,800,600,15000,410,130,0,150,0,0,500,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,2800,4,Arcane Blast,범위 공격. 적의 마나에 30%데미지,300,208,8,,,,1\n2074,ArcaneBlast4,4,7,3,3,2070,2075,800,600,15000,430,135,0,175,0,0,550,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,4900,7,Arcane Blast,범위 공격. 적의 마나에 30%데미지,300,208,8,,,,1\n2075,ArcaneBlast5,5,7,3,3,2070,-1,800,600,15000,450,140,0,200,0,0,600,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,0,0,Arcane Blast,범위 공격. 적의 마나에 30%데미지,300,208,8,,,,1\n2081,Haste1,1,8,3,3,2080,2082,500,300,30000,0,0,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,208,,0,0,0,0,0,700,0,Haste,이동속도 12% 캐스팅 속도 14% 증가.,300,209,,,,,1\n2082,Haste2,2,8,3,3,2080,2083,500,300,30000,0,0,0,125,0,0,0,0,0,0,0,0,0,0,0,0,0,209,,0,0,0,0,0,1400,2,Haste,이동속도 14% 캐스팅 속도 18% 증가.,300,209,,,,,1\n2083,Haste3,3,8,3,3,2080,2084,500,300,30000,0,0,0,150,0,0,0,0,0,0,0,0,0,0,0,0,0,210,,0,0,0,0,0,2800,4,Haste,이동속도 16% 캐스팅 속도 22% 증가.,300,209,,,,,1\n2084,Haste4,4,8,3,3,2080,2085,500,300,30000,0,0,0,175,0,0,0,0,0,0,0,0,0,0,0,0,0,211,,0,0,0,0,0,4900,7,Haste,이동속도 18% 캐스팅 속도 26% 증가.,300,209,,,,,1\n2085,Haste5,5,8,3,3,2080,-1,500,300,30000,0,0,0,200,0,0,0,0,0,0,0,0,0,0,0,0,0,212,,0,0,0,0,0,0,0,Haste,이동속도 20% 캐스팅 속도 30% 증가.,300,209,,,,,1\n2091,Mystic1,1,11,3,4,2090,2092,0,0,8000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,213,,0,0,0,0,0,900,0,Mystic,◈ All Stat +2 &nbsp;  ◈ All Damage +10%,0,210,,,,,2\n2092,Mystic2,2,11,3,4,2090,2093,0,0,8000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,214,,0,0,0,0,0,1800,3,Mystic,◈ All Stat +4 &nbsp;  ◈ All Damage +13%,0,210,,,,,2\n2093,Mystic3,3,11,3,4,2090,2094,0,0,8000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,215,,0,0,0,0,0,3600,6,Mystic,◈ All Stat +5 &nbsp;  ◈ All Damage +15% &nbsp; ◈ Add Random Buff When Use Arcane Spell ,0,210,,,,,2\n2094,Mystic4,4,11,3,4,2090,2095,0,0,8000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,216,,0,0,0,0,0,6300,10,Mystic,◈ All Stat +7 &nbsp;  ◈ All Damage +18% &nbsp; ◈ Add Random Buff When Use Arcane Spell,0,210,,,,,2\n2095,Mystic5,5,11,3,4,2090,-1,0,0,8000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,217,,0,0,0,0,0,0,0,Mystic,◈ All Stat +8 &nbsp;  ◈ All Damage +20% &nbsp; ◈ Cooldown Reduce +15% &nbsp; ◈ Add Random Buff When Use Arcane Spell,0,210,,,,,2\n",
  "buffGroupData" : "index,name,clientName,clientDesc,isBuff,buff1,buff2,buff3,buff4,buff5,buff6,buff7,buff8,buff9,buff10,buffLifeTime,buffApplyRate,buffIcon,buffEffectGroup\n1,Ignite,Ignite,매 초당 최대 체력의 4%의 피해를 받음.,0,1,,,,,,,,,,10000,30,513,5\n2,BurningSoul1,BurningSoul,초당 체력 회복 + 4,1,3,,,,,,,,,,0,100,501,1010\n3,BurningSoul2,BurningSoul,초당 체력 회복 + 6,1,4,,,,,,,,,,0,100,501,1010\n4,BurningSoul3,BurningSoul,초당 체력 회복 + 8,1,5,,,,,,,,,,0,100,501,1010\n5,BurningSoul4,BurningSoul,초당 체력 회복 + 10,1,6,,,,,,,,,,0,100,501,1010\n6,BurningSoul5,BurningSoul,초당 체력 회복 + 12,1,7,,,,,,,,,,0,100,501,1010\n7,InnerFire1,InnerFire,공격력을 14% 증가,1,69,,,,,,,,,,10000,100,502,1001\n8,InnerFire2,InnerFire,공격력을 18% 증가,1,71,,,,,,,,,,10000,100,502,1001\n9,InnerFire3,InnerFire,공격력을 22% 증가,1,73,,,,,,,,,,10000,100,502,1001\n10,InnerFire4,InnerFire,공격력을 26% 증가,1,74,,,,,,,,,,10000,100,502,1001\n11,InnerFire5,InnerFire,공격력을 30% 증가,1,75,,,,,,,,,,10000,100,502,1001\n12,Fury1,Fury,이동 속도와 캐스팅 속도 7% 증가. 자신이 ignite 상태일 경우 추가로 7%증가,1,13,24,36,41,,,,,,,0,100,503,1002\n13,Fury2,Fury,이동 속도와 캐스팅 속도 9% 증가. 자신이 ignite 상태일 경우 추가로 9%증가,1,14,25,37,42,,,,,,,0,100,503,1002\n14,Fury3,Fury,이동 속도와 캐스팅 속도 11% 증가. 자신이 ignite 상태일 경우 추가로 11%증가,1,16,27,38,43,,,,,,,0,100,503,1002\n15,Fury4,Fury,이동 속도와 캐스팅 속도 13% 증가. 자신이 ignite 상태일 경우 추가로 13%증가,1,18,28,39,44,,,,,,,0,100,503,1002\n16,Fury5,Fury,이동 속도와 캐스팅 속도 15% 증가. 자신이 ignite 상태일 경우 추가로 15%증가,1,20,30,40,45,,,,,,,0,100,503,1002\n17,Pyromaniac1,Pyromaniac,◈ Power +5 &nbsp;  ◈ Fire Damage +10%,1,48,76,,,,,,,,,0,100,504,101\n18,Pyromaniac2,Pyromaniac,◈ Power +8 &nbsp;  ◈ Fire Damage +14%,1,50,77,,,,,,,,,0,100,504,101\n19,Pyromaniac3,Pyromaniac,◈ Power +10 &nbsp;  ◈ Fire Damage +17% &nbsp; ◈ 2% Damage Rate Per 10% Life,1,51,78,86,,,,,,,,0,100,504,101\n20,Pyromaniac4,Pyromaniac,◈ Power +13 &nbsp;  ◈ Fire Damage +21% &nbsp; ◈ 3% Damage Rate Per 10% Life,1,52,79,87,,,,,,,,0,100,504,101\n21,Pyromaniac5,Pyromaniac,◈ Power +15 &nbsp;  ◈ Fire Damage +25% &nbsp; ◈ Cast Speed +15% &nbsp; ◈ +4% Damage Rate Per 10% Life,1,53,80,88,30,,,,,,,0,100,504,101\n22,Ignite100,Ignite,매 초당 최대 체력의 4%의 피해를 받음.,0,1,,,,,,,,,,10000,100,513,5\n101,Chill,Chill,이동 속도와 캐스팅 속도가 30% 감소.,0,2,,,,,,,,,,5000,30,514,2\n102,FrozenSoul1,FrozenSoul,초당 마나 회복 2,1,8,,,,,,,,,,0,100,505,1011\n103,FrozenSoul2,FrozenSoul,초당 마나 회복 3,1,9,,,,,,,,,,0,100,505,1011\n104,FrozenSoul3,FrozenSoul,초당 마나 회복 4,1,10,,,,,,,,,,0,100,505,1011\n105,FrozenSoul4,FrozenSoul,초당 마나 회복 5,1,11,,,,,,,,,,0,100,505,1011\n106,FrozenSoul5,FrozenSoul,초당 마나 회복 6,1,12,,,,,,,,,,0,100,505,1011\n107,Purify,Purify,자신에게 걸린 해로운 효과를 제거,1,95,,,,,,,,,,500,100,506,1012\n108,IceBlock1,IceBlock,화염 저항력 34% 증가 냉기 저항 17% 증가.,1,103,108,,,,,,,,,3000,100,507,1004\n109,IceBlock2,IceBlock,화염 저항력 38% 증가 냉기 저항 19% 증가.,1,104,109,,,,,,,,,3000,100,507,1004\n110,IceBlock3,IceBlock,화염 저항력 42% 증가 냉기 저항 21% 증가.,1,105,110,,,,,,,,,3000,100,507,1004\n111,IceBlock4,IceBlock,화염 저항력 46% 증가 냉기 저항 23% 증가.,1,106,111,,,,,,,,,3000,100,507,1004\n112,IceBlock5,IceBlock,화염 저항력 50% 증가 냉기 저항 25% 증가.,1,107,112,,,,,,,,,3000,100,507,1004\n113,Freezer1,Freezer,◈ Magic +5 &nbsp;  ◈ Frost Damage +10%,1,56,81,,,,,,,,,0,100,508,102\n114,Freezer2,Freezer,◈ Magic +8 &nbsp;  ◈ Frost Damage +14%,1,58,82,,,,,,,,,0,100,508,102\n115,Freezer3,Freezer,◈ Magic +10 &nbsp;  ◈ Frost Damage +17% &nbsp; ◈ Can Make Freezing,1,59,83,89,,,,,,,,0,100,508,102\n116,Freezer4,Freezer,◈ Magic +13 &nbsp;  ◈ Frost Damage +21% &nbsp; ◈ Can Make Freezing,1,60,84,90,,,,,,,,0,100,508,102\n117,Freezer5,Freezer,◈ Magic +15 &nbsp;  ◈ Frost Damage +25% &nbsp; ◈ Move Speed +15% &nbsp; ◈ Can Make Freezing,1,61,85,91,20,,,,,,,0,100,508,102\n118,Freeze1,Freeze,얼었다,0,92,,,,,,,,,,1000,20,515,3\n119,Freeze2,Freeze,얼었다,0,93,,,,,,,,,,1000,25,515,3\n120,Freeze3,Freeze,얼었다,0,94,,,,,,,,,,1000,30,515,3\n121,Chill100,Chill,이동 속도와 캐스팅 속도가 30% 감소.,0,2,,,,,,,,,,5000,100,514,2\n122,IceBolockChill,Chill,이동 속도와 캐스팅 속도가 30% 감소.,0,2,,,,,,,,,,3000,100,514,2\n201,ArcaneCloak1,ArcaneCloak,All resistance 7%,1,98,,,,,,,,,,0,100,509,1005\n202,ArcaneCloak2,ArcaneCloak,All resistance 9%,1,99,,,,,,,,,,0,100,509,1005\n203,ArcaneCloak3,ArcaneCloak,All resistance 11%,1,100,,,,,,,,,,0,100,509,1005\n204,ArcaneCloak4,ArcaneCloak,All resistance 13%,1,101,,,,,,,,,,0,100,509,1005\n205,ArcaneCloak5,ArcaneCloak,All resistance 15%,1,102,,,,,,,,,,0,100,509,1005\n206,Silence,Silence,적을 침묵 시킨다.,0,113,,,,,,,,,,5000,100,516,4\n207,Dispel,Dispel,적의 버프를 제거한다.,0,96,,,,,,,,,,500,100,517,1013\n208,Haste1,Haste,이동속도 12% 캐스팅 속도 14% 증가.,1,17,29,,,,,,,,,20000,100,510,1006\n209,Haste2,Haste,이동속도 14% 캐스팅 속도 18% 증가.,1,19,31,,,,,,,,,20000,100,510,1006\n210,Haste3,Haste,이동속도 16% 캐스팅 속도 22% 증가.,1,21,33,,,,,,,,,20000,100,510,1006\n211,Haste4,Haste,이동속도 18% 캐스팅 속도 26% 증가.,1,22,34,,,,,,,,,20000,100,510,1006\n212,Haste5,Haste,이동속도 20% 캐스팅 속도 30% 증가.,1,23,35,,,,,,,,,20000,100,510,1006\n213,Mystic1,Mystic,◈ All Stat +2 &nbsp;  ◈ All Damage +10%,1,46,54,62,67,,,,,,,0,100,511,103\n214,Mystic2,Mystic,◈ All Stat +4 &nbsp;  ◈ All Damage +13%,1,47,55,63,68,,,,,,,0,100,511,103\n215,Mystic3,Mystic,◈ All Stat +5 &nbsp;  ◈ All Damage +15% &nbsp; ◈ Add Random Buff When Use Arcane Spell ,1,48,56,64,70,114,,,,,,0,100,511,103\n216,Mystic4,Mystic,◈ All Stat +7 &nbsp;  ◈ All Damage +18% &nbsp; ◈ Add Random Buff When Use Arcane Spell,1,49,57,65,71,115,,,,,,0,100,511,103\n217,Mystic5,Mystic,◈ All Stat +8 &nbsp;  ◈ All Damage +20% &nbsp; ◈ Cooldown Reduce +15% &nbsp; ◈ Add Random Buff When Use Arcane Spell,1,50,58,66,72,116,97,,,,,0,100,511,103\n218,RandomBuff1-1,MysticBuff1,매초 HP + 50,1,117,,,,,,,,,,7000,100,511,1014\n219,RandomBuff1-2,MysticBuff1,매초 MP + 30,1,118,,,,,,,,,,7000,100,511,1015\n220,RandomBuff1-3,MysticBuff1,공격력 20% 증가,1,119,,,,,,,,,,7000,100,511,1016\n221,RandomBuff1-4,MysticBuff1,저항력 10% 증가,1,120,,,,,,,,,,7000,100,511,1017\n222,RandomBuff1-5,MysticBuff1,이동 속도 10% 캐스팅 속도 10% 증가.,1,15,26,,,,,,,,,7000,100,511,1018\n223,RandomBuff2-1,MysticBuff2,매초 HP + 75,1,121,,,,,,,,,,8500,100,511,1014\n224,RandomBuff2-2,MysticBuff2,매초 MP + 40,1,122,,,,,,,,,,8500,100,511,1015\n225,RandomBuff2-3,MysticBuff2,공격력 35% 증가,1,123,,,,,,,,,,8500,100,511,1016\n226,RandomBuff2-4,MysticBuff2,저항력 15% 증가,1,124,,,,,,,,,,8500,100,511,1017\n227,RandomBuff2-5,MysticBuff2,이동 속도 15% 캐스팅 속도 15% 증가.,1,20,30,,,,,,,,,8500,100,511,1018\n228,RandomBuff3-1,MysticBuff3,매초 HP + 100,1,125,,,,,,,,,,10000,100,511,1014\n229,RandomBuff3-2,MysticBuff3,매초 MP + 50,1,126,,,,,,,,,,10000,100,511,1015\n230,RandomBuff3-3,MysticBuff3,공격력 50% 증가,1,127,,,,,,,,,,10000,100,511,1016\n231,RandomBuff3-4,MysticBuff3,저항력 20% 증가,1,128,,,,,,,,,,10000,100,511,1017\n232,RandomBuff3-5,MysticBuff3,이동 속도 20% 캐스팅 속도 20% 증가.,1,23,32,,,,,,,,,10000,100,511,1018\n1000,StartBuff,Immortal,무적,1,129,,,,,,,,,,5000,100,512,1\n1001,LevelUPBuff,LevelUp,레벨 업,1,130,131,,,,,,,,,1000,100,512,1019\n2000,onlyForEffect,,,1,132,,,,,,,,,,500,100,1002,1012\n",
  "chestData" : "index,grade,HP,imgData,provideExp,provideGold,provideJewel,provideScore,minGoldCount,maxGoldCount,minGoldAmount,maxGoldAmount,minJewelCount,maxJewelCount,minJewelAmount,maxJewelAmount,minSkillCount,maxSkillCount,SkillIndex1,SkillDropRate1,SkillIndex2,SkillDropRate2,SkillIndex3,SkillDropRate3,SkillIndex4,SkillDropRate4,SkillIndex5,SkillDropRate5,SkillIndex6,SkillDropRate6,SkillIndex7,SkillDropRate7,SkillIndex7,SkillDropRate7,SkillIndex8,SkillDropRate8,SkillIndex9,SkillDropRate9,SkillIndex10,SkillDropRate10,SkillIndex11,SkillDropRate11,SkillIndex12,SkillDropRate12,SkillIndex13,SkillDropRate13,SkillIndex14,SkillDropRate14,SkillIndex15,SkillDropRate15,SkillIndex16,SkillDropRate16,SkillIndex17,SkillDropRate17,SkillIndex18,SkillDropRate18,SkillIndex19,SkillDropRate19,SkillIndex20,SkillDropRate20\n1,1,2000,108,150,50,0,100,3,6,50,150,0,1,1,1,1,1,21,50,31,100,41,75,51,75,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n2,1,2000,108,150,50,0,100,3,6,50,150,0,1,1,1,1,1,1011,50,1021,100,1031,100,1041,75,1051,75,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n3,1,2000,108,150,50,0,100,3,6,50,150,0,1,1,1,1,1,2011,50,2021,50,2031,75,2041,75,2051,75,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n4,2,2500,109,200,100,0,150,4,6,75,200,0,1,1,1,1,1,21,50,31,100,41,75,51,75,61,50,71,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n5,2,2500,109,200,100,0,150,4,6,75,200,0,1,1,1,1,1,1011,50,1021,100,1031,100,1041,75,1051,75,1061,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n6,2,2500,109,200,100,0,150,4,6,75,200,0,1,1,1,1,1,2011,50,2021,50,2031,75,2041,75,2051,75,2061,50,2071,50,2081,50,,,,,,,,,,,,,,,,,,,,,,,,,,\n7,3,3500,110,300,150,0,200,5,7,100,250,0,2,1,1,1,1,41,75,51,75,61,50,71,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n8,3,3500,110,300,150,0,200,5,7,100,250,0,2,1,1,1,1,1041,75,1051,75,1061,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n9,3,3500,110,300,150,0,200,5,7,100,250,0,2,1,1,1,1,2031,75,2041,75,2051,75,2061,50,2071,50,2081,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n10,4,4500,111,400,200,0,350,5,8,125,300,1,2,1,1,1,1,41,75,51,75,61,50,71,50,81,25,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n11,4,4500,111,400,200,0,350,5,8,125,300,1,2,1,1,1,1,1041,75,1051,75,1061,50,1071,25,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n12,4,4500,111,400,200,0,350,5,8,125,300,1,2,1,1,1,1,2031,75,2041,75,2051,75,2061,50,2071,50,2081,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n13,5,6000,112,500,250,0,500,6,9,150,350,1,3,1,1,1,2,41,75,51,75,61,50,71,50,81,25,1041,75,1051,75,1061,50,1071,25,,,,,,,,,,,,,,,,,,,,,,,,\n14,5,6000,112,500,250,0,500,6,9,150,350,1,3,1,1,1,2,1041,75,1051,75,1061,50,1071,25,2031,75,2041,75,2051,75,2061,50,2071,50,2081,50,,,,,,,,,,,,,,,,,,,,,,\n15,5,6000,112,500,250,0,500,6,9,150,350,1,3,1,1,1,2,2031,75,2041,75,2051,75,2061,50,2071,50,2081,50,41,75,51,75,61,50,71,50,81,25,,,,,,,,,,,,,,,,,,,,\n",
  "obstacleData" :
  "index,type,id,posX,posY,radius,treeImgRadius,imgData\n1,1,OTT1,1813,5287,15,45,103\n2,1,OTT2,2916,4689,15,45,103\n3,1,OTT3,3534,5217,15,45,103\n4,1,OTT4,2659,2268,15,45,103\n5,1,OTT5,2205,4811,15,45,103\n6,1,OTT6,4255,5123,15,45,103\n7,1,OTT7,911,5296,15,45,103\n8,1,OTT8,5019,847,15,45,103\n9,1,OTT9,3650,3575,15,45,103\n10,1,OTT10,2442,5525,15,45,103\n11,1,OTT11,4170,1353,15,45,103\n12,1,OTT12,2703,3846,15,45,103\n13,1,OTT13,1050,5250,15,45,103\n14,1,OTT14,5747,3310,15,45,103\n15,1,OTT15,1155,5825,15,45,103\n16,1,OTT16,3538,3638,25,75,102\n17,1,OTT17,5915,2959,25,75,102\n18,1,OTT18,1326,2446,25,75,102\n19,1,OTT19,2381,1937,25,75,102\n20,1,OTT20,5638,4165,25,75,102\n21,1,OTT21,4779,1984,25,75,102\n22,1,OTT22,4577,3139,25,75,102\n23,1,OTT23,5046,3716,25,75,102\n24,1,OTT24,4318,5169,25,75,102\n25,1,OTT25,4394,933,25,75,102\n26,1,OTT26,1539,3673,25,75,102\n27,1,OTT27,2505,1130,25,75,102\n28,1,OTT28,3130,420,25,75,102\n29,1,OTT29,1619,5102,25,75,102\n30,1,OTT30,1495,471,25,75,102\n31,1,OTT31,5776,3131,25,75,102\n32,1,OTT32,5713,5996,25,75,102\n33,1,OTT33,5333,5525,25,75,102\n34,1,OTT34,713,5955,25,75,102\n35,1,OTT35,1487,2343,25,75,102\n36,1,OTT36,3320,2989,25,75,102\n37,1,OTT37,4549,5696,25,75,102\n38,1,OTT38,1885,1192,25,75,102\n39,1,OTT39,620,3401,25,75,102\n40,1,OTT40,1365,1602,25,75,102\n41,1,OTT41,4259,5741,25,75,102\n42,1,OTT42,3759,2736,25,75,102\n43,1,OTT43,2441,2818,25,75,102\n44,1,OTT44,1297,2105,25,75,102\n45,1,OTT45,2790,1331,25,75,102\n46,1,OTT46,1056,1944,25,75,102\n47,1,OTT47,3698,1095,25,75,102\n48,1,OTT48,2627,3504,25,75,102\n49,1,OTT49,3488,1280,25,75,102\n50,1,OTT50,5526,4258,25,75,102\n51,1,OTT51,2504,1595,25,75,102\n52,1,OTT52,4500,1250,25,75,102\n53,1,OTT53,2582,749,30,90,101\n54,1,OTT54,5811,4682,30,90,101\n55,1,OTT55,1681,1557,30,90,101\n56,1,OTT56,5229,4733,30,90,101\n57,1,OTT57,2955,3093,30,90,101\n58,1,OTT58,3779,2909,30,90,101\n59,1,OTT59,5111,2341,30,90,101\n60,1,OTT60,3025,4827,30,90,101\n61,1,OTT61,1756,2445,30,90,101\n62,1,OTT62,4879,1238,30,90,101\n63,1,OTT63,3044,1209,30,90,101\n64,1,OTT64,2502,5932,30,90,101\n65,1,OTT65,3481,1035,30,90,101\n66,1,OTT66,3321,4427,30,90,101\n67,1,OTT67,5508,1295,30,90,101\n68,1,OTT68,650,728,30,90,101\n69,1,OTT69,1030,5347,30,90,101\n70,1,OTT70,5296,5735,30,90,101\n71,1,OTT71,5335,4911,30,90,101\n72,1,OTT72,4424,756,30,90,101\n73,1,OTT73,3617,3077,30,90,101\n74,1,OTT74,2067,3735,30,90,101\n75,1,OTT75,5656,1688,30,90,101\n76,1,OTT76,2026,3498,30,90,101\n77,1,OTT77,4142,5665,30,90,101\n78,1,OTT78,2142,1107,30,90,101\n79,1,OTT79,421,1652,30,90,101\n80,1,OTT80,5672,5072,30,90,101\n81,1,OTT81,2898,3001,30,90,101\n82,1,OTT82,5229,5102,30,90,101\n83,1,OTT83,1712,5196,30,90,101\n84,1,OTT84,844,4561,30,90,101\n85,1,OTT85,3324,2013,30,90,101\n86,1,OTT86,5427,1796,30,90,101\n87,1,OTT87,1800,1100,30,90,101\n88,1,OTT88,1900,1850,30,90,101\n89,1,OTT89,4350,4650,30,90,101\n90,1,OTT90,4450,4600,30,90,101\n91,1,OTT91,4600,1350,30,90,101\n101,2,OTR1,2908,4747,50,,106\n102,2,OTR2,5515,1649,50,,106\n103,2,OTR3,2290,5083,50,,106\n104,2,OTR4,3017,1005,50,,106\n105,2,OTR5,5004,4010,50,,106\n106,2,OTR6,1866,2244,50,,106\n107,2,OTR7,591,879,50,,106\n108,2,OTR8,3546,5294,50,,106\n109,2,OTR9,638,2656,50,,106\n110,2,OTR10,5974,3515,50,,106\n111,2,OTR11,5355,1263,50,,106\n112,2,OTR12,3815,716,50,,106\n113,2,OTR13,1121,2027,50,,106\n114,2,OTR14,3565,2288,50,,106\n115,2,OTR15,1075,5062,50,,106\n116,2,OTR16,4508,425,50,,106\n117,2,OTR17,4486,3926,50,,106\n118,2,OTR18,4685,3434,50,,106\n119,2,OTR19,3495,2151,50,,106\n120,2,OTR20,664,461,50,,106\n121,2,OTR21,4250,914,50,,106\n122,2,OTR22,3419,933,50,,106\n123,2,OTR23,3913,5340,50,,106\n124,2,OTR24,3886,5790,50,,106\n125,2,OTR25,3154,4025,50,,106\n126,2,OTR26,2000,1200,50,,106\n127,2,OTR27,4963,3212,70,,105\n128,2,OTR28,1190,5523,70,,105\n129,2,OTR29,3644,4896,70,,105\n130,2,OTR30,5263,886,70,,105\n131,2,OTR31,3689,3554,70,,105\n132,2,OTR32,2274,2461,70,,105\n133,2,OTR33,1310,1804,70,,105\n134,2,OTR34,1144,5225,70,,105\n135,2,OTR35,814,1889,70,,105\n136,2,OTR36,2152,3749,70,,105\n137,2,OTR37,4610,1118,70,,105\n138,2,OTR38,2968,782,70,,105\n139,2,OTR39,1476,1488,70,,105\n140,2,OTR40,651,3039,70,,105\n141,2,OTR41,2017,1779,70,,105\n142,2,OTR42,5493,5642,70,,105\n143,2,OTR43,4557,1479,70,,105\n144,2,OTR44,3271,4796,70,,105\n145,2,OTR45,1643,4767,70,,105\n146,2,OTR46,5339,3605,70,,105\n147,2,OTR47,666,2321,70,,105\n148,2,OTR48,3681,2011,70,,105\n149,2,OTR49,5014,5235,70,,105\n150,2,OTR50,2958,1974,70,,105\n151,2,OTR51,1758,3574,70,,105\n152,2,OTR52,3550,2900,70,,105\n201,3,OCG1,2090,920,35,,113\n202,3,OCG2,4480,1400,35,,113\n203,3,OCG3,2060,2000,35,,113\n204,3,OCG4,5520,2400,35,,113\n205,3,OCG5,3160,3160,35,,113\n206,3,OCG6,800,3920,35,,113\n207,3,OCG7,4260,4320,35,,113\n208,3,OCG8,1840,4920,35,,113\n209,3,OCG9,4230,5400,35,,113\n",
  "resourceData" :
  "index,name,srcPosX,srcPosY,srcWidth,srcHeight,width,height\n1,pyroNovice,0,0,70,70,60,60\n2,pyroApprentice,70,0,70,70,61,61\n3,pyroAdept,140,0,70,70,63,63\n4,pyroExpert,210,0,70,70,64,64\n5,pyroMaster,280,0,70,70,65,65\n6,frosterNovice,0,70,70,70,60,60\n7,frosterApprentice,70,70,70,70,61,61\n8,frosterAdept,140,70,70,70,63,63\n9,frosterExpert,210,70,70,70,64,64\n10,frosterMaster,280,70,70,70,65,65\n11,mysterNovice,0,140,70,70,60,60\n12,mysterApprentice,70,140,70,70,61,61\n13,mysterAdept,140,140,70,70,63,63\n14,mysterExpert,210,140,70,70,64,64\n15,mysterMaster,280,140,70,70,65,65\n16,charHandIdle,0,210,120,100,120,100\n17,charHandCast1,120,210,120,100,120,100\n18,charHandCast2,240,210,120,100,120,100\n19,charHandCast3,360,210,120,100,120,100\n20,charHandCast4,480,210,120,100,120,100\n21,castEffectFire,0,310,120,100,120,100\n22,castEffectFrost,120,310,120,100,120,100\n23,castEffectArcane,240,310,120,100,120,100\n24,projectileFire,0,220,70,70,65,65\n25,projectileFrost,70,220,70,70,65,65\n26,projectileArcane,140,220,70,70,65,65\n27,skillEffectFire,0,290,160,160,155,155\n28,skillEffectFrost,160,290,160,160,155,155\n29,skillEffectArcane,320,290,160,160,155,155\n100,projectileSkillArrow,0,410,240,80,240,80\n101,objTreeLarge,210,0,210,210,225,225\n102,objTreeMedium,210,0,210,210,185,185\n103,objTreeSmall,210,0,210,210,145,145\n104,objTreeInside,420,0,210,210,0,0\n105,objStoneLarge,0,0,210,210,165,165\n106,objStoneMedium,0,0,210,210,125,125\n107,objStoneSmall,0,0,210,210,85,85\n108,objChest1,0,210,90,90,85,85\n109,objChest2,90,210,90,90,85,85\n110,objChest3,180,210,90,90,85,85\n111,objChest4,270,210,90,90,85,85\n112,objChest5,360,210,90,90,85,85\n113,objChestGround,450,210,90,90,85,85\n200,objGold,0,300,70,70,65,65\n201,objJewel,70,300,70,70,65,65\n202,objSkillFire,0,370,70,70,65,65\n203,objSkillFrost,70,370,70,70,65,65\n204,objSkillArcane,140,370,70,70,65,65\n205,objBox,140,300,70,70,65,65\n1001,conditionEffectFreeze,0,0,80,80,75,75\n1002,conditionEffectChill,80,0,80,80,75,75\n1003,conditionEffectImmortal,160,0,80,80,75,75\n1004,conditionEffectSilence,240,0,80,80,75,75\n1005,conditionEffectIgnite1,0,80,60,60,55,55\n1006,conditionEffectIgnite2,60,80,60,60,55,55\n1007,conditionEffectIgnite3,120,80,60,60,55,55\n1008,conditionEffectIgnite4,180,80,60,60,55,55\n1009,conditionEffectIgnite5,240,80,60,60,55,55\n1010,conditionEffectIgnite6,300,80,60,60,55,55\n1011,fireHitEffect,210,220,70,70,65,65\n1012,frostHitEffect,280,220,70,70,65,65\n1013,arcaneHitEffect,350,220,70,70,65,65\n1014,blankImg,0,450,60,60,55,55\n1015,passiveEffectFire1,60,450,60,60,60,60\n1016,passiveEffectFire2,120,450,60,60,65,65\n1017,passiveEffectFire3,180,450,60,60,70,70\n1018,passiveEffectFire4,240,450,60,60,75,75\n1019,passiveEffectFire5,300,450,60,60,80,80\n1020,passiveEffectFire6,360,450,60,60,85,85\n1021,passiveEffectFire7,420,450,60,60,90,90\n1022,passiveEffectFrost1,0,510,60,60,60,60\n1023,passiveEffectFrost2,60,510,60,60,65,65\n1024,passiveEffectFrost3,120,510,60,60,70,70\n1025,passiveEffectFrost4,180,510,60,60,75,75\n1026,passiveEffectFrost5,240,510,60,60,80,80\n1027,passiveEffectFrost6,300,510,60,60,85,85\n1028,passiveEffectFrost7,360,510,60,60,90,90\n1029,passiveEffectArcane1,480,450,60,60,60,60\n1030,passiveEffectArcane2,420,510,60,60,65,65\n1031,passiveEffectArcane3,480,510,60,60,70,70\n1032,passiveEffectArcane4,540,510,60,60,75,75\n1033,passiveEffectArcane5,600,510,60,60,80,80\n1034,passiveEffectArcane6,660,510,60,60,85,85\n1035,passiveEffectArcane7,720,510,60,60,90,90\n1036,fireSkillEffectInnerFire,0,140,80,80,80,80\n1037,fireSkillEffectFury1,80,140,80,80,80,80\n1038,fireSkillEffectFury2,80,140,80,80,83,83\n1039,fireSkillEffectFury3,80,140,80,80,86,86\n1040,fireSkillEffectFury4,80,140,80,80,90,90\n1041,fireSkillEffectFury5,80,140,80,80,85,88\n1042,frostSkillEffectPurify,160,140,80,80,70,70\n1043,frostSkillEffectIceBlock,240,140,80,80,90,90\n1044,arcaneSkillEffectCloak,320,140,80,80,90,90\n1045,arcaneSkillEffectHaste1,400,140,80,80,80,80\n1046,arcaneSkillEffectHaste2,400,140,80,80,83,83\n1047,arcaneSkillEffectHaste3,400,140,80,80,86,86\n1048,arcaneSkillEffectHaste4,400,140,80,80,90,90\n1049,arcaneSkillEffectHaste5,400,140,80,80,85,88\n1050,fireProjectileRollingFire,480,290,90,90,90,90\n1051,frostProjectileFrostOrb,570,290,90,90,90,90\n1052,arcaneSkillNoDamageExplosion,660,290,90,90,90,90\n1053,regenHP1,360,80,60,60,55,55\n1054,regenHP2,420,80,60,60,55,55\n1055,regenHP3,480,80,60,60,55,55\n1056,regenHP4,540,80,60,60,55,55\n1057,regenHP5,600,80,60,60,55,55\n1058,regenMP1,360,20,60,60,55,55\n1059,regenMP2,420,20,60,60,55,55\n1060,regenMP3,480,20,60,60,55,55\n1061,regenMP4,540,20,60,60,55,55\n1062,regenMP5,600,20,60,60,55,55\n1063,purifyAndHeal1,660,20,60,60,55,55\n1064,purifyAndHeal2,720,20,60,60,55,55\n1065,dispel1,480,140,60,60,55,55\n1066,dispel2,540,140,60,60,55,55\n1067,dispel3,600,140,60,60,55,55\n1068,dispel4,660,140,60,60,55,55\n1069,levelUp1,160,0,80,80,64,64\n1070,levelUp2,160,0,80,80,66,66\n1071,levelUp3,160,0,80,80,68,68\n1072,levelUp4,160,0,80,80,70,70\n1073,levelUp5,160,0,80,80,72,72\n",
  "iconResourceData" :
  "index,name,top,right,bottom,left\n1,Pyro Attack,0,72,72,0\n2,Fire Bolt,0,144,72,72\n3,Burning Soul,0,216,72,144\n4,Fire Ball,0,288,72,216\n5,Inner Fire,0,360,72,288\n6,Rolling Fire,0,432,72,360\n7,Fury,0,504,72,432\n8,Explosion,0,576,72,504\n9,Pyromaniac,0,648,72,576\n101,Froster Attack,72,72,144,0\n102,Ice Bolt,72,144,144,72\n103,Healing,72,216,144,144\n104,Frozen Soul,72,288,144,216\n105,Purify,72,360,144,288\n106,Ice Block,72,432,144,360\n107,Vortex,72,504,144,432\n108,Frozen Orb,72,576,144,504\n109,Freezer,72,648,144,576\n201,Myster Attack,144,72,216,0\n202,Arcane Bolt,144,144,216,72\n203,Arcane Cloak,144,216,216,144\n204,Arcane Missile,144,288,216,216\n205,Silence,144,360,216,288\n206,Dispel,144,432,216,360\n207,Blink,144,504,216,432\n208,Arcane Blast,144,576,216,504\n209,Haste,144,648,216,576\n210,Mystic,144,720,216,648\n501,Buff_Burning Soul,360,72,432,0\n502,Buff_Inner Fire,360,144,432,72\n503,Buff_Fury,360,216,432,144\n504,Buff_Pyromaniac,360,288,432,216\n505,Buff_Frozen Soul,360,360,432,288\n506,Buff_Purify,360,432,432,360\n507,Buff_Ice Block,360,504,432,432\n508,Buff_Freezer,360,576,432,504\n509,Buff_Arcane Cloak,432,72,504,0\n510,Buff_Haste,432,144,504,72\n511,Buff_Mystic,432,216,504,144\n512,Buff_Immortal,432,288,504,216\n513,Debuff_Ignite,288,72,360,0\n514,Debuff_Chill,288,144,360,72\n515,Debuff_Freeze,288,216,360,144\n516,Debuff_Silence,288,288,360,216\n517,Debuff_Dispel,288,360,360,288\n1001,blankImg,216,72,288,0\n1002,whiteBlankImg,216,144,288,72\n",
  "effectGroupData" :
  "index,name,isRotate,rotateStartDegree,isAttach,isFront,resourceLifeTime,resourceIndex1,resourceIndex2,resourceIndex3,resourceIndex4,resourceIndex5,resourceIndex6,resourceIndex7,resourceIndex8,resourceIndex9,resourceIndex10\n1,Immortal,1,0,1,1,,1003,,,,,,,,,\n2,Chill,0,,1,1,,1002,,,,,,,,,\n3,Freeze,0,,1,1,,1001,,,,,,,,,\n4,Silence,0,,1,1,,1004,,,,,,,,,\n5,Ignite,0,,0,0,300,1005,1006,1007,1008,1009,1010,,,,\n6,fireHitEffect,0,,1,1,100,1011,,,,,,,,,\n7,frostHitEffect,0,,1,1,100,1012,,,,,,,,,\n8,arcaneHitEffect,0,,1,1,100,1013,,,,,,,,,\n101,firePassive,0,,1,0,,1014,1014,1014,1015,1016,1017,1018,1019,1020,1021\n102,frostPassive,0,,1,0,,1014,1014,1014,1022,1023,1024,1025,1026,1027,1028\n103,arcanePassive,1,0,1,0,,1014,1014,1014,1029,1030,1031,1032,1033,1034,1035\n1001,fireSkillEffectInnerFire,1,0,1,0,,1036,,,,,,,,,\n1002,fireSkillEffectFury,0,,1,0,,1037,1038,1039,1040,1041,1040,1039,1038,1037,1037\n1003,frostSkillEffectPurify,1,0,1,1,,1042,,,,,,,,,\n1004,frostSkillEffectIceBlock,1,0,1,1,,1043,,,,,,,,,\n1005,arcaneSkillEffectCloak,1,0,1,0,,1044,,,,,,,,,\n1006,arcaneSkillEffectHaste,1,0,1,0,,1048,1047,1046,1045,1045,1045,1046,1047,1048,1049\n1007,fireProjectileRollingFire,1,0,0,1,,1050,,,,,,,,,\n1008,frostProjectileFrostOrb,1,0,0,1,,1051,,,,,,,,,\n1009,arcaneSkillNoDamageExplosion,0,,0,1,,1052,,,,,,,,,\n1010,regenHP,0,,1,1,,1054,1053,1054,1055,1056,1057,1014,1014,1014,1014\n1011,regenMP,0,,1,1,,1014,1014,1014,1014,1059,1058,1059,1060,1061,1062\n1012,purifyAndHeal,0,,1,1,,1063,1064,1063,1058,1059,,,,,\n1013,dispel,0,,1,1,,1066,1065,1066,1067,1068,,,,,\n1014,mysticRegenHP,0,,1,1,,1014,1014,1054,1053,1054,1055,1056,1057,1014,1014\n1015,mysticRegenMP,0,,1,1,,1014,1059,1058,1059,1060,1061,1062,1014,1014,1014\n1016,mysticInnerFire,1,180,1,0,,1036,,,,,,,,,\n1017,mysticCloak,1,180,1,0,,1044,,,,,,,,,\n1018,mysticHaste,1,0,1,0,,1045,1045,1046,1047,1048,1049,1048,1047,1046,1045\n1019,levelUp,1,0,1,1,,1069,1070,1071,1072,1073,1072,1071,1070,1069,\n"
}

},{}],8:[function(require,module,exports){
module.exports={
  "MAX_SERVER_RESPONSE_TIME" : 5000,
  "LIMIT_NO_ACTION_TIME" : 7200000,
  "LONG_TIME_INTERVAL" : 300000,
  "MAX_PING_LIMIT" : 2000,
  "INTERVAL" : 60,
  "FPS" : 60,

  "RESOURCES_COUNT" : 4,
  "RESOURCE_SRC_CHARACTER" : "../images/Character.png",
  "RESOURCE_SRC_OBJECT" : "../images/Objects.png",
  "RESOURCE_SRC_SKILL_EFFECT" : "../images/SkillEffect.png",
  "RESOURCE_SRC_UI" : "../images/UI.png",

  "MINIMAP_CHEST_GROUND_SRC" : "../images/chestGround.png",
  "MINIMAP_CHEST_SRC_1" : "../images/chest1.png",
  "MINIMAP_CHEST_SRC_2" : "../images/chest2.png",
  "MINIMAP_CHEST_SRC_3" : "../images/chest3.png",
  "MINIMAP_VOID_SRC" : "../images/void.png",

  "START_BUTTON" : 1,
  "RESTART_BUTTON" : 2,

  "MINIMUM_LOADING_TIME" : 2000,
  "CHANGE_LOADING_TEXT_TIME" : 500,
  "SKILL_INFORM_TIME" : 150,
  "SKILL_HIT_EFFECT_TIME" : 100,
  "USER_ATTACH_EFFECT_CHANGE_TIME" : 150,
  "USER_DETACH_EFFECT_CHANGE_TIME" : 50,
  "USER_DETACH_EFFECT_MAKE_TIME" : 200,
  "RISE_TEXT_LIFE_TIME" : 3000,
  "PROJECTILE_EFFECT_CHANGE_TIME" : 150,
  "CHAT_MESSAGE_TIME" : 5000,

  "DEAD_SCENE_TEXT_ANI_PLAY_DELAY_TIME" : 1000,
  "DEAD_SCENE_PLAY_TIME" : 5000,

  "CAST_EFFECT_INTERPOLATION_FACTOR" : 0.1,
  "SKILL_EFFECT_INTERPOLATION_FACTOR" : 0.6,
  "USER_ANI_TIME" : 500,
  "IMG_COLLISION_CLEAR_TIME" : 200,

  "CANVAS_MAX_SIZE" : {"width" : 6400, "height" : 6400},
  "CANVAS_MAX_LOCAL_SIZE" : {"width" : 1600, "height" : 1000},

  "IMAGE_SOURCE_SIZE" : {"width" : 800, "height" : 600},

  "DRAW_MODE_NORMAL" : 1,
  "DRAW_MODE_SKILL_RANGE" : 2,

  "SKILL_CHANGE_PANEL_CONTAINER" : 1,
  "SKILL_CHANGE_PANEL_EQUIP" : 2,

  "OBJECT_STATE_IDLE" : 1,
  "OBJECT_STATE_MOVE" : 2,
  "OBJECT_STATE_ATTACK" : 3,
  "OBJECT_STATE_CAST" : 4,
  "OBJECT_STATE_DEATH" : 5,
  "OBJECT_STATE_MOVE_AND_ATTACK" : 6,

  "MOVE_SLIGHT_RATE" : 0.6,
  "MOVE_BACK_WARD_SPEED_DECREASE_RATE" : 0.5,

  "GAME_STATE_LOAD" : 1,
  "GAME_STATE_START_SCENE" : 2,
  "GAME_STATE_GAME_START" : 3,
  "GAME_STATE_GAME_ON" : 4,
  "GAME_STATE_GAME_END" : 5,
  "GAME_STATE_RESTART_SCENE" : 6,
  "GAME_STATE_RESTART" : 7,

  "CHAR_TYPE_FIRE" : 1,
  "CHAR_TYPE_FROST" : 2,
  "CHAR_TYPE_ARCANE" : 3,

  "PREFIX_USER" : "USR",
  "PREFIX_SKILL" : "SKL",
  "PREFIX_SKILL_PROJECTILE" : "SKP",
  "PREFIX_CHEST" : "CHT",
  "PREFIX_OBSTACLE_TREE" : "OTT",
  "PREFIX_OBSTACLE_ROCK" : "OTR",
  "PREFIX_OBSTACLE_CHEST_GROUND" : "OCG",
  "PREFIX_OBJECT_EXP" : "OXP",
  "PREFIX_OBJECT_SKILL" : "OSK",
  "PREFIX_OBJECT_GOLD" : "OGD",
  "PREFIX_OBJECT_JEWEL" : "OJW",
  "PREFIX_OBJECT_BOX" : "OBX",

  "USER_CONDITION_IMMORTAL" : 1,
  "USER_CONDITION_CHILL" : 2,
  "USER_CONDITION_FREEZE" : 3,
  "USER_CONDITION_SILENCE" : 4,
  "USER_CONDITION_IGNITE" : 5,
  "USER_CONDITION_BLUR" : 6,

  "SKILL_PROPERTY_FIRE" : 1,
  "SKILL_PROPERTY_FROST" : 2,
  "SKILL_PROPERTY_ARCANE" : 3,

  "SKILL_INDEX_PYRO_BASE" : 11,
  "SKILL_INDEX_PYRO_PASSIVE" : 91,
  "SKILL_INDEX_PYRO_GIVEN": 21,
  "SKILL_INDEX_FROST_BASE" : 1001,
  "SKILL_INDEX_FROST_PASSIVE" : 1081,
  "SKILL_INDEX_FROST_GIVEN": 1011,
  "SKILL_INDEX_ARCANE_BASE" : 2001,
  "SKILL_INDEX_ARCANE_PASSIVE" : 2091,
  "SKILL_INDEX_ARCANE_GIVEN" : 2011,

  "TUTORIAL_SKILL_INDEX" : 2021,

  "SKILL_TYPE_INSTANT_RANGE" : 1,
  "SKILL_TYPE_INSTANT_PROJECTILE" : 2,
  "SKILL_TYPE_PROJECTILE" : 3,
  "SKILL_TYPE_PROJECTILE_EXPLOSION" : 4,
  "SKILL_TYPE_PROJECTILE_TICK" : 5,
  "SKILL_TYPE_PROJECTILE_TICK_EXPLOSION" : 6,
  "SKILL_TYPE_RANGE" : 7,
  "SKILL_TYPE_SELF" : 8,
  "SKILL_TYPE_SELF_EXPLOSION" : 9,
  "SKILL_TYPE_TELEPORT" : 10,
  "SKILL_TYPE_PASSIVE" : 11,

  "SKILL_BASIC_INDEX" : 1,
  "SKILL_EQUIP1_INDEX" : 2,
  "SKILL_EQUIP2_INDEX" : 3,
  "SKILL_EQUIP3_INDEX" : 4,
  "SKILL_EQUIP4_INDEX" : 5,
  "SKILL_PASSIVE_INDEX" : 6,

  "STAT_POWER_INDEX" : 1,
  "STAT_MAGIC_INDEX" : 2,
  "STAT_SPEED_INDEX" : 3,
  "STAT_OFFENCE_INDEX" : 4,
  "STAT_DEFENCE_INDEX" : 5,

  "PROJECTILE_FIRE_DISTANCE" : 20,
  "MULTI_PROJECTILE_DEGREE" : 15,

  "OBJ_SKILL_RADIUS" : 20,
  "OBJ_JEWEL_RADIUS" : 20,
  "OBJ_BOX_RADIUS" : 23,

  "GET_RESOURCE_TYPE_GOLD" : 1,
  "GET_RESOURCE_TYPE_JEWEL" : 2,
  "GET_RESOURCE_TYPE_EXP" : 3,

  "OBJ_TYPE_TREE" : 1,
  "OBJ_TYPE_ROCK" : 2,
  "OBJ_TYPE_CHEST_GROUND" : 3,

  "RESOURCE_INDEX_USER_HAND_1" : 16,
  "RESOURCE_INDEX_USER_HAND_2" : 17,
  "RESOURCE_INDEX_USER_HAND_3" : 18,
  "RESOURCE_INDEX_USER_HAND_4" : 19,
  "RESOURCE_INDEX_USER_HAND_5" : 20,

  "RESOURCE_INDEX_CASTING_FIRE" : 21,
  "RESOURCE_INDEX_CASTING_FROST" : 22,
  "RESOURCE_INDEX_CASTING_ARCANE" : 23,

  "RESOURCE_INDEX_PROJECTILE_FIRE" : 24,
  "RESOURCE_INDEX_PROJECTILE_FROST" : 25,
  "RESOURCE_INDEX_PROJECTILE_ARCANE" : 26,

  "RESOURCE_INDEX_SKILL_EFFECT_FIRE" : 27,
  "RESOURCE_INDEX_SKILL_EFFECT_FROST" : 28,
  "RESOURCE_INDEX_SKILL_EFFECT_ARCANE" : 29,

  "RESOURCE_INDEX_PROJECTILE_SKILL_ARROW" : 100,

  "RESOURCE_INDEX_OBSTACLE_TREE_INSIDE" : 104,

  "RESOURCE_INDEX_OBJ_GOLD" : 200,
  "RESOURCE_INDEX_OBJ_JEWEL" : 201,
  "RESOURCE_INDEX_OBJ_BOX" : 205,
  "RESOURCE_INDEX_OBJ_SKILL_FIRE" : 202,
  "RESOURCE_INDEX_OBJ_SKILL_FROST" : 203,
  "RESOURCE_INDEX_OBJ_SKILL_ARCANE" : 204,

  "RESOURCE_INDEX_CHEST_GRADE_1" : 108,
  "RESOURCE_INDEX_CHEST_GRADE_2" : 109,
  "RESOURCE_INDEX_CHEST_GRADE_3" : 110,
  "RESOURCE_INDEX_CHEST_GRADE_4" : 111,
  "RESOURCE_INDEX_CHEST_GRADE_5" : 112,

  "UI_RESOURCE_INDEX_BLANK" : 1001,

  "STAT_CALC_FACTOR_POWER_TO_DAMAGE_RATE" : 0.5,
  "STAT_CALC_FACTOR_POWER_TO_HP" : 25,
  "STAT_CALC_FACTOR_POWER_TO_HP_REGEN" : 0.05,

  "STAT_CALC_FACTOR_MAGIC_TO_RESISTANCE" : 0.5,
  "STAT_CALC_FACTOR_MAGIC_TO_MP" : 15,
  "STAT_CALC_FACTOR_MAGIC_TO_MP_REGEN" : 0.03,

  "STAT_CALC_FACTOR_SPEED_TO_CAST_SPEED" : 0.25,
  "STAT_CALC_FACTOR_SPEED_TO_COOLDOWN_REDUCE_RATE" : 0.25,

  "KILL_FEEDBACK_LEVEL_0" : 1,
  "KILL_FEEDBACK_LEVEL_1" : 2,
  "KILL_FEEDBACK_LEVEL_1_PREFIX" : "Outstanding",
  "KILL_FEEDBACK_LEVEL_1_COLOR" : "#f5ebb6",
  "KILL_FEEDBACK_LEVEL_2" : 3,
  "KILL_FEEDBACK_LEVEL_2_PREFIX" : "Amazing",
  "KILL_FEEDBACK_LEVEL_2_COLOR" : "#f5e489",
  "KILL_FEEDBACK_LEVEL_3" : 4,
  "KILL_FEEDBACK_LEVEL_3_PREFIX" : "Incredible",
  "KILL_FEEDBACK_LEVEL_3_COLOR" : "#f7de57",
  "KILL_FEEDBACK_LEVEL_4" : 5,
  "KILL_FEEDBACK_LEVEL_4_PREFIX" : "Heroic",
  "KILL_FEEDBACK_LEVEL_4_COLOR" : "#f9dc3e",
  "KILL_FEEDBACK_LEVEL_5" : 6,
  "KILL_FEEDBACK_LEVEL_5_PREFIX" : "Legendary",
  "KILL_FEEDBACK_LEVEL_5_COLOR" : "#fbda25",
  "KILL_FEEDBACK_LEVEL_6" : 7,
  "KILL_FEEDBACK_LEVEL_6_PREFIX" : "Mythic",
  "KILL_FEEDBACK_LEVEL_6_COLOR" : "#f9d511",
  "KILL_FEEDBACK_LEVEL_7" : 8,
  "KILL_FEEDBACK_LEVEL_7_PREFIX" : "Godlike",
  "KILL_FEEDBACK_LEVEL_7_COLOR" : "#ffd700"
}

},{}],9:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],10:[function(require,module,exports){
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    return define([], factory);
  } else if (typeof exports === 'object' && module.exports) {
    return module.exports = factory();
  } else {
    return root['Quadtree'] = factory();
  }
})(this, (function() {
  var Quadtree;

  var isInteger = Number.isInteger || function (x) {
    return typeof x === "number" && isFinite(x) && Math.floor(x) === x;
  };

  return Quadtree = (function() {
    var boundingBoxCollision, calculateDirection, fitting, getCenter, observe, splitTree, unobserve, validateElement;

    function Quadtree(arg) {
      var child, that;
      this.x = arg.x, this.y = arg.y, this.width = arg.width, this.height = arg.height, this.maxElements = arg.maxElements;
      if ((this.width == null) || (this.height == null)) {
        throw new Error('Missing quadtree dimensions.');
      }
      if (this.x == null) {
        this.x = 0;
      }
      if (this.y == null) {
        this.y = 0;
      }
      if (this.maxElements == null) {
        this.maxElements = 1;
      }
      this.contents = [];
      this.oversized = [];
      this.size = 0;
      if (this.width < 1 || this.height < 1) {
        throw new Error('Dimensions must be positive integers.');
      }
      if (!isInteger(this.x) || !isInteger(this.y)) {
        throw new Error('Coordinates must be integers');
      }
      if (this.maxElements < 1) {
        throw new Error('The maximum number of elements before a split must be a positive integer.');
      }
      that = this;
      this.children = {
        NW: {
          create: function() {
            return new Quadtree({
              x: that.x,
              y: that.y,
              width: Math.max(Math.floor(that.width / 2), 1),
              height: Math.max(Math.floor(that.height / 2), 1),
              maxElements: that.maxElements
            });
          },
          tree: null
        },
        NE: {
          create: function() {
            return new Quadtree({
              x: that.x + Math.max(Math.floor(that.width / 2), 1),
              y: that.y,
              width: Math.ceil(that.width / 2),
              height: Math.max(Math.floor(that.height / 2), 1),
              maxElements: that.maxElements
            });
          },
          tree: null
        },
        SW: {
          create: function() {
            return new Quadtree({
              x: that.x,
              y: that.y + Math.max(Math.floor(that.height / 2), 1),
              width: Math.max(Math.floor(that.width / 2), 1),
              height: Math.ceil(that.height / 2),
              maxElements: that.maxElements
            });
          },
          tree: null
        },
        SE: {
          create: function() {
            return new Quadtree({
              x: that.x + Math.max(Math.floor(that.width / 2), 1),
              y: that.y + Math.max(Math.floor(that.height / 2), 1),
              width: Math.ceil(that.width / 2),
              height: Math.ceil(that.height / 2),
              maxElements: that.maxElements
            });
          },
          tree: null
        }
      };
      for (child in this.children) {
        this.children[child].get = function() {
          if (this.tree != null) {
            return this.tree;
          } else {
            this.tree = this.create();
            return this.tree;
          }
        };
      }
    }

    getCenter = function(item) {
      var ref, ref1;
      return {
        x: Math.floor(((ref = item.width) != null ? ref : 1) / 2) + item.x,
        y: Math.floor(((ref1 = item.height) != null ? ref1 : 1) / 2) + item.y
      };
    };

    boundingBoxCollision = function(elt1, elt2) {
      var ref, ref1, ref2, ref3;
      return !(elt1.x >= elt2.x + ((ref = elt2.width) != null ? ref : 1) || elt1.x + ((ref1 = elt1.width) != null ? ref1 : 1) <= elt2.x || elt1.y >= elt2.y + ((ref2 = elt2.height) != null ? ref2 : 1) || elt1.y + ((ref3 = elt1.height) != null ? ref3 : 1) <= elt2.y);
    };

    calculateDirection = function(element, tree) {
      var quadCenter;
      quadCenter = getCenter(tree);
      if (element.x < quadCenter.x) {
        if (element.y < quadCenter.y) {
          return 'NW';
        } else {
          return 'SW';
        }
      } else {
        if (element.y < quadCenter.y) {
          return 'NE';
        } else {
          return 'SE';
        }
      }
    };

    validateElement = function(element) {
      if (!(typeof element === 'object')) {
        throw new Error('Element must be an Object.');
      }
      if ((element.x == null) || (element.y == null)) {
        throw new Error('Coordinates properties are missing.');
      }
      if ((element != null ? element.width : void 0) < 0 || (element != null ? element.height : void 0) < 0) {
        throw new Error('Width and height must be positive integers.');
      }
    };

    splitTree = function(tree) {
      var bottomHeight, leftWidth, rightWidth, topHeight;
      leftWidth = Math.max(Math.floor(tree.width / 2), 1);
      rightWidth = Math.ceil(tree.width / 2);
      topHeight = Math.max(Math.floor(tree.height / 2), 1);
      bottomHeight = Math.ceil(tree.height / 2);
      return {
        NW: {
          x: tree.x,
          y: tree.y,
          width: leftWidth,
          height: topHeight
        },
        NE: {
          x: tree.x + leftWidth,
          y: tree.y,
          width: rightWidth,
          height: topHeight
        },
        SW: {
          x: tree.x,
          y: tree.y + topHeight,
          width: leftWidth,
          height: bottomHeight
        },
        SE: {
          x: tree.x + leftWidth,
          y: tree.y + topHeight,
          width: rightWidth,
          height: bottomHeight
        }
      };
    };

    fitting = function(element, tree) {
      var coordinates, direction, ref, where;
      where = [];
      ref = splitTree(tree);
      for (direction in ref) {
        coordinates = ref[direction];
        if (boundingBoxCollision(element, coordinates)) {
          where.push(direction);
        }
      }
      return where;
    };

    observe = function(item, tree) {
      var writeAccessors;
      writeAccessors = function(propName) {
        item["_" + propName] = item[propName];
        return Object.defineProperty(item, propName, {
          set: function(val) {
            tree.remove(this, true);
            this["_" + propName] = val;
            return tree.push(this);
          },
          get: function() {
            return this["_" + propName];
          },
          configurable: true
        });
      };
      writeAccessors('x');
      writeAccessors('y');
      writeAccessors('width');
      return writeAccessors('height');
    };

    unobserve = function(item) {
      var unwriteAccessors;
      unwriteAccessors = function(propName) {
        if (item["_" + propName] == null) {
          return;
        }
        delete item[propName];
        item[propName] = item["_" + propName];
        return delete item["_" + propName];
      };
      unwriteAccessors('x');
      unwriteAccessors('y');
      unwriteAccessors('width');
      return unwriteAccessors('height');
    };

    Quadtree.prototype.push = function(item, doObserve) {
      return this.pushAll([item], doObserve);
    };

    Quadtree.prototype.pushAll = function(items, doObserve) {
      var candidate, content, contentDir, direction, element, elements, fifo, fifoCandidates, fits, item, j, k, l, len, len1, len2, ref, ref1, relatedChild, tree;
      for (j = 0, len = items.length; j < len; j++) {
        item = items[j];
        validateElement(item);
        if (doObserve) {
          observe(item, this);
        }
      }
      fifo = [
        {
          tree: this,
          elements: items
        }
      ];
      while (fifo.length > 0) {
        ref = fifo.shift(), tree = ref.tree, elements = ref.elements;
        fifoCandidates = {
          NW: null,
          NE: null,
          SW: null,
          SE: null
        };
        for (k = 0, len1 = elements.length; k < len1; k++) {
          element = elements[k];
          tree.size++;
          fits = fitting(element, tree);
          if (fits.length !== 1 || tree.width === 1 || tree.height === 1) {
            tree.oversized.push(element);
          } else if ((tree.size - tree.oversized.length) <= tree.maxElements) {
            tree.contents.push(element);
          } else {
            direction = fits[0];
            relatedChild = tree.children[direction];
            if (fifoCandidates[direction] == null) {
              fifoCandidates[direction] = {
                tree: relatedChild.get(),
                elements: []
              };
            }
            fifoCandidates[direction].elements.push(element);
            ref1 = tree.contents;
            for (l = 0, len2 = ref1.length; l < len2; l++) {
              content = ref1[l];
              contentDir = (fitting(content, tree))[0];
              if (fifoCandidates[contentDir] == null) {
                fifoCandidates[contentDir] = {
                  tree: tree.children[contentDir].get(),
                  elements: []
                };
              }
              fifoCandidates[contentDir].elements.push(content);
            }
            tree.contents = [];
          }
        }
        for (direction in fifoCandidates) {
          candidate = fifoCandidates[direction];
          if (candidate != null) {
            fifo.push(candidate);
          }
        }
      }
      return this;
    };

    Quadtree.prototype.remove = function(item, stillObserve) {
      var index, relatedChild;
      validateElement(item);
      index = this.oversized.indexOf(item);
      if (index > -1) {
        this.oversized.splice(index, 1);
        this.size--;
        if (!stillObserve) {
          unobserve(item);
        }
        return true;
      }
      index = this.contents.indexOf(item);
      if (index > -1) {
        this.contents.splice(index, 1);
        this.size--;
        if (!stillObserve) {
          unobserve(item);
        }
        return true;
      }
      relatedChild = this.children[calculateDirection(item, this)];
      if ((relatedChild.tree != null) && relatedChild.tree.remove(item, stillObserve)) {
        this.size--;
        if (relatedChild.tree.size === 0) {
          relatedChild.tree = null;
        }
        return true;
      }
      return false;
    };

    Quadtree.prototype.colliding = function(item, collisionFunction) {
      var child, elt, fifo, fits, items, j, k, l, len, len1, len2, ref, ref1, top;
      if (collisionFunction == null) {
        collisionFunction = boundingBoxCollision;
      }
      validateElement(item);
      items = [];
      fifo = [this];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          elt = ref[j];
          if (elt !== item && collisionFunction(item, elt)) {
            items.push(elt);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          elt = ref1[k];
          if (elt !== item && collisionFunction(item, elt)) {
            items.push(elt);
          }
        }
        fits = fitting(item, top);
        if (fits.length === 0) {
          fits = [];
          if (item.x >= top.x + top.width) {
            fits.push('NE');
          }
          if (item.y >= top.y + top.height) {
            fits.push('SW');
          }
          if (fits.length > 0) {
            if (fits.length === 1) {
              fits.push('SE');
            } else {
              fits = ['SE'];
            }
          }
        }
        for (l = 0, len2 = fits.length; l < len2; l++) {
          child = fits[l];
          if (top.children[child].tree != null) {
            fifo.push(top.children[child].tree);
          }
        }
      }
      return items;
    };

    Quadtree.prototype.onCollision = function(item, callback, collisionFunction) {
      var child, elt, fifo, fits, j, k, l, len, len1, len2, ref, ref1, top;
      if (collisionFunction == null) {
        collisionFunction = boundingBoxCollision;
      }
      validateElement(item);
      fifo = [this];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          elt = ref[j];
          if (elt !== item && collisionFunction(item, elt)) {
            callback(elt);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          elt = ref1[k];
          if (elt !== item && collisionFunction(item, elt)) {
            callback(elt);
          }
        }
        fits = fitting(item, top);
        if (fits.length === 0) {
          fits = [];
          if (item.x >= top.x + top.width) {
            fits.push('NE');
          }
          if (item.y >= top.y + top.height) {
            fits.push('SW');
          }
          if (fits.length > 0) {
            if (fits.length === 1) {
              fits.push('SE');
            } else {
              fits = ['SE'];
            }
          }
        }
        for (l = 0, len2 = fits.length; l < len2; l++) {
          child = fits[l];
          if (top.children[child].tree != null) {
            fifo.push(top.children[child].tree);
          }
        }
      }
      return null;
    };

    Quadtree.prototype.get = function(query) {
      return this.where(query);
    };

    Quadtree.prototype.where = function(query) {
      var check, elt, fifo, items, j, k, key, len, len1, ref, ref1, relatedChild, top;
      if (typeof query === 'object' && ((query.x == null) || (query.y == null))) {
        return this.find(function(elt) {
          var check, key;
          check = true;
          for (key in query) {
            if (query[key] !== elt[key]) {
              check = false;
            }
          }
          return check;
        });
      }
      validateElement(query);
      items = [];
      fifo = [this];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          elt = ref[j];
          check = true;
          for (key in query) {
            if (query[key] !== elt[key]) {
              check = false;
            }
          }
          if (check) {
            items.push(elt);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          elt = ref1[k];
          check = true;
          for (key in query) {
            if (query[key] !== elt[key]) {
              check = false;
            }
          }
          if (check) {
            items.push(elt);
          }
        }
        relatedChild = top.children[calculateDirection(query, top)];
        if (relatedChild.tree != null) {
          fifo.push(relatedChild.tree);
        }
      }
      return items;
    };

    Quadtree.prototype.each = function(action) {
      var child, fifo, i, j, k, len, len1, ref, ref1, top;
      fifo = [this];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          i = ref[j];
          if (typeof action === "function") {
            action(i);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          i = ref1[k];
          if (typeof action === "function") {
            action(i);
          }
        }
        for (child in top.children) {
          if (top.children[child].tree != null) {
            fifo.push(top.children[child].tree);
          }
        }
      }
      return this;
    };

    Quadtree.prototype.find = function(predicate) {
      var child, fifo, i, items, j, k, len, len1, ref, ref1, top;
      fifo = [this];
      items = [];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          i = ref[j];
          if (typeof predicate === "function" ? predicate(i) : void 0) {
            items.push(i);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          i = ref1[k];
          if (typeof predicate === "function" ? predicate(i) : void 0) {
            items.push(i);
          }
        }
        for (child in top.children) {
          if (top.children[child].tree != null) {
            fifo.push(top.children[child].tree);
          }
        }
      }
      return items;
    };

    Quadtree.prototype.filter = function(predicate) {
      var deepclone;
      deepclone = function(target) {
        var child, copycat, item, j, k, len, len1, ref, ref1, ref2, ref3;
        copycat = new Quadtree({
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
          maxElements: target.maxElements
        });
        copycat.size = 0;
        for (child in target.children) {
          if (!(target.children[child].tree != null)) {
            continue;
          }
          copycat.children[child].tree = deepclone(target.children[child].tree);
          copycat.size += (ref = (ref1 = copycat.children[child].tree) != null ? ref1.size : void 0) != null ? ref : 0;
        }
        ref2 = target.oversized;
        for (j = 0, len = ref2.length; j < len; j++) {
          item = ref2[j];
          if ((predicate == null) || (typeof predicate === "function" ? predicate(item) : void 0)) {
            copycat.oversized.push(item);
          }
        }
        ref3 = target.contents;
        for (k = 0, len1 = ref3.length; k < len1; k++) {
          item = ref3[k];
          if ((predicate == null) || (typeof predicate === "function" ? predicate(item) : void 0)) {
            copycat.contents.push(item);
          }
        }
        copycat.size += copycat.oversized.length + copycat.contents.length;
        if (copycat.size === 0) {
          return null;
        } else {
          return copycat;
        }
      };
      return deepclone(this);
    };

    Quadtree.prototype.reject = function(predicate) {
      return this.filter(function(i) {
        return !(typeof predicate === "function" ? predicate(i) : void 0);
      });
    };

    Quadtree.prototype.visit = function(action) {
      var child, fifo, that;
      fifo = [this];
      while (fifo.length > 0) {
        that = fifo.shift();
        action.bind(that)();
        for (child in that.children) {
          if (that.children[child].tree != null) {
            fifo.push(that.children[child].tree);
          }
        }
      }
      return this;
    };

    Quadtree.prototype.pretty = function() {
      var child, fifo, indent, indentation, isParent, str, top;
      str = '';
      indent = function(level) {
        var j, ref, res, times;
        res = '';
        for (times = j = ref = level; ref <= 0 ? j < 0 : j > 0; times = ref <= 0 ? ++j : --j) {
          res += '   ';
        }
        return res;
      };
      fifo = [
        {
          label: 'ROOT',
          tree: this,
          level: 0
        }
      ];
      while (fifo.length > 0) {
        top = fifo.shift();
        indentation = indent(top.level);
        str += indentation + "| " + top.label + "\n" + indentation + "| ------------\n";
        if (top.tree.oversized.length > 0) {
          str += indentation + "| * Oversized elements *\n" + indentation + "|   " + top.tree.oversized + "\n";
        }
        if (top.tree.contents.length > 0) {
          str += indentation + "| * Leaf content *\n" + indentation + "|   " + top.tree.contents + "\n";
        }
        isParent = false;
        for (child in top.tree.children) {
          if (!(top.tree.children[child].tree != null)) {
            continue;
          }
          isParent = true;
          fifo.unshift({
            label: child,
            tree: top.tree.children[child].tree,
            level: top.level + 1
          });
        }
        if (isParent) {
          str += indentation + "└──┐\n";
        }
      }
      return str;
    };

    return Quadtree;

  })();
}));



},{}],11:[function(require,module,exports){
module.exports={
  "NA" : {
  },
  "ASIA" : {
    "ASIA1" : "52.68.95.222"
  },
  "EU" : {
  }
}

},{}],12:[function(require,module,exports){
var gameConfig = require('./gameConfig.json');
var radianFactor = Math.PI/180;
var objectAssign = require('../../modules/public/objectAssign.js');

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
    var addPos = this.onMove(this);
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
      this.setTargetDirection();
      this.setSpeed();
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
    x : targetX,
    y : targetY
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
      x : (position.x - offset.x),
      y : (position.y - offset.y)
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
  if(center.x - radius <= gameConfig.canvasSize.width && center.x + radius >= 0
     && center.y - radius <= gameConfig.canvasSize.height && center.y + radius >= 0){
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
  var data = undefined;
  for(var i=0; i<table.length; i++){
    if(table[i][columnName] == value){
      data = table[i];
      break;
    }
  }
  // for(var index in table){
  //   //use ==, because value can be integer
  //   if(table[index][columnName] == value){
  //     data = table[index];
  //     break;
  //   }
  // }
  return data;
};
exports.findAllDatas = function(table, columnName, value){
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
exports.processMessage = function(msg){
  return msg.replace(/(<([^>]+)>)/ig, '').substring(0,25);
};
exports.createDomSelectOption = function(text, value, isDisabled, parentNode, userData, pingData){
  var option = document.createElement("option");
  option.setAttribute("value", value);
  if(isDisabled){
    option.disabled = true;
  }
  if(userData){
    text += " [" + userData.currentUser + "/" + userData.maxUser + "] ";
  }
  if(pingData){
    text += pingData + "ms";
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
}

},{"../../modules/public/objectAssign.js":9,"./gameConfig.json":8}],13:[function(require,module,exports){
// inner Modules
var util = require('../../modules/public/util.js');
var User = require('../../modules/client/CUser.js');
var CManager = require('../../modules/client/CManager.js');
var gameConfig = require('../../modules/public/gameConfig.json');
// var resource = require('../../modules/public/resource.json');
var objectAssign = require('../../modules/public/objectAssign.js');
var csvJson = require('../../modules/public/csvjson.js');
var dataJson = require('../../modules/public/data.json');

var csvJsonOption = {delimiter : ',', quote : '"'};
var userStatTable = csvJson.toObject(dataJson.userStatData, csvJsonOption);
var skillTable = csvJson.toObject(dataJson.skillData, csvJsonOption);
var buffGroupTable = csvJson.toObject(dataJson.buffGroupData, csvJsonOption);
var resourceTable = csvJson.toObject(dataJson.resourceData, csvJsonOption);
var iconResourceTable = csvJson.toObject(dataJson.iconResourceData, csvJsonOption);
var obstacleTable = csvJson.toObject(dataJson.obstacleData, csvJsonOption);
var effectGroupTable = csvJson.toObject(dataJson.effectGroupData, csvJsonOption);

var socket;

// document elements
// var startScene, gameScene, standingScene;
// var startButton;

var CUIManager = require('../../modules/client/CUIManager.js');
var UIManager;

var canvas, ctx, scaleFactor;

// const var
var radianFactor = Math.PI/180;
var fps = 1000/gameConfig.FPS;
var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;

// game var
var Manager;

// resource var
var loadedResourcesCount = 0;
var resourceObject, resourceCharacter, resourceUI, resourceSkillEffect;
var isLoadResources = false, isUISettingComplete = false, loadingStartTime = Date.now(), loadingTextChangeTime = Date.now();
var isLoadServerList = false, isServerConditionGood = false;

var userHandImgData = new Array(5);
var userCastingTimeHandler = false;

var obstacleTreeInsideImgData, collisionClearTime = Date.now();
var objGoldImgData, objJewelImgData, objBoxImgData, objSkillFireImgData, objSkillFrostImgData, objSkillArcaneImgData;
var castFireImgData, castFrostImgData, castArcaneImgData;
var projectileFireImgData, projectileFrostImgData, projectileArcaneImgData;
var skillFireImgData, skillFrostImgData, skillArcaneImgData;
var projectileSkillArrowImgData;
var hittedChest = [];
// var conditionFreezeImgData, conditionChillImgData, conditionImmortalImgData, conditionSilenceImgData,
//     conditionIgnite1ImgData, conditionIgnite2ImgData, conditionIgnite3ImgData, conditionIgnite4ImgData, conditionIgnite5ImgData;
// var userImage, userHand;
// var grid;

// game state var
var gameState = gameConfig.GAME_STATE_LOAD;
var gameSetupFunc = null;
var gameUpdateFunc = null;
var isChattingOn = false;

var latency = 0;
var drawInterval = false;
var userDataUpdateInterval = false;
var userDataLastUpdateTime = Date.now();
var userLastActionTime = Date.now();
var userPingCheckTime = Date.now();

//draw skills range, explosionRadius.
var drawMode = gameConfig.DRAW_MODE_NORMAL;
//use when draw mode skill.
var mousePoint = {x : 0, y : 0};
var currentSkillData = null;

var characterType = 1;

var pyroLevel = 1, frosterLevel = 1, mysterLevel = 1;
var pyroBaseSkill = gameConfig.SKILL_INDEX_PYRO_BASE, pyroInherentPassiveSkill = gameConfig.SKILL_INDEX_PYRO_PASSIVE, pyroEquipSkills = new Array(4),
    frosterBaseSkill = gameConfig.SKILL_INDEX_FROST_BASE, frosterInherentPassiveSkill = gameConfig.SKILL_INDEX_FROST_PASSIVE, frosterEquipSkills = new Array(4),
    mysterBaseSkill = gameConfig.SKILL_INDEX_ARCANE_BASE, mysterInherentPassiveSkill = gameConfig.SKILL_INDEX_ARCANE_PASSIVE, mysterEquipSkills = new Array(4);

var userName = "";
var baseSkill = 0;
var baseSkillData = null;
var inherentPassiveSkill = 0;
var inherentPassiveSkillData = null;
var equipSkills = new Array(4);
var equipSkillDatas = new Array(4);
var possessSkills = [];

var killUser = null;
var loseResource = {gold : 0, jewel : 0};
var isLostSkill = false;
//state changer
function changeState(newState){
  clearInterval(drawInterval);
  clearInterval(userDataUpdateInterval);
  drawInterval = false;
  userDataUpdateInterval = false;

  switch (newState) {
    case gameConfig.GAME_STATE_LOAD:
      gameState = newState;
      gameSetupFunc = stateFuncLoad;
      gameUpdateFunc = stateFuncCheckLoad;
      break;
    case gameConfig.GAME_STATE_START_SCENE:
      gameState = newState;
      gameSetupFunc = null;
      gameUpdateFunc = stateFuncStandby;
      break;
    case gameConfig.GAME_STATE_GAME_START:
      gameState = newState;
      gameSetupFunc = stateFuncStart;
      gameUpdateFunc = null;
      break;
    case gameConfig.GAME_STATE_GAME_ON:
      gameState = newState;
      gameSetupFunc = stateFuncGameSetup;
      gameUpdateFunc = stateFuncGame;
      break;
    case gameConfig.GAME_STATE_END:
      gameState = newState;
      gameSetupFunc = stateFuncEnd;
      gameUpdateFunc = stateFuncGame;
      break;
    case gameConfig.GAME_STATE_RESTART_SCENE:
      gameState = newState;
      gameSetupFunc = null;
      gameUpdateFunc = stateFuncStandbyRestart;
      break;
    case gameConfig.GAME_STATE_RESTART:
      gameState = newState;
      gameSetupFunc = stateFuncRestart;
      gameUpdateFunc = null;
      break;
  }
  update();
};

function update(){
  // if(gameSetupFunc === null && gameUpdateFunc !== null){
  //   drawInterval = setInterval(gameUpdateFunc,fps);
  // }else if(gameSetupFunc !==null && gameUpdateFunc === null){
  //   gameSetupFunc();
  // }
  if(gameUpdateFunc){
    drawInterval = setInterval(gameUpdateFunc, fps);
  }
  if(gameSetupFunc){
    gameSetupFunc();
  }
};

//load resource, base setting
function stateFuncLoad(){
  setBaseSetting();
  setCanvasSize();
  window.oncontextmenu = function(){
    return false;
  };
  window.onresize = function(){
    setCanvasSize();
  };
  UIManager.setServerList();
  // window.onbeforeunload = function(e) {
  //    return 'Are you sure?';
  // };

  // UIManager.setSkillChangeBtn();
  // loadResources();
  // UIManager.setSkillIconResource(resourceSkillIcon);
};
function stateFuncCheckLoad(){
  if(isLoadResources && isUISettingComplete && Date.now() - loadingStartTime >= gameConfig.MINIMUM_LOADING_TIME
     && isLoadServerList){
    UIManager.startSceneLoadingComplete();
    changeState(gameConfig.GAME_STATE_START_SCENE);
  }else if(Date.now() - loadingTextChangeTime >= gameConfig.CHANGE_LOADING_TEXT_TIME){
    loadingTextChangeTime = Date.now();
    UIManager.changeLoadingText();
  }
};
//when all resource loaded. just draw start scene
function stateFuncStandby(){
  drawStartScene();
};
//if start button clicked, setting game before start game
//setup socket here!!! now changestates in socket response functions
function stateFuncStart(){
  UIManager.disableStartButton();

  var url = UIManager.getSelectedServer();
  // UIManager.disableStartScene();
  UIManager.checkServerCondition(url);
  if(isServerConditionGood){
    setupSocket(url);
    userName = UIManager.getStartUserName();
    socket.emit('reqStartGame', characterType, userName);
    userPingCheckTime = Date.now();
    socket.emit('firePing', userPingCheckTime);
  }else{
    UIManager.enableStartButton();
  }
};
//game play on
function stateFuncGameSetup(){
  UIManager.disableStartScene();
  // UIManager.disableRestartScene();
};
function stateFuncGame(){
  drawGame();
};
//show end message and restart button
function stateFuncEnd(){
  //should init variables
  var toLevel = 1;
  switch (characterType) {
    case gameConfig.CHAR_TYPE_FIRE:
      toLevel = pyroLevel;
      break;
    case gameConfig.CHAR_TYPE_FROST:
      toLevel = frosterLevel;
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      toLevel = mysterLevel;
      break;
    default:
  }

  canvasDisableEvent();
  documentDisableEvent();

  if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
    changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
  };
  UIManager.closePopUpSkillChange();
  // UIManager.updateSkills(changeSkills);

  updateCharTypeSkill(characterType);
  UIManager.playDeadScene(gameConfig.userID, killUser, toLevel, loseResource, isLostSkill);
  setTimeout(function(){
    UIManager.closePopUpSkillChange();
    UIManager.disableDeadScene();

    UIManager.initStandingScene(characterType, userName);
    UIManager.setPopUpSkillChange(true);

    changeState(gameConfig.GAME_STATE_RESTART_SCENE);
  }, gameConfig.DEAD_SCENE_PLAY_TIME);
};
function stateFuncStandbyRestart(){
  drawRestartScene();
}
function stateFuncRestart(){
  UIManager.disableStandingScene();
  userName = UIManager.getStandingUserName();
  socket.emit('reqRestartGame', userName, characterType, equipSkills);
};
//functions
function setBaseSetting(){
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  canvas.onfocusout = function(e){
    alert('focusout');
  }

  UIManager = new CUIManager(skillTable, buffGroupTable, iconResourceTable, userStatTable);
  UIManager.onLoadCompleteServerList = function(){
    isLoadServerList = true;
  };
  UIManager.serverConditionOn = function(){
    isServerConditionGood = true;
  };
  UIManager.serverConditionOff = function(){
    isServerConditionGood = false;
  }
  UIManager.onStartBtnClick = function(charType, clickButton){
    userLastActionTime = Date.now();
    characterType = charType;
    if(clickButton === gameConfig.START_BUTTON){
      changeState(gameConfig.GAME_STATE_GAME_START);
    }else if(clickButton === gameConfig.RESTART_BUTTON){
      changeState(gameConfig.GAME_STATE_RESTART);
    }
  };
  UIManager.onSkillUpgrade = function(skillIndex){
    userLastActionTime = Date.now();
    socket.emit('upgradeSkill', skillIndex);
  };
  UIManager.onExchangeSkill = function(charType){
    updateCharTypeSkill(charType);
  };
  UIManager.onExchangePassive = function(beforeBuffGID, afterBuffGID){
    socket.emit('exchangePassive', beforeBuffGID, afterBuffGID);
  };
  UIManager.onEquipPassive = function(buffGroupIndex){
    socket.emit('equipPassive', buffGroupIndex);
  };
  UIManager.onUnequipPassive = function(buffGroupIndex){
    socket.emit('unequipPassive', buffGroupIndex);
  };
  UIManager.onSkillIconClick = function(skillSlot){
    userLastActionTime = Date.now();
    if(skillSlot === gameConfig.SKILL_BASIC_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_BASIC_INDEX)){
      var skillData = objectAssign({}, baseSkillData);
      // }
    }else if(skillSlot === gameConfig.SKILL_EQUIP1_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP1_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[0]);
      // }
    }else if(skillSlot === gameConfig.SKILL_EQUIP2_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP2_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[1]);
      // }
    }else if(skillSlot === gameConfig.SKILL_EQUIP3_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP3_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[2]);
      // }
    }else if(skillSlot === gameConfig.SKILL_EQUIP4_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP4_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[3]);
      // }
    }
    checkSkillConditionAndUse(skillData);
  };
  UIManager.onSelectSkillCancelBtnClick = function(){
    changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
  };
  UIManager.onSelectCharIcon = function(type){
    userLastActionTime = Date.now();
    characterType = type;
    var level = 1;
    switch (type) {
      case gameConfig.CHAR_TYPE_FIRE:
        level = pyroLevel;
        baseSkill = pyroBaseSkill;
        for(var i=0; i<4; i++){
          equipSkills[i] = pyroEquipSkills[i]
        }
        inherentPassiveSkill = pyroInherentPassiveSkill;
        break;
      case gameConfig.CHAR_TYPE_FROST:
        level = frosterLevel;
        baseSkill = frosterBaseSkill;
        for(var i=0; i<4; i++){
          equipSkills[i] = frosterEquipSkills[i]
        }
        inherentPassiveSkill = frosterInherentPassiveSkill;
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        level = mysterLevel;
        baseSkill = mysterBaseSkill;
        for(var i=0; i<4; i++){
          equipSkills[i] = mysterEquipSkills[i]
        }
        inherentPassiveSkill = mysterInherentPassiveSkill;
        break;
      default:
    }
    baseSkillData = objectAssign({}, util.findData(skillTable, 'index', baseSkill));
    inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', inherentPassiveSkill));
    for(var i=0; i<4; i++){
      if(equipSkills[i]){
        equipSkillDatas[i] = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
      }else{
        equipSkillDatas[i] = undefined;
      }
    };
    UIManager.onPopUpSkillChangeClick = function(){
      userLastActionTime = Date.now();
    };
    UIManager.syncSkills(baseSkill, baseSkillData, equipSkills, equipSkillDatas, possessSkills, inherentPassiveSkill, inherentPassiveSkillData);
    UIManager.setPopUpSkillChange(true);
    UIManager.updateCharInfoSelectedPanel(type, level);
  };
  // UIManager.initStartScene();
  // UIManager.initHUD();
  // UIManager.initPopUpSkillChanger();

  document.body.onmousedown = function(e){
    if(e.button === 2){
      if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
        changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
      }
    }
  };

  // inner Modules
  util = require('../../modules/public/util.js');
  User = require('../../modules/client/CUser.js');
  CManager = require('../../modules/client/CManager.js');
  gameConfig = require('../../modules/public/gameConfig.json');

  Manager = new CManager(gameConfig);
  Manager.onSkillFire = onSkillFireHandler;
  Manager.onProjectileSkillFire = onProjectileSkillFireHandler;
  // Manager.onCancelCasting = onCancelCastingHandler;

  resourceObject = new Image()
  resourceCharacter = new Image();
  resourceUI = new Image();
  resourceSkillEffect = new Image();
  // resourceSkillIcon = new Image();

  userHandImgData[0] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_1));
  userHandImgData[1] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_2));
  userHandImgData[2] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_3));
  userHandImgData[3] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_4));
  userHandImgData[4] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_5));

  obstacleTreeInsideImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBSTACLE_TREE_INSIDE));

  objGoldImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_GOLD));
  objJewelImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_JEWEL));
  objBoxImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_BOX));
  objSkillFireImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_SKILL_FIRE));
  objSkillFrostImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_SKILL_FROST));
  objSkillArcaneImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_SKILL_ARCANE));

  castFireImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CASTING_FIRE));
  castFrostImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CASTING_FROST));
  castArcaneImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CASTING_ARCANE));

  projectileFireImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PROJECTILE_FIRE));
  projectileFrostImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PROJECTILE_FROST));
  projectileArcaneImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PROJECTILE_ARCANE));

  skillFireImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_SKILL_EFFECT_FIRE));
  skillFrostImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_SKILL_EFFECT_FROST));
  skillArcaneImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_SKILL_EFFECT_ARCANE));

  projectileSkillArrowImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PROJECTILE_SKILL_ARROW));
  // conditionFreezeImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_FREEZE));
  // conditionChillImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_CHILL));
  // conditionImmortalImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IMMORTAL));
  // conditionSilenceImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_SILENCE));
  // conditionIgnite1ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE1));
  // conditionIgnite2ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE2));
  // conditionIgnite3ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE3));
  // conditionIgnite4ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE4));
  // conditionIgnite5ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE5));
  // grid = new Image();
  // grid.src = resources.GRID_SRC;
  loadResources();
  UIManager.setSkillIconResource(resourceUI);
  UIManager.initStartScene();
  UIManager.initHUD();
  UIManager.initPopUpSkillChanger();
  UIManager.setSkillChangeBtn();
  isUISettingComplete = true;
};
function loadResources(){
  resourceObject.src = gameConfig.RESOURCE_SRC_OBJECT;
  resourceObject.onload = loadResourceHandler;
  resourceCharacter.src = gameConfig.RESOURCE_SRC_CHARACTER;
  resourceCharacter.onload = loadResourceHandler;
  resourceSkillEffect.src = gameConfig.RESOURCE_SRC_SKILL_EFFECT;
  resourceSkillEffect.onload = loadResourceHandler;
  resourceUI.src = gameConfig.RESOURCE_SRC_UI;
  resourceUI.onload = loadResourceHandler;
};
function loadResourceHandler(){
  loadedResourcesCount++;
  if(loadedResourcesCount >= gameConfig.RESOURCES_COUNT){
    isLoadResources = true;
    // changeState(gameConfig.GAME_STATE_START_SCENE);
  }
};
function onSkillFireHandler(rawSkillData, syncFireTime){
  var skillData = Manager.processSkillData(rawSkillData);
  skillData.syncFireTime = syncFireTime;

  UIManager.applySkill(skillData.skillIndex);
  socket.emit('skillFired', skillData);
};
function onProjectileSkillFireHandler(rawProjectileDatas, syncFireTime){
  var projectileDatas = Manager.processProjectileData(rawProjectileDatas);

  UIManager.applySkill(projectileDatas[0].skillIndex);
  socket.emit('projectilesFired', projectileDatas, syncFireTime);
};
// function onCancelCastingHandler(){
//   var userData = Manager.processUserData();
//   socket.emit('castCanceled', userData);
// };
function setCanvasSize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  gameConfig.canvasSize = {width : window.innerWidth, height : window.innerHeight};
  setCanvasScale(gameConfig);
};

function drawStartScene(){
  UIManager.drawStartScene();
};

function drawGame(){
  UIManager.drawGameScene();

  gameConfig.userOffset = calcOffset();

  drawScreen();
  drawBackground();
  drawGrid();
  drawObjs();
  drawUserEffect();
  drawUsers();
  // drawChests();
  // drawProjectile();
  drawObstacles();
  drawEffect();
  // drawRiseText();
  if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
    drawSkillRange();
  }
};

function drawRestartScene(){
  UIManager.drawRestartScene();
};

// socket connect and server response configs
function setupSocket(url){
  socket = io(url, { forceNew: false });

  socket.on('connect', function(){
    console.log('connection to the server');
  });
  socket.on('disconnect', function(){
    console.log('disconnected');
    window.onbeforeunload = '';
    window.location.href = "http://localhost/error"
    // changeState(gameConfig.GAME_STATE_RESTART_SCENE);
  });
  socket.on('firePong', function(date, serverDate){
    latency = Date.now() - date;
    timeDiff = Date.now() - (serverDate + latency/2);
    socket.emit('updateUserTimeDiff', Date.now(), latency);
  });
  socket.on('syncAndSetSkills', function(user){
    //synchronize user
    var startTime = Date.now();
    gameConfig.userID = user.objectID;
    // gameConfig.userOffset = util.calculateOffset(user, gameConfig.canvasSize);

    baseSkill = user.baseSkill;
    baseSkillData = objectAssign({}, util.findData(skillTable, 'index', user.baseSkill));
    inherentPassiveSkill = user.inherentPassiveSkill;
    inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', user.inherentPassiveSkill));
    for(var i=0; i<4; i++){
      if(user.equipSkills[i]){
        equipSkills[i] = user.equipSkills[i];
      }else{
        equipSkills[i] = undefined;
      }
    }
    for(var i=0; i<4; i++){
      if(user.equipSkills[i]){
        equipSkillDatas[i] = objectAssign({}, util.findData(skillTable, 'index', user.equipSkills[i]));
      }else{
        equipSkillDatas[i] = undefined;
      }
    };

    possessSkills = user.possessSkills;

    UIManager.syncSkills(baseSkill, baseSkillData, equipSkills, equipSkillDatas, possessSkills, inherentPassiveSkill, inherentPassiveSkillData);
    UIManager.setHUDSkills();
    UIManager.updateBuffIcon();
    UIManager.setHUDStats(user);
    UIManager.updateCondition(user.conditions);
    UIManager.setCooldownReduceRate(user.cooldownReduceRate);
    UIManager.setPopUpSkillChange();

    UIManager.setUserPosition(user.position);
  });

  //change state game on
  socket.on('resStartGame', function(userDatas, buffDatas, objDatas, chestDatas){
    Manager.start(userStatTable, resourceTable, obstacleTable);
    Manager.setUsers(userDatas);
    for(var i=0; i<buffDatas.length; i++){
      updateUserBuff(buffDatas[i]);
    }
    // Manager.setUsersSkills(skillDatas);
    // Manager.setProjectiles(projectileDatas);
    Manager.setObjs(objDatas);
    Manager.setChests(chestDatas);

    Manager.synchronizeUser(gameConfig.userID);
    Manager.onMainUserMove = function(user){
      UIManager.updateUserPosition(user.position);
    }
    var chestLocationDatas = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));

    UIManager.setBoard(userDatas, gameConfig.userID);
    UIManager.setMiniMapChests(chestDatas, chestLocationDatas);
    // console.log(Manager.users);

    canvasAddEvent();
    documentAddEvent();

    changeState(gameConfig.GAME_STATE_GAME_ON);
    userDataUpdateInterval = setInterval(updateUserDataHandler, INTERVAL_TIMER);
  });
  socket.on('resRestartGame', function(userData, rankDatas){
    Manager.iamRestart(userData);
    Manager.updateUserData(userData);
    Manager.changeUserStat(userData, true);
    UIManager.updateCondition(userData.conditions);
    UIManager.updateMP(userData)
    UIManager.checkSkillsConditions();

    canvasAddEvent();
    documentAddEvent();

    baseSkill = userData.baseSkill;
    baseSkillData = objectAssign({}, util.findData(skillTable, 'index', userData.baseSkill));
    inherentPassiveSkill = userData.inherentPassiveSkill;
    inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', userData.inherentPassiveSkill));

    switch (characterType) {
      case gameConfig.CHAR_TYPE_FIRE:
        for(var i=0; i<4; i++){
          equipSkills[i] = pyroEquipSkills[i];
        }
        break;
      case gameConfig.CHAR_TYPE_FROST:
        for(var i=0; i<4; i++){
          equipSkills[i] = frosterEquipSkills[i];
        }
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        for(var i=0; i<4; i++){
          equipSkills[i] = mysterEquipSkills[i];
        }
        break;
    }

    for(var i=0; i<4; i++){
      if(equipSkills[i]){
        equipSkillDatas[i] = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
      }else{
        equipSkillDatas[i] = undefined;
      }
    };

    possessSkills = userData.possessSkills;

    UIManager.syncSkills(baseSkill, baseSkillData, equipSkills, equipSkillDatas, possessSkills, inherentPassiveSkill, inherentPassiveSkillData);
    UIManager.setHUDSkills();
    // UIManager.updateBuffIcon();
    UIManager.setHUDStats(userData);
    UIManager.setCooldownReduceRate(userData.cooldownReduceRate);
    UIManager.setPopUpSkillChange();
    UIManager.updateBoard(rankDatas, gameConfig.userID);
    UIManager.updateHP(userData);
    UIManager.updateMP(userData);

    changeState(gameConfig.GAME_STATE_GAME_ON);
    userDataUpdateInterval = setInterval(updateUserDataHandler, INTERVAL_TIMER);
  });
  socket.on('userJoined', function(data, rankDatas){
    data.imgData = Manager.setImgData(data);
    Manager.setUser(data);
    UIManager.updateBoard(rankDatas, gameConfig.userID);
    console.log('user joined ' + data.objectID);
  });
  socket.on('userDataUpdate', function(userData){
    Manager.updateUserData(userData);
  });
  socket.on('userDataSync', function(userData){
    Manager.syncUserData(userData);
  });
  socket.on('userMoveAndAttack', function(userData){
    var skillData = objectAssign({}, util.findData(skillTable, 'index', userData.skillIndex));
    skillData.targetPosition = userData.skillTargetPosition;
    Manager.moveAndAttackUser(userData.objectID, userData.targetPosition, skillData, userData.moveBackward);
  });
  socket.on('userDataUpdateAndUseSkill', function(userData){
    Manager.updateUserData(userData);

    var skillData = objectAssign({}, util.findData(skillTable, 'index', userData.skillIndex));

    Manager.applyCastSpeed(userData.objectID, skillData);
    skillData.targetPosition = userData.skillTargetPosition;
    skillData.direction = userData.skillDirection;
    if(skillData.type === gameConfig.SKILL_TYPE_PROJECTILE ||
       skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK ||
       skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION ||
       skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION ||
       skillData.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
      skillData.projectileIDs = userData.skillProjectileIDs;
    }
    Manager.useSkill(userData.objectID, skillData);
  });
  socket.on('skillFired', function(data, userID){
    var clientSyncFireTime = data.syncFireTime + timeDiff;
    var timeoutTime = clientSyncFireTime - Date.now();
    if(timeoutTime < 0){
      timeoutTime = 0;
    }
    setTimeout(function(){
      var skillData = objectAssign({}, util.findData(skillTable, 'index', data.skillIndex));
      skillData.targetPosition = data.skillTargetPosition;
      if(skillData.explosionEffectGroup){
        var effectImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillData.explosionEffectGroup));
        util.setResourceData(resourceTable, effectImgData);
      }
      // if(userID === gameConfig.userID){
      //   UIManager.applySkill(skillData.index);
      // }
      Manager.applySkill(skillData, userID, effectImgData);
    }, timeoutTime);
  });
  socket.on('projectilesFired', function(datas, syncFireTime, userID){
    var clientSyncFireTime = syncFireTime + timeDiff;
    var timeoutTime = clientSyncFireTime - Date.now();
    if(timeoutTime < 0){
      timeoutTime = 0;
    }
    setTimeout(function(){
      for(var i=0; i<datas.length; i++){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', datas[i].skillIndex));
        skillData.userID = userID;
        skillData.objectID = datas[i].objectID;
        skillData.position = datas[i].position;
        skillData.speed = datas[i].speed;
        skillData.startTime = Date.now();

        // if(userID == gameConfig.userID){
        //   UIManager.applySkill(skillData.index);
        // }
        if(skillData.projectileEffectGroup){
          var projectileImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillData.projectileEffectGroup));
          util.setResourceData(resourceTable, projectileImgData);
        }
        if(skillData.explosionEffectGroup){
          var effectImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillData.explosionEffectGroup));
          util.setResourceData(resourceTable, effectImgData);
        }
        Manager.applyProjectile(skillData, projectileImgData, effectImgData);
      }
    }, timeoutTime);
  });
  socket.on('upgradeSkill', function(beforeSkillIndex, afterSkillIndex, resourceData){
    UIManager.setResource(resourceData);
    if(beforeSkillIndex === baseSkill){
      baseSkill = afterSkillIndex;
      baseSkillData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));
      UIManager.upgradeBaseSkill(baseSkill, baseSkillData);
    }else if(beforeSkillIndex === inherentPassiveSkill){
      inherentPassiveSkill = afterSkillIndex;
      inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));
      UIManager.upgradeInherentSkill(inherentPassiveSkill, inherentPassiveSkillData);
    }else{
      for(var i=0; i<4; i++){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));
        if(equipSkills[i] === beforeSkillIndex){
          equipSkills.splice(i, 1, afterSkillIndex);
          equipSkillDatas.splice(i, 1, skillData);
        }
        if(pyroEquipSkills[i] === beforeSkillIndex){
          pyroEquipSkills.splice(i, 1, afterSkillIndex);
        }
        if(frosterEquipSkills[i] === beforeSkillIndex){
          frosterEquipSkills.splice(i, 1, afterSkillIndex);
        }
        if(mysterEquipSkills[i] === beforeSkillIndex){
          mysterEquipSkills.splice(i, 1, afterSkillIndex);
        }
      }
      for(var i=0; i<possessSkills.length; i++){
        if(possessSkills[i] === beforeSkillIndex){
          possessSkills.splice(i, 1, afterSkillIndex);
          UIManager.upgradePossessionSkill(beforeSkillIndex, afterSkillIndex);
          break;
        }
      }
    }
    UIManager.playSkillUpgradeEffect();
    updateCharTypeSkill(characterType);
  });
  socket.on('updateUserPrivateStat', function(statData){
    UIManager.setHUDStats(statData);
    UIManager.setCooldownReduceRate(statData.cooldownReduceRate);
  });
  socket.on('deleteProjectile', function(projectileID, userID){
    Manager.deleteProjectile(projectileID, userID);
  });
  socket.on('explodeProjectile', function(projectileID, userID, position){
    Manager.explodeProjectile(projectileID, userID, position);
  });
  // socket.on('castCanceled', function(userID){
  //   Manager.cancelCasting(userID);
  // });
  socket.on('createOBJs', function(objDatas){
    Manager.createOBJs(objDatas);
  });
  socket.on('deleteOBJ', function(objID){
    Manager.deleteOBJ(objID);
  });
  socket.on('createChest', function(chestData){
    console.log(chestData);
    Manager.createChest(chestData);
    UIManager.createChest(chestData.locationID, chestData.grade);
  });
  socket.on('chestDamaged', function(locationID, HP){
    Manager.updateChest(locationID, HP);
    if(hittedChest.indexOf(locationID)){
      hittedChest.push(locationID);
      setTimeout(function(){
        var index = hittedChest.indexOf(locationID);
        hittedChest.splice(index, 1);
      }, gameConfig.SKILL_HIT_EFFECT_TIME);
    }
  });
  socket.on('deleteChest', function(locationID){
    Manager.deleteChest(locationID);
    UIManager.deleteChest(locationID);
  });
  socket.on('getResource', function(resourceData, addResource){
    // var beforeGold = UIManager.getUserGold();
    // var beforeJewel = UIManager.getUserJewel();

    UIManager.makeRisingMessage(addResource);
    UIManager.setResource(resourceData);

    // var afterGold = UIManager.getUserGold();
    // var afterJewel = UIManager.getUserJewel();
    // var center = Manager.getUserCenter(gameConfig.userID);
    // if(afterGold > beforeGold){
    //   Manager.addRiseText('Gold ' + (afterGold - beforeGold), 'rgb(255, 255, 0)', center);
    // }
    // if(afterJewel > beforeJewel){
    //   Manager.addRiseText('Jewel ' + (afterJewel - beforeJewel), 'rgb(0, 255, 255)', center);
    // }
  });
  socket.on('getSkill', function(skillIndex){
    var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
    UIManager.makeRisingMessageForSkill(skillData, false);
  });
  socket.on('skillChangeToResource', function(skillIndex){
    var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
    UIManager.addResource(skillData.exchangeToGold, skillData.exchangeToJewel);
    UIManager.makeRisingMessageForSkill(skillData, true);
  });
  socket.on('changeUserStat', function(userData, addResource){
    if(userData.objectID === gameConfig.userID){
      UIManager.updateCondition(userData.conditions);
      UIManager.updateMP(userData);
      UIManager.checkSkillsConditions();
      if(addResource){
        UIManager.makeRisingMessage(addResource);
      }
      // var beforeHP = Manager.getUserHP(userData.objectID);
      // var beforeExp = Manager.getUserExp(userData.objectID);
    }
    Manager.changeUserStat(userData);
    if(userData.objectID === gameConfig.userID){
      UIManager.updateHP(userData);
      UIManager.updateMP(userData);

      var needExp = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', characterType, 'level', userData.level)).needExp;
      UIManager.updateExp(userData, needExp);
    }
    // if(userData.objectID === gameConfig.userID){
    //   var afterHP = Manager.getUserHP(userData.objectID);
    //   var afterExp = Manager.getUserExp(userData.objectID);
    //   var userCenter = Manager.getUserCenter(userData.objectID);
    //   if(userCenter){
    //     if(beforeHP !== afterHP){
    //       Manager.addRiseText('HP ' + (afterHP - beforeHP), 'rgb(0, 0, 255)', userCenter);
    //     }
    //     if(afterExp > beforeExp){
    //       Manager.addRiseText('EXP ' + (afterExp - beforeExp), 'rgb(255, 255, 0)', userCenter);
    //     }
    //   }
    // }
  });
  socket.on('userDamaged', function(userData, skillIndex){
    if(skillIndex){
      var skillImgDataIndex = objectAssign({}, util.findData(skillTable, 'index', skillIndex)).hitEffectGroup;
      var skillImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillImgDataIndex));
      var hasResource = util.setResourceData(resourceTable, skillImgData);
      if(hasResource){
        Manager.updateSkillHitImgData(userData.objectID, skillImgData);
      }
    }
    Manager.changeUserStat(userData);
    if(userData.objectID === gameConfig.userID){
      UIManager.updateHP(userData);
      UIManager.updateMP(userData);
      UIManager.updateCondition(userData.conditions);
      UIManager.checkSkillsConditions();
    }
  });
  socket.on('updateBuff', function(buffData){
    if(buffData.objectID === gameConfig.userID){
      UIManager.updateBuffIcon(buffData.passiveList, buffData.buffList);
    }
    updateUserBuff(buffData);
    //set buffImg data
    // var buffImgDataList = [];
    //
    // var buffGroupData = objectAssign({}, util.findData(skillTable, 'index', buffData.inherentPassive)).buffToSelf
    // var buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupData)).buffEffectGroup;
    // var buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    // var hasResource = util.setResourceData(resourceTable, buffImgData);
    // if(hasResource){
    //   buffImgDataList.push(buffImgData);
    // }
    // for(var i=0; i<buffData.buffList.length; i++){
    //   buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.buffList[i].index)).buffEffectGroup;
    //   buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    //   hasResource = util.setResourceData(resourceTable, buffImgData);
    //   if(hasResource){
    //     buffImgDataList.push(buffImgData);
    //   }
    // }
    // for(var i=0; i<buffData.passiveList.length; i++){
    //   buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.passiveList[i])).buffEffectGroup;
    //   buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    //   hasResource = util.setResourceData(resourceTable, buffImgData);
    //   if(hasResource){
    //     buffImgDataList.push(buffImgData);
    //   }
    // }
    // Manager.updateUserBuffImgData(buffData.objectID, buffImgDataList);
  });
  socket.on('updateSkillPossessions', function(possessSkillIndexes){
    Manager.updateSkillPossessions(gameConfig.userID, possessSkillIndexes);
    var newSkills = [];
    if(possessSkills.length !== possessSkillIndexes.length){
      for(var i=0; i<possessSkillIndexes.length; i++){
        // if(!possessSkills.includes(possessSkillIndexes[i])){
        // if(!util.includes(possessSkills, possessSkillIndexes[i]))){
        if(possessSkills.indexOf(possessSkillIndexes[i]) === -1 ){
          newSkills.push(possessSkillIndexes[i]);
        }
      }
    }
    possessSkills = possessSkillIndexes;
    if(newSkills.length){
      UIManager.updateNewSkills(newSkills);
    }
    UIManager.updatePossessionSkills(possessSkills);
    UIManager.setPopUpSkillChange();
  });
  socket.on('updateRank', function(rankDatas){
    UIManager.updateBoard(rankDatas, gameConfig.userID);
  });
  socket.on('chatting', function(userID, msg){
    Manager.setUserChatMsg(userID, msg);
  });
  socket.on('userDead', function(attackUserInfo, deadUserInfo, scoreDatas, levelDatas, loseResources, changeSkills){
    UIManager.updateKillBoard(attackUserInfo, deadUserInfo);
    if(deadUserInfo.userID === gameConfig.userID){
      Manager.iamDead();

      pyroLevel = levelDatas.pyroLevel;
      frosterLevel = levelDatas.frosterLevel;
      mysterLevel = levelDatas.mysterLevel;

      killUser = attackUserInfo.userID;
      loseResource = {gold : loseResources.goldLoseAmount, jewel : loseResources.jewelLoseAmount};
      if(changeSkills){
        updateSkills(changeSkills);
        isLostSkill = true;
      }else{
        isLostSkill = false;
      }
      changeState(gameConfig.GAME_STATE_END);
    }
    Manager.kickUser(deadUserInfo.userID);
    UIManager.updateBoard(scoreDatas, gameConfig.userID);
  });
  socket.on('userLeave', function(objID, rankDatas){
    Manager.kickUser(objID);
    UIManager.updateBoard(rankDatas, gameConfig.userID);
  });
};

//draw
function drawScreen(){
  //draw background
  ctx.fillStyle = "rgb(103, 124, 81)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};
function drawObstacles(){
  var clearImg = false;
  if(Date.now() - collisionClearTime >= gameConfig.IMG_COLLISION_CLEAR_TIME){
    clearImg = true;
    collisionClearTime = Date.now();
  }

  //draw rock and chestGround
  for(var i=0; i<Manager.obstacles.length - Manager.treesCount; i++){
    var center = util.worldToLocalPosition(Manager.obstacles[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(util.isObjInCanvas(center, Manager.obstacles[i].imgData.width/2, gameConfig)){
      ctx.drawImage(resourceObject, Manager.obstacles[i].imgData.srcPosX, Manager.obstacles[i].imgData.srcPosY, Manager.obstacles[i].imgData.srcWidth, Manager.obstacles[i].imgData.srcHeight,
                    center.x - (Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, center.y - (Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
      if(Manager.obstacles[i].staticEle.isCollide){
        //draw hitMask
        ctx.beginPath();
        ctx.arc(center.x, center.y, Manager.obstacles[i].imgData.width/2 * 0.9 * gameConfig.scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fill();
        ctx.closePath();
      }
      if(clearImg){
        Manager.obstacles[i].staticEle.isCollide = false;
      }
    }
  }

  drawProjectile();
  drawChests();

  //draw trees
  for(var i=Manager.obstacles.length - Manager.treesCount; i<Manager.obstacles.length; i++){
    var center = util.worldToLocalPosition(Manager.obstacles[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(util.isObjInCanvas(center, Manager.obstacles[i].imgData.width/2, gameConfig)){
      if(Manager.obstacles[i].treeImgEle.isCollide){
        ctx.drawImage(resourceObject, obstacleTreeInsideImgData.srcPosX, obstacleTreeInsideImgData.srcPosY, obstacleTreeInsideImgData.srcWidth, obstacleTreeInsideImgData.srcHeight,
          center.x - (Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, center.y - (Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
      }else{
        ctx.drawImage(resourceObject, Manager.obstacles[i].imgData.srcPosX, Manager.obstacles[i].imgData.srcPosY, Manager.obstacles[i].imgData.srcWidth, Manager.obstacles[i].imgData.srcHeight,
          center.x - (Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, center.y - (Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
      }
      if(clearImg){
        Manager.obstacles[i].treeImgEle.isCollide = false;
      }
      if(Manager.obstacles[i].staticEle.isCollide){
        //draw hitMask
        ctx.beginPath();
        ctx.arc(center.x, center.y, Manager.obstacles[i].imgData.width/2 * 0.9 * gameConfig.scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fill();
        ctx.closePath();
      }
      if(clearImg){
        Manager.obstacles[i].staticEle.isCollide = false;
      }
    }
  }


  // for(var i=0; i<Manager.obstacles.length; i++){
  //   var center = util.worldToLocalPosition(Manager.obstacles[i].center, gameConfig.userOffset);
  //   if(Manager.obstacles[i].treeImgEle){
  //     //if user is inside of tree;
  //     if(Manager.obstacles[i].treeImgEle.isCollide){
  //       ctx.drawImage(resourceObject, obstacleTreeInsideImgData.srcPosX, obstacleTreeInsideImgData.srcPosY, obstacleTreeInsideImgData.srcWidth, obstacleTreeInsideImgData.srcHeight,
  //         (center.x - Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, (center.y - Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
  //     }else{
  //       ctx.drawImage(resourceObject, Manager.obstacles[i].imgData.srcPosX, Manager.obstacles[i].imgData.srcPosY, Manager.obstacles[i].imgData.srcWidth, Manager.obstacles[i].imgData.srcHeight,
  //         (center.x - Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, (center.y - Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
  //     }
  //     if(clearImg){
  //       Manager.obstacles[i].treeImgEle.isCollide = false;
  //     }
  //   }else{
  //     ctx.drawImage(resourceObject, Manager.obstacles[i].imgData.srcPosX, Manager.obstacles[i].imgData.srcPosY, Manager.obstacles[i].imgData.srcWidth, Manager.obstacles[i].imgData.srcHeight,
  //       (center.x - Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, (center.y - Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
  //   }
  //   if(Manager.obstacles[i].staticEle.isCollide){
  //     //draw hitMask
  //     ctx.beginPath();
  //     ctx.arc(center.x * gameConfig.scaleFactor, center.y * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width/2 * 0.9 * gameConfig.scaleFactor, 0, 2 * Math.PI);
  //     ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
  //     ctx.fill();
  //     ctx.closePath();
  //   }
  //   if(clearImg){
  //     Manager.obstacles[i].staticEle.isCollide = false;
  //   }
  // }
};
function drawChests(){
  // ctx.fillStyle = "#00ff00";
  for(var i=0; i<Manager.chests.length; i++){
    ctx.beginPath();
    var center = util.worldToLocalPosition(Manager.chests[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    ctx.drawImage(resourceObject, Manager.chests[i].imgData.srcPosX, Manager.chests[i].imgData.srcPosY, Manager.chests[i].imgData.srcWidth, Manager.chests[i].imgData.srcHeight,
                  center.x - (Manager.chests[i].imgData.width/2) * gameConfig.scaleFactor, center.y - (Manager.chests[i].imgData.height/2) * gameConfig.scaleFactor, Manager.chests[i].imgData.width * gameConfig.scaleFactor, Manager.chests[i].imgData.height * gameConfig.scaleFactor);
    if(hittedChest.indexOf(Manager.chests[i].locationID) !== -1){
      var pos = util.worldToLocalPosition(Manager.chests[i].position, gameConfig.userOffset, gameConfig.scaleFactor);
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
      ctx.fillRect(pos.x, (pos.y - 2.5), Manager.chests[i].imgData.width * 0.85 * gameConfig.scaleFactor, Manager.chests[i].imgData.height * 0.85 * gameConfig.scaleFactor);
    }
    // var pos = util.worldToLocalPosition(Manager.chests[i].position, gameConfig.userOffset);
    // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor,
    //               Manager.chests[i].size.width * gameConfig.scaleFactor, Manager.chests[i].size.height * gameConfig.scaleFactor);

    ctx.fillStyle = "#ff0000";
    var width = Manager.chests[i].HP / Manager.chests[i].maxHP * 85 * gameConfig.scaleFactor;
    var height = 10 * gameConfig.scaleFactor;
    var centerX = center.x - 42.5 * gameConfig.scaleFactor;
    var centerY = center.y + 60 * gameConfig.scaleFactor;
    ctx.fillRect(centerX, centerY, width, height);

    ctx.strokeStyle = "#000000";
    width = 85 * gameConfig.scaleFactor;
    ctx.strokeRect(centerX, centerY, width, height);
    ctx.closePath();
  }
};
function drawObjs(){
  // var objGoldImgData, objJewelImgData, objSkillFireImgData, objSkillFrostImgData, objSkillArcaneImgData;

  for(var i=0; i<Manager.objGolds.length; i++){
    var posX = util.worldXCoordToLocalX(Manager.objGolds[i].position.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    var posY = util.worldYCoordToLocalY(Manager.objGolds[i].position.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    ctx.drawImage(resourceObject, objGoldImgData.srcPosX, objGoldImgData.srcPosY, objGoldImgData.srcWidth, objGoldImgData.srcHeight, posX, posY, Manager.objGolds[i].radius * 2 * gameConfig.scaleFactor, Manager.objGolds[i].radius * 2 * gameConfig.scaleFactor);
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.objGolds[i].radius * gameConfig.scaleFactor, 0, 2 * Math.PI);
    // var pos = util.worldToLocalPosition(Manager.objSkills[i].position, gameConfig.userOffset);
    // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor);
  }
  for(var i=0; i<Manager.objJewels.length; i++){
    posX = util.worldXCoordToLocalX(Manager.objJewels[i].position.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    posY = util.worldYCoordToLocalY(Manager.objJewels[i].position.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    ctx.drawImage(resourceObject, objJewelImgData.srcPosX, objJewelImgData.srcPosY, objJewelImgData.srcWidth, objJewelImgData.srcHeight, posX, posY, Manager.objJewels[i].radius * 2 * gameConfig.scaleFactor, Manager.objJewels[i].radius * 2 * gameConfig.scaleFactor);
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.objJewels[i].radius * gameConfig.scaleFactor, 0, 2 * Math.PI);
    // var pos = util.worldToLocalPosition(Manager.objSkills[i].position, gameConfig.userOffset);
    // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor);
  }
  // for(var i=0; i<Manager.objExps.length; i++){
  //   ctx.beginPath();
  //   var centerX = util.worldXCoordToLocalX(Manager.objExps[i].position.x + Manager.objExps[i].radius, gameConfig.userOffset.x);
  //   var centerY = util.worldYCoordToLocalY(Manager.objExps[i].position.y + Manager.objExps[i].radius, gameConfig.userOffset.y);
  //   ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.objExps[i].radius * gameConfig.scaleFactor, 0, 2 * Math.PI);
  //   ctx.fill();
  //   // var pos = util.worldToLocalPosition(Manager.objExps[i].position, gameConfig.userOffset);
  //   // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor, Manager.objExps[i].radius * 2 * gameConfig.scaleFactor, Manager.objExps[i].radius * 2 * gameConfig.scaleFactor);
  //   ctx.closePath();
  // };
  for(var i=0; i<Manager.objBoxs.length; i++){
    posX = util.worldXCoordToLocalX(Manager.objBoxs[i].position.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    posY = util.worldYCoordToLocalY(Manager.objBoxs[i].position.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    ctx.drawImage(resourceObject, objBoxImgData.srcPosX, objBoxImgData.srcPosY, objBoxImgData.srcWidth, objBoxImgData.srcHeight, posX, posY, Manager.objBoxs[i].radius * 2 * gameConfig.scaleFactor, Manager.objBoxs[i].radius * 2 * gameConfig.scaleFactor);
  }
  for(var i=0; i<Manager.objSkills.length; i++){
    posX = util.worldXCoordToLocalX(Manager.objSkills[i].position.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    posY = util.worldYCoordToLocalY(Manager.objSkills[i].position.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    switch (Manager.objSkills[i].property) {
      case gameConfig.SKILL_PROPERTY_FIRE:
        var skillImgData = objSkillFireImgData;
        break;
      case gameConfig.SKILL_PROPERTY_FROST:
        skillImgData = objSkillFrostImgData;
        break;
      case gameConfig.SKILL_PROPERTY_ARCANE:
        skillImgData = objSkillArcaneImgData;
        break;
      default:
    }
    ctx.drawImage(resourceObject, skillImgData.srcPosX, skillImgData.srcPosY, skillImgData.srcWidth, skillImgData.srcHeight, posX, posY, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor);
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.objSkills[i].radius * gameConfig.scaleFactor, 0, 2 * Math.PI);
    // var pos = util.worldToLocalPosition(Manager.objSkills[i].position, gameConfig.userOffset);
    // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor);
  }
};
function drawUserEffect(){
  for(var i=0; i<Manager.userEffects.length; i++){
    var imgData = Manager.userEffects[i]['resourceIndex' + (Manager.userEffects[i].effectIndex + 1)];
    var center = util.worldToLocalPosition(Manager.userEffects[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                  center.x - (imgData.width/2) * gameConfig.scaleFactor, center.y - (imgData.height/2) * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
  }
};
function drawUsers(){
  for(var index in Manager.users){
    // if(Manager.users[index].conditions[gameConfig.USER_CONDITION_BLUR]){
    //   if(index === gameConfig.userID){
    //     ctx.globalAlpha = 0.6;
    //   }else{
    //     ctx.globalAlpha = 0.3;
    //   }
    // }else{
    //   ctx.globalAlpha = 1;
    // }
    ctx.save();
    // ctx.setTransform(1,0,0,1,0,0);
    var center = util.worldToLocalPosition(Manager.users[index].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(util.isObjInCanvas(center, Manager.users[index].size.width/2, gameConfig)){
      var radian = Manager.users[index].direction * radianFactor;
      ctx.translate(center.x, center.y);
      ctx.rotate(radian);
      // var posX = util.worldXCoordToLocalX(Manager.users[index].position.x, gameConfig.userOffset.x);
      // var posY = util.worldYCoordToLocalY(Manager.users[index].position.y, gameConfig.userOffset.y);
      //draw passive and buff effect
      for(var i=0; i<Manager.users[index].buffImgDataList.length; i++){
        if(!Manager.users[index].buffImgDataList[i].isFront){
          if(Manager.users[index].buffImgDataList[i].isAttach){
            var imgIndex = Manager.users[index].effectIndex % Manager.users[index].buffImgDataList[i].resourceLength + 1;
            var imgData = Manager.users[index].buffImgDataList[i]['resourceIndex' + imgIndex];
            if(Manager.users[index].buffImgDataList[i].isRotate){
              ctx.restore();
              ctx.save();
              ctx.translate(center.x, center.y);
              var effectRadian = (Manager.users[index].buffImgDataList[i].rotateStartDegree + Manager.users[index].effectRotateDegree) * radianFactor;
              ctx.rotate(effectRadian);
              ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
              ctx.restore();
              ctx.save();
              ctx.translate(center.x, center.y);
              ctx.rotate(radian);
            }else{
              ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
            }
          }
        }
      }
      //draw Hand
      var imgData = userHandImgData[Manager.users[index].imgHandIndex];
      ctx.drawImage(resourceCharacter, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
        -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
      //draw body
      ctx.drawImage(resourceCharacter, Manager.users[index].imgData.srcPosX, Manager.users[index].imgData.srcPosY, Manager.users[index].imgData.srcWidth, Manager.users[index].imgData.srcHeight,
        -Manager.users[index].imgData.width/2 * gameConfig.scaleFactor, -Manager.users[index].imgData.height/2 * gameConfig.scaleFactor, Manager.users[index].imgData.width *gameConfig.scaleFactor, Manager.users[index].imgData.height * gameConfig.scaleFactor);

        // draw cast effect
      if(Manager.users[index].skillCastEffectPlay){
        // ctx.fillStyle ="#00ff00";
        if(Manager.users[index].currentSkill){
          switch (Manager.users[index].currentSkill.property) {
            case gameConfig.SKILL_PROPERTY_FIRE:
            var imgData = castFireImgData;
            break;
            case gameConfig.SKILL_PROPERTY_FROST:
            imgData = castFrostImgData;
            break;
            case gameConfig.SKILL_PROPERTY_ARCANE:
            imgData = castArcaneImgData;
            break;
            default:
          }
          var scaleFactor = Manager.users[index].castEffectFactor;
          ctx.drawImage(resourceCharacter, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
            -imgData.width/2 * gameConfig.scaleFactor * scaleFactor, -imgData.height/2 * gameConfig.scaleFactor * scaleFactor, imgData.width * gameConfig.scaleFactor * scaleFactor, imgData.height * gameConfig.scaleFactor * scaleFactor);
        }
      }
      for(var i=0; i<Manager.users[index].hitImgDataList.length; i++){
        if(Manager.users[index].hitImgDataList[i].isAttach){
          var imgIndex = Manager.users[index].effectIndex % Manager.users[index].hitImgDataList[i].resourceLength + 1;
          var imgData = Manager.users[index].hitImgDataList[i]['resourceIndex' + imgIndex];
          if(Manager.users[index].hitImgDataList[i].isRotate){
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            var effectRadian = (Manager.users[index].hitImgDataList[i].rotateStartDegree + Manager.users[index].effectRotateDegree) * radianFactor;
            ctx.rotate(effectRadian);
            ctx.drawImage(resourceCharacter, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(radian);
          }else{
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
          }
        }
      }
      for(var i=0; i<Manager.users[index].buffImgDataList.length; i++){
        if(Manager.users[index].buffImgDataList[i].isFront){
          if(Manager.users[index].buffImgDataList[i].isAttach){
            var imgIndex = Manager.users[index].effectIndex % Manager.users[index].buffImgDataList[i].resourceLength + 1;
            var imgData = Manager.users[index].buffImgDataList[i]['resourceIndex' + imgIndex];
            if(Manager.users[index].buffImgDataList[i].isRotate){
              ctx.restore();
              ctx.save();
              ctx.translate(center.x, center.y);
              var effectRadian = (Manager.users[index].buffImgDataList[i].rotateStartDegree + Manager.users[index].effectRotateDegree) * radianFactor;
              ctx.rotate(effectRadian);
              ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
              ctx.restore();
              ctx.save();
              ctx.translate(center.x, center.y);
              ctx.rotate(radian);
            }else{
              ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
            }
          }
        }
      }
      ctx.restore();
      //draw User Chatting
      var pos = util.worldToLocalPosition(Manager.users[index].position, gameConfig.userOffset, gameConfig.scaleFactor);

      if(Manager.users[index].chatMessageTimeout){
        ctx.beginPath();
        var width = (Manager.users[index].chatMessage.length * 12 + 20) * gameConfig.scaleFactor;
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(center.x - width/2, pos.y - 30 * gameConfig.scaleFactor, width, 25 * gameConfig.scaleFactor);
        ctx.strokeRect(center.x - width/2, pos.y - 30 * gameConfig.scaleFactor, width, 25 * gameConfig.scaleFactor);
        ctx.fillStyle = "#000000";
        ctx.moveTo(center.x - 8, pos.y - 5 * gameConfig.scaleFactor);
        ctx.lineTo(center.x + 8, pos.y - 5 * gameConfig.scaleFactor);
        ctx.lineTo(center.x, pos.y);
        ctx.fill();

        ctx.textAlign = "center";
		    ctx.font = "20px Comic Sans MS";
        ctx.fillText(Manager.users[index].chatMessage, center.x, pos.y - 10.5 * gameConfig.scaleFactor);

        ctx.closePath();
      }
      //draw HP, MP gauge
      ctx.beginPath();
      // var pos = util.worldToLocalPosition(Manager.users[index].position, gameConfig.userOffset, gameConfig.scaleFactor);

      ctx.fillStyle = "#ff0000";
      var posX = pos.x - 7 * gameConfig.scaleFactor;
      var width = Manager.users[index].HP / Manager.users[index].maxHP * 79 * gameConfig.scaleFactor;
      var height = 7 * gameConfig.scaleFactor;
      ctx.fillRect(posX, pos.y + 80 * gameConfig.scaleFactor, width, height);

      ctx.fillStyle = "#0000ff";
      width = Manager.users[index].MP / Manager.users[index].maxMP * 79 * gameConfig.scaleFactor;
      height = 4 * gameConfig.scaleFactor;
      ctx.fillRect(posX, pos.y + 87 * gameConfig.scaleFactor, width, height);

      ctx.strokeStyle = "rgb(15,15,15)";
      width = 79 * gameConfig.scaleFactor;
      height = 10 * gameConfig.scaleFactor;
      ctx.lineJoin = "round";

      ctx.fillRect(posX, pos.y + 86.25 * gameConfig.scaleFactor, width, 0.75);
      // ctx.moveTo((pos.x - 8) * gameConfig.scaleFactor, (pos.y + 86) * gameConfig.scaleFactor);
      // ctx.lineTo((pos.x + 73) * gameConfig.scaleFactor, (pos.y + 86) * gameConfig.scaleFactor);
      // ctx.stroke();
      // var lineJoin = ['round','bevel','miter'];
      ctx.strokeRect(posX, pos.y + 80 * gameConfig.scaleFactor, width, height);
      ctx.closePath();
    }
  }
  ctx.globalAlpha = 1;
};
function drawEffect(){
  for(var i=0; i<Manager.effects.length; i++){
    ctx.beginPath();
    ctx.fillStyle ="#ff0000";
    if(Manager.effects[i].effectImgData){
      var imgData = Manager.effects[i].effectImgData['resourceIndex1'];
      // var isRotate = Manager.effects[i].effectImgData.isRotate;
    }else{
      switch (Manager.effects[i].property) {
        case gameConfig.SKILL_PROPERTY_FIRE:
        imgData = skillFireImgData;
        break;
        case gameConfig.SKILL_PROPERTY_FROST:
        imgData = skillFrostImgData;
        break;
        case gameConfig.SKILL_PROPERTY_ARCANE:
        imgData = skillArcaneImgData;
        break;
        default:
      }
    }
    var centerX = util.worldXCoordToLocalX(Manager.effects[i].position.x + Manager.effects[i].radius, gameConfig.userOffset.x, gameConfig.scaleFactor);
    var centerY = util.worldYCoordToLocalY(Manager.effects[i].position.y + Manager.effects[i].radius, gameConfig.userOffset.y, gameConfig.scaleFactor);
    // var radius = Manager.effects[i].radius;
    var radius = Manager.effects[i].radius * Manager.effects[i].scaleFactor;
    // var posX = util.worldXCoordToLocalX(Manager.effects[i].position.x, gameConfig.userOffset.x);
    // var posY = util.worldYCoordToLocalY(Manager.effects[i].position.y, gameConfig.userOffset.y);
    ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                  centerX - radius, centerY - radius, radius * 2, radius * 2);
    // var centerX = util.worldXCoordToLocalX(Manager.effects[i].position.x + Manager.effects[i].radius, gameConfig.userOffset.x);
    // var centerY = util.worldYCoordToLocalY(Manager.effects[i].position.y + Manager.effects[i].radius, gameConfig.userOffset.y);
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.effects[i].radius * gameConfig.scaleFactor, 0, Math.PI * 2);
    // ctx.fill();

    ctx.closePath();
  }
};
function drawProjectile(){
  for(var i=0; i<Manager.projectiles.length; i++){
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.projectiles[i].radius * gameConfig.scaleFactor, 0, Math.PI * 2);
    if(Manager.projectiles[i].projectileImgData){
      var imgData = Manager.projectiles[i].projectileImgData['resourceIndex1'];
      var isRotate = Manager.projectiles[i].projectileImgData.isRotate;
    }else{
      switch (Manager.projectiles[i].property) {
        case gameConfig.SKILL_PROPERTY_FIRE:
        imgData = projectileFireImgData;
        break;
        case gameConfig.SKILL_PROPERTY_FROST:
        imgData = projectileFrostImgData;
        break;
        case gameConfig.SKILL_PROPERTY_ARCANE:
        imgData = projectileArcaneImgData;
        break;
        default:
      }
    }
    var posX = util.worldXCoordToLocalX(Manager.projectiles[i].position.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    var posY = util.worldYCoordToLocalY(Manager.projectiles[i].position.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    var radius = Manager.projectiles[i].radius *  gameConfig.scaleFactor;
    if(isRotate){
      var centerX = posX + radius;
      var centerY = posY + radius;
      ctx.save();
      ctx.translate(centerX, centerY);
      var effectRadian = (Manager.projectiles[i].effectRotateDegree) * radianFactor;
      ctx.rotate(effectRadian);
      ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
        -radius * gameConfig.scaleFactor, -radius * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
      ctx.restore();
    }else{
      ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
        posX, posY, radius * 2, radius * 2);
    }
  }
};
// function drawRiseText(){
//   for(var i=0; i<Manager.riseText.length; i++){
//     ctx.font = "30px Arial";
//     ctx.fillStyle = Manager.riseText[i].color;
//     // console.log(Manager.riseText[i].position);
//     var pos = util.worldToLocalPosition(Manager.riseText[i].position, gameConfig.userOffset, gameConfig.scaleFactor);
//     ctx.fillText(Manager.riseText[i].text, pos.x, pos.y);
//   }
// };
function drawSkillRange(){
  if(currentSkillData.type === gameConfig.SKILL_TYPE_PROJECTILE || currentSkillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK ||
     currentSkillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION || currentSkillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){
       ctx.beginPath();
       ctx.save();
       var center = util.worldToLocalPosition(Manager.users[gameConfig.userID].center, gameConfig.userOffset);
       var distX = mousePoint.x - center.x;
       var distY = mousePoint.y - center.y;

       var radian = Math.atan(distY / distX);
       if(isNaN(radian)){
        radian = 0;
       }else{
         if(distX < 0 && distY >= 0){
           radian += Math.PI;
         }else if(distX < 0 && distY < 0){
           radian -= Math.PI;
         }
       }

       ctx.translate(center.x * gameConfig.scaleFactor, center.y * gameConfig.scaleFactor);
       ctx.rotate(radian);
       ctx.drawImage(resourceCharacter, projectileSkillArrowImgData.srcPosX, projectileSkillArrowImgData.srcPosY, projectileSkillArrowImgData.srcWidth, projectileSkillArrowImgData.srcHeight,
                     -projectileSkillArrowImgData.width/2 * gameConfig.scaleFactor, -projectileSkillArrowImgData.height/2 * gameConfig.scaleFactor, projectileSkillArrowImgData.width *gameConfig.scaleFactor, projectileSkillArrowImgData.height * gameConfig.scaleFactor);
       ctx.closePath();
       ctx.restore();
     }else if(currentSkillData.index === baseSkill){
       ctx.beginPath();
       ctx.fillStyle = "#ffffff";
       ctx.globalAlpha = 0.8;
       ctx.arc(mousePoint.x * gameConfig.scaleFactor, mousePoint.y * gameConfig.scaleFactor, currentSkillData.explosionRadius * gameConfig.scaleFactor, 0, Math.PI * 2);
       ctx.fill();
       ctx.closePath();
     }else{
       ctx.beginPath();
       ctx.fillStyle = "#ffffff";
       ctx.globalAlpha = 0.8;
       var center = util.worldToLocalPosition(Manager.users[gameConfig.userID].center, gameConfig.userOffset);
       ctx.arc(center.x * gameConfig.scaleFactor, center.y * gameConfig.scaleFactor, currentSkillData.range * gameConfig.scaleFactor, 0, 2 * Math.PI);
       ctx.fill();
       ctx.closePath();
       //draw explosionRadius
       ctx.beginPath();
       ctx.globalAlpha = 0.9;

       var distSquare = util.distanceSquare(center, mousePoint);
       if(Math.pow(currentSkillData.range,2) > distSquare){
         ctx.arc(mousePoint.x * gameConfig.scaleFactor, mousePoint.y * gameConfig.scaleFactor, currentSkillData.explosionRadius * gameConfig.scaleFactor, 0, Math.PI * 2);
       }else{
         var distX = mousePoint.x - center.x;
         var distY = mousePoint.y - center.y;

         var radian = Math.atan(distY / distX);
         if(isNaN(radian)){
          radian = 0;
         }else{
           if(distX < 0 && distY >= 0){
             radian += Math.PI;
           }else if(distX < 0 && distY < 0){
             radian -= Math.PI;
           }
         }

         var addPosX = currentSkillData.range * Math.cos(radian);
         var addPosY = currentSkillData.range * Math.sin(radian);

         var drawCenter = {x : center.x + addPosX, y : center.y + addPosY};
         ctx.arc(drawCenter.x * gameConfig.scaleFactor, drawCenter.y * gameConfig.scaleFactor, currentSkillData.explosionRadius * gameConfig.scaleFactor, 0, Math.PI * 2);
       }
       ctx.fill();
       ctx.globalAlpha = 1
     }
};
function drawBackground(){
  ctx.fillStyle = "rgb(96, 56, 19)";
  var posX = -gameConfig.userOffset.x * gameConfig.scaleFactor;
  var posY = -gameConfig.userOffset.y * gameConfig.scaleFactor;
  var sizeW = gameConfig.CANVAS_MAX_SIZE.width * gameConfig.scaleFactor;
  var sizeH = gameConfig.CANVAS_MAX_SIZE.height * gameConfig.scaleFactor;
  ctx.fillRect(posX, posY, sizeW, sizeH);

  ctx.fillStyle = "rgb(105, 147, 50)";
  var posX = (-gameConfig.userOffset.x + 200) * gameConfig.scaleFactor;
  var posY = (-gameConfig.userOffset.y + 200) * gameConfig.scaleFactor;
  var sizeW = (gameConfig.CANVAS_MAX_SIZE.width - 400)* gameConfig.scaleFactor;
  var sizeH = (gameConfig.CANVAS_MAX_SIZE.height - 400) * gameConfig.scaleFactor;
  ctx.fillRect(posX, posY, sizeW, sizeH);
};
function drawGrid(){
  // for(var i=0; i<gameConfig.CANVAS_MAX_SIZE.width; i += resources.GRID_SIZE){
  //   var x = util.worldXCoordToLocalX(i, gameConfig.userOffset.x);
  //   if(x * gameConfig.scaleFactor >= -resources.GRID_SIZE && x * gameConfig.scaleFactor <= gameConfig.canvasSize.width){
  //     for(var j=0; j<gameConfig.CANVAS_MAX_SIZE.height; j += resources.GRID_SIZE){
  //        var y = util.worldYCoordToLocalY(j, gameConfig.userOffset.y);
  //        if(y * gameConfig.scaleFactor >= -resources.GRID_SIZE && y * gameConfig.scaleFactor <= gameConfig.canvasSize.height){
  //          ctx.drawImage(grid, 0, 0, 48, 48, x * gameConfig.scaleFactor, y * gameConfig.scaleFactor, resources.GRID_IMG_SIZE * gameConfig.scaleFactor, resources.GRID_IMG_SIZE * gameConfig.scaleFactor);
  //        }
  //     }
  //   }
  // }
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgb(103, 124, 81)';
  // ctx.globalAlpha = 0.15;
  ctx.beginPath();
  // - (gameConfig.CANVAS_MAX_LOCAL_SIZE.width * gameConfig.scaleFactor)/2
  //  - (gameConfig.CANVAS_MAX_LOCAL_SIZE.height * gameConfig.scaleFactor)/2
  // var fromX = (Manager.user.center.x - gameConfig.CANVAS_MAX_LOCAL_SIZE.width / 2) * gameConfig.scaleFactor;
  // var toX = (Manager.user.center.x + gameConfig.CANVAS_MAX_LOCAL_SIZE.width / 2) * gameConfig.scaleFactor;
  // var fromY = (Manager.user.center.y - gameConfig.CANVAS_MAX_LOCAL_SIZE.height / 2) * gameConfig.scaleFactor;
  // var toY = (Manager.user.center.y + gameConfig.CANVAS_MAX_LOCAL_SIZE.height / 2) * gameConfig.scaleFactor;
  //
  // for(var x=0; x<toX; x+= gameConfig.CANVAS_MAX_LOCAL_SIZE.width/32){
  //   if(util.isXInCanvas(x, gameConfig)){
  //     ctx.moveTo(x * gameConfig.scaleFactor, fromY);
  //     ctx.lineTo(x * gameConfig.scaleFactor, toY);
  //   }
  // }
  // for(var y=0; y<toY; y+= gameConfig.CANVAS_MAX_LOCAL_SIZE.height/20){
  //   if(util.isYInCanvas(y, gameConfig)){
  //     ctx.moveTo(fromX, y * gameConfig.scaleFactor);
  //     ctx.lineTo(toX, y * gameConfig.scaleFactor);
  //   }
  // }

  // // use for map setting
  // ctx.fillStyle = "red";
  // ctx.font = "15px Arial";
  // for(var i=0; i<gameConfig.CANVAS_MAX_SIZE.width; i += gameConfig.CANVAS_MAX_LOCAL_SIZE.width/8){
  //   for(var j=0; j<gameConfig.CANVAS_MAX_SIZE.height; j += gameConfig.CANVAS_MAX_LOCAL_SIZE.height/5){
  //     var x = util.worldXCoordToLocalX(i, gameConfig.userOffset.x);
  //     var y = util.worldYCoordToLocalY(j, gameConfig.userOffset.y);
  //     ctx.fillText(Math.floor(i), x* gameConfig.scaleFactor, 20);
  //     ctx.fillText(Math.floor(j), 20, y * gameConfig.scaleFactor);
  //   }
  // }
  for(var x = - gameConfig.userOffset.x - 800; x<gameConfig.canvasSize.width; x += gameConfig.CANVAS_MAX_LOCAL_SIZE.width/32){
    var scaledX = x * gameConfig.scaleFactor;
    if(util.isXInCanvas(scaledX, gameConfig)){
      ctx.moveTo(scaledX, 0);
      ctx.lineTo(scaledX, gameConfig.canvasSize.height);
    }
  }
  for(var y = - gameConfig.userOffset.y - 500; y<gameConfig.canvasSize.height; y += gameConfig.CANVAS_MAX_LOCAL_SIZE.height/20){
    var scaledY = y * gameConfig.scaleFactor;
    if(util.isYInCanvas(scaledY, gameConfig)){
      ctx.moveTo(0, scaledY);
      ctx.lineTo(gameConfig.canvasSize.width, scaledY);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.closePath();
};
function updateUserDataHandler(){
  var userData = Manager.processUserData();
  var needInform = false;
  if(Date.now() - userDataLastUpdateTime >= 1000){
    needInform = true;
    userDataLastUpdateTime = Date.now();
  }
  if(Date.now() - userPingCheckTime >= 5000){
    userPingCheckTime = Date.now();
    socket.emit('firePing', userPingCheckTime);
  }
  socket.emit('userDataUpdate', userData, needInform);
};
function canvasAddEvent(){
  canvas.addEventListener('click', canvasEventHandler, false);
  canvas.addEventListener('mousemove', mouseMoveHandler, false);
};
function documentAddEvent(){
  document.addEventListener('keydown', documentKeyDownEventHandler, false);
};
function canvasDisableEvent(){
  canvas.removeEventListener('click', canvasEventHandler);
  canvas.removeEventListener('mousemove', mouseMoveHandler);
};
function documentDisableEvent(){
  document.removeEventListener('keydown', documentKeyDownEventHandler);
};
// var mouseMoveEventTimer = Date.now();
// var canvasMouseMoveEventHandler = function(e){
//   if(Date.now() - mouseMoveEventTimer >= 100){
//     mouseMoveEventTimer = Date.now();
//     mousePoint.x = e.clientX/gameConfig.scaleFactor;
//     mousePoint.y = e.clientY/gameConfig.scaleFactor;
//     var worldClickPosition = util.localToWorldPosition(mousePoint, gameConfig.userOffset);
//
//     if(drawMode === gameConfig.DRAW_MODE_NORMAL){
//       var targetPosition = util.setTargetPosition(worldClickPosition, Manager.users[gameConfig.userID]);
//       Manager.moveUser(targetPosition);
//
//       var userData = Manager.processUserData();
//       userData.targetPosition = targetPosition;
//       userDataLastUpdateTime = Date.now();
//       socket.emit('userMoveStart', userData);
//     }
//   }
// };
var canvasEventHandler = function(e){
  userLastActionTime = Date.now();
  if(userCastingTimeHandler){
    clearTimeout(userCastingTimeHandler);
    userCastingTimeHandler = false;
  }
  var timeDelay = 0;
  if(Manager.user.castingEndTime){
    timeDelay = Manager.user.castingEndTime - Date.now();
  }
  userCastingTimeHandler = setTimeout(function(){
    var clickPosition ={
      x : e.clientX/gameConfig.scaleFactor,
      y : e.clientY/gameConfig.scaleFactor
    }
    var worldClickPosition = util.localToWorldPosition(clickPosition, gameConfig.userOffset);

    if(drawMode === gameConfig.DRAW_MODE_NORMAL){
      var targetPosition = util.setTargetPosition(worldClickPosition, Manager.users[gameConfig.userID]);
      Manager.moveUser(targetPosition);

      var userData = Manager.processUserData();
      userData.targetPosition = targetPosition;
      userDataLastUpdateTime = Date.now();
      socket.emit('userMoveStart', userData);
    }else if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
      if(currentSkillData.index === baseSkill){
        //case A
        var targetPosition = util.setMoveAttackUserTargetPosition(worldClickPosition, currentSkillData, Manager.users[gameConfig.userID]);
        var userTargetPosition = {x : targetPosition.x, y : targetPosition.y}
        var skillData = objectAssign({}, currentSkillData);
        skillData.targetPosition = worldClickPosition;

        Manager.moveAndAttackUser(gameConfig.userID, userTargetPosition, skillData, targetPosition.moveBackward);

        var userData = Manager.processUserData();

        userData.targetPosition = userTargetPosition;
        userData.moveBackward = targetPosition.moveBackward;

        userData.skillIndex = currentSkillData.index;
        userData.skillTargetPosition = worldClickPosition;

        changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
        userDataLastUpdateTime = Date.now();
        socket.emit('userMoveAndAttack', userData);
      }else{
        useSkill(currentSkillData, worldClickPosition, Manager.users[gameConfig.userID]);
        changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
      }
    }
  }, timeDelay);
};
var documentKeyDownEventHandler = function(e){
  userLastActionTime = Date.now();
  var keyCode = e.keyCode;
  if(drawMode === gameConfig.DRAW_MODE_NORMAL && !isChattingOn){
    if(keyCode === 69 || keyCode === 32){
      // if(UIManager.checkCooltime(gameConfig.SKILL_BASIC_INDEX)){
      if(Manager.user.currentState !== gameConfig.OBJECT_STATE_ATTACK){
        var skillData = objectAssign({}, baseSkillData);
      }
      // }
    }else if(keyCode === 49){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP1_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[0]);
      // }
    }else if(keyCode === 50){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP2_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[1]);
      // }
    }else if(keyCode === 51){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP3_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[2]);
      // }
    }else if(keyCode === 52){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP4_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[3]);
      // }
    }
    checkSkillConditionAndUse(skillData);

    if(keyCode === 65){
      //case A
      skillData = objectAssign({}, baseSkillData);
      checkBaseSkillCondition(skillData);
    }
  }
  if(keyCode === 27){
    if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
      changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
    }
    if(isChattingOn){
      isChattingOn = false;
      UIManager.disableChatInput();
    }
  }
  //for chatting
  if(keyCode === 13){
    if(!isChattingOn){
      isChattingOn = true;
      UIManager.showChatInput();
    }else{
      isChattingOn = false;
      var chatMessage = util.processMessage(UIManager.getChatMessage());
      UIManager.disableChatInput();
      UIManager.clearChatInput();
      if(chatMessage){
        socket.emit('chatting', chatMessage);
      }
    }
  }

  // cheatCode
  if(keyCode === 36){
    //case HOME key
    socket.emit('killme');
  }
  if(keyCode === 33){
    //case Page Up
    socket.emit('giveExp');
  }
  if(keyCode === 45){
    //case Insert
    socket.emit('giveResources');
  }
};
function checkBaseSkillCondition(skillData){
  if(skillData.index === baseSkill){
    if(!Manager.user.conditions[gameConfig.USER_CONDITION_FREEZE] && !Manager.user.conditions[gameConfig.USER_CONDITION_SILENCE]){
      Manager.applyCastSpeed(gameConfig.userID, skillData);
      currentSkillData = skillData;
      changeDrawMode(gameConfig.DRAW_MODE_SKILL_RANGE);
    }
  }
}
function checkSkillConditionAndUse(skillData){
  if(userCastingTimeHandler){
    clearTimeout(userCastingTimeHandler);
    userCastingTimeHandler = false;
  }
  var timeDelay = 0;
  if(Manager.user.castingEndTime){
    timeDelay = Manager.user.castingEndTime - Date.now();
  }
  userCastingTimeHandler = setTimeout(function(){
    if(skillData && skillData.hasOwnProperty('index')){
      if(skillData.type !== gameConfig.SKILL_TYPE_PASSIVE){
        if(Manager.user.conditions[gameConfig.USER_CONDITION_FREEZE]){
          UIManager.makeFlashMessage('FROZEN!!!');
          if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
            changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
          }
        }else if(Manager.user.conditions[gameConfig.USER_CONDITION_SILENCE]){
          UIManager.makeFlashMessage('SILENCED!!!');
          if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
            changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
          }
        }else if(Manager.user.MP < skillData.consumeMP){
          UIManager.makeFlashMessage('Not enough Mana!!!');
          if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
            changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
          }
        }else if(!UIManager.checkCooltime(skillData.index)){
          UIManager.makeFlashMessage('Spell is not ready!!!');
          if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
            changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
          }
        }else{
          Manager.applyCastSpeed(gameConfig.userID, skillData);
          if(skillData.type === gameConfig.SKILL_TYPE_PROJECTILE || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION
            || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION
            || skillData.type === gameConfig.SKILL_TYPE_RANGE || skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
              if(drawMode === gameConfig.DRAW_MODE_NORMAL){
                currentSkillData = skillData;
                changeDrawMode(gameConfig.DRAW_MODE_SKILL_RANGE);
              }
          }else{
            useSkill(skillData, Manager.users[gameConfig.userID].center, Manager.users[gameConfig.userID]);
          }
        }
      }
    }
  }, timeDelay);
};
function changeDrawMode(mode){
  if(mode === gameConfig.DRAW_MODE_NORMAL){
    drawMode = gameConfig.DRAW_MODE_NORMAL;
    currentSkillData = null;
    UIManager.disableSelectSkillInfo();
    // canvas.removeEventListener('mousemove', mouseMoveHandler);
  }else if(mode === gameConfig.DRAW_MODE_SKILL_RANGE){
    drawMode = gameConfig.DRAW_MODE_SKILL_RANGE;
    UIManager.enableSelectSkillInfo(currentSkillData);
    // canvas.onmousemove = mouseMoveHandler;
    // canvas.addEventListener('mousemove', mouseMoveHandler, false);
  }
};
function mouseMoveHandler(e){
  mousePoint.x = e.clientX/gameConfig.scaleFactor;
  mousePoint.y = e.clientY/gameConfig.scaleFactor;
};
function useSkill(skillData, clickPosition, user){
  if(UIManager.checkCooltime(skillData.index)){
    if(!user.conditions[gameConfig.USER_CONDITION_FREEZE] && !user.conditions[gameConfig.USER_CONDITION_SILENCE]){
      skillData.targetPosition = util.calcSkillTargetPosition(skillData, clickPosition, user);
      if(skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
        var isCollision = true;
        var repeatCount = 1;
        while(isCollision){
          repeatCount++;
          var collisionObjs = Manager.checkCollisionWithObstacles(skillData.targetPosition, user);
          if(collisionObjs.length){
            skillData.targetPosition = Manager.reCalcSkillTargetPosition(skillData.targetPosition, user, collisionObjs);
          }else{
            isCollision = false;
          }
          if(repeatCount >= 20){
            isCollision = false;
          }
        }
      }
      skillData.direction = util.calcSkillTargetDirection(skillData.type, skillData.targetPosition, user);
      if(skillData.type === gameConfig.SKILL_TYPE_PROJECTILE || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK ||
        skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION
        || skillData.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
          skillData.projectileIDs = util.generateRandomUniqueID(Manager.projectiles, gameConfig.PREFIX_SKILL_PROJECTILE, skillData.projectileCount);
      }
      Manager.useSkill(gameConfig.userID, skillData);

      var userData = Manager.processUserData();
      userData.skillIndex = skillData.index;
      userData.skillDirection = skillData.direction;
      userData.skillTargetPosition = skillData.targetPosition;
      if(skillData.projectileIDs){
        userData.projectileIDs = skillData.projectileIDs;
      }
      // if(user.conditions[gameConfig.USER_CONDITION_BLUR]){
      //   userData.cancelBlur = true;
      // }
      userDataLastUpdateTime = Date.now();
      socket.emit('userUseSkill', userData);
    }
  }
};
function updateCharTypeSkill(charType){
  switch (charType) {
    case gameConfig.CHAR_TYPE_FIRE:
      pyroBaseSkill = baseSkill;
      pyroInherentPassiveSkill = inherentPassiveSkill;
      for(var i=0; i<equipSkills.length; i++){
        pyroEquipSkills[i] = equipSkills[i];
      }
      break;
    case gameConfig.CHAR_TYPE_FROST:
      frosterBaseSkill = baseSkill;
      frosterInherentPassiveSkill = inherentPassiveSkill;
      for(var i=0; i<equipSkills.length; i++){
        frosterEquipSkills[i] = equipSkills[i];
      }
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      mysterBaseSkill = baseSkill;
      mysterInherentPassiveSkill = inherentPassiveSkill;
      for(var i=0; i<equipSkills.length; i++){
        mysterEquipSkills[i] = equipSkills[i];
      }
      break;
  }
};
function updateSkills(changeSkills){
  baseSkill = changeSkills.baseSkill;
  inherentPassiveSkill = changeSkills.inherentPassiveSkill;
  for(var i=0; i<4; i++){
    for(var j=0; j<changeSkills.possessSkills.length; j++){
      var skillData = objectAssign({}, util.findData(skillTable, 'index', changeSkills.possessSkills[j]));
      if(equipSkillDatas[i]){
        if(equipSkillDatas[i].groupIndex === skillData.groupIndex){
          equipSkills.splice(i, 1, skillData.index);
          equipSkillDatas.splice(i, 1, skillData);
          break;
        }
      }
    }
  }
};
function updateUserBuff(buffData){
  var buffImgDataList = [];

  var buffGroupData = objectAssign({}, util.findData(skillTable, 'index', buffData.inherentPassive)).buffToSelf
  var buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupData)).buffEffectGroup;
  var buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
  var hasResource = util.setResourceData(resourceTable, buffImgData);
  if(hasResource){
    buffImgDataList.push(buffImgData);
  }
  for(var i=0; i<buffData.buffList.length; i++){
    buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.buffList[i].index)).buffEffectGroup;
    buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    hasResource = util.setResourceData(resourceTable, buffImgData);
    if(hasResource){
      buffImgDataList.push(buffImgData);
    }
  }
  for(var i=0; i<buffData.passiveList.length; i++){
    buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.passiveList[i])).buffEffectGroup;
    buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    hasResource = util.setResourceData(resourceTable, buffImgData);
    if(hasResource){
      buffImgDataList.push(buffImgData);
    }
  }
  Manager.updateUserBuffImgData(buffData.objectID, buffImgDataList);
};
function setCanvasScale(gameConfig){
  gameConfig.scaleX = 1;
  gameConfig.scaleY = 1;
  if(gameConfig.canvasSize.width >= gameConfig.CANVAS_MAX_LOCAL_SIZE.width){
    gameConfig.scaleX =  (gameConfig.canvasSize.width / gameConfig.CANVAS_MAX_LOCAL_SIZE.width);
  }
  if(gameConfig.canvasSize.height >= gameConfig.CANVAS_MAX_LOCAL_SIZE.height){
    gameConfig.scaleY = (gameConfig.canvasSize.height / gameConfig.CANVAS_MAX_LOCAL_SIZE.height);
  }
  if(gameConfig.scaleX > gameConfig.scaleY){
    gameConfig.scaleFactor = gameConfig.scaleX;
  }else{
    gameConfig.scaleFactor = gameConfig.scaleY;
  }
};
function calcOffset(){
  return {
    x : Manager.user.center.x - gameConfig.canvasSize.width/(2 * gameConfig.scaleFactor),
    y : Manager.user.center.y - gameConfig.canvasSize.height/(2 * gameConfig.scaleFactor)
  };
};
// update();
changeState(gameConfig.GAME_STATE_LOAD);
setInterval(function(){
  if(Date.now() >= userLastActionTime + gameConfig.LIMIT_NO_ACTION_TIME){
    console.log('disconnected');
    window.onbeforeunload = '';
    window.location.href = "http://localhost/noaction"
  }
}, gameConfig.LONG_TIME_INTERVAL);

},{"../../modules/client/CManager.js":1,"../../modules/client/CUIManager.js":4,"../../modules/client/CUser.js":5,"../../modules/public/csvjson.js":6,"../../modules/public/data.json":7,"../../modules/public/gameConfig.json":8,"../../modules/public/objectAssign.js":9,"../../modules/public/util.js":12}]},{},[13]);
