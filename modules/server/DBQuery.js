var mysql = require('mysql');
var DB = require('./DB.js');
var gameConfig = require('../public/gameConfig.json');
var util = require('../public/util.js');

var DBQuery = (function() {
  function _findById(id, cb) {
    process.nextTick(function() {
      DB.query('SELECT * FROM user WHERE id=?', [id], function(err, results) {
        if (results && results[0]) {
          cb(err, results[0]);
        } else {
          cb(err, null);
        }
        // if (err) { return cb(err); }
        // else {
        //   if (result && result[0]) {
        //     cb(result[0]);
        //   } else {
        //     cb(new Error('Can`t find user'));
        //   }
        // }
      });
    });
  }
  function __findByGoogleId(id, cb) {
    process.nextTick(function() {
      DB.query('SELECT * FROM user WHERE googleId=?', [id], function(err, result) {
        cb(err, result);
      });
    });
  }
  function _insertData(data, cb) {
    process.nextTick(function() {
      DB.queryTransaction('INSERT INTO user SET ?', data, function(err, result) {
        cb(err, result);
      });
    });
  }
  function _updateData(query, data, cb) {
    process.nextTick(function() {
      DB.queryTransaction(query, data, function(err, result) {
        cb(err, result);
      });
    });
  }
  function _createGuest(cb) {
    process.nextTick(function() {
      var userModel = new UserModel();
      _insertData(userModel, function(err, result) {
        if (err) { return cb(err); }
        _findById(result.insertId, function(err, result) {
          if (err) { return cb(err); }
          return cb(null, result);
        });
      });
    });
  }
  function _findOrCreate(user, cb) {
    process.nextTick(function() {
      __findByGoogleId(user.id, function(err, result) {
        if (err) { return cb(err); }
        if (result && result[0]) { return cb(null, result[0]); }
        else {
          // create
          var userModel = new UserModel(user);
          _insertData(userModel, function(err, result) {
            if (err) { return cb(err); }
            _findById(result.insertId, function(err, result) {
              if (err) { return cb(err); }
              return cb(null, result);
            });
          });
        }
      });
    });
  }
  function _findOrMerging(id, profile, successCb, duplicateCb) {
    process.nextTick(function() {
      _findById(id, function(err, result) {
        if (err) { return cb(err); }
        if (result && result.googleId) {
          // already registered google
          successCb(null, result);
        } else {
          // check other googldId
          __findByGoogleId(profile.id, function(err, result) {
            if (err) { return cb(err); }
            if (result && result[0]) {
              // case duplicate sign in
              duplicateCb(null, result)
            } else {
              // update users googldId
              var query = 'UPDATE user SET googleId=?, displayName=? WHERE id=?';
              var data = [ profile.id, profile.displayName, id];
              _updateData(query, data, function(err, result) {
                if (err) { return cb(err); }
                _findById(id, function(err, result) {
                  if (err) { return cb(err); }
                  successCb(null, result);
                });
              });
            }
          });
        }
      });
    });
  }
  function _findUserData(id, cb) {
    process.nextTick(function() {
      _findById(id, function(err, result) {
        if (err || !result) { return cb(err); }
        var now = dateToStr(new Date());
        if (result.lastConnDate && now !== dbDateToStr(result.lastConnDate)) {
          // update last conn date
          var query = 'UPDATE user SET lastConnDate=? WHERE id=?';
          var data = [ now, id ];
          _updateData(query, data, function(err, result) { });
        }
        cb(null, result);
      });
    });
  }
  function _updateUserData(id, user) {
    process.nextTick(function() {
      _findById(id, function(err, result) {
        if (err && !result) { return; }
        try {
          var displayName = user.name;
          var levels = result.levels.split(',');
          var exps = result.exps.split(',');
          var equipSkillName = 'pyroEquipSkills';
          var equipSkills = '';
          var skills = '';
          for (var i=0; i<user.possessSkills.length; i++) {
            if (util.isNumeric(user.possessSkills[i])) {
              if (i !== user.possessSkills.length - 1) {
                skills = skills + user.possessSkills[i] + ',';
              } else {
                skills += user.possessSkills[i];
              }
            }
          }
          // var skills = user.possessSkills.toString();
          if (util.isNumeric(user.gold)) { var gold = user.gold } else { throw 'gold is not numeric' };
          if (util.isNumeric(user.jewel)) { var jewel = user.jewel } else { throw 'jewel is not numeric' };

          switch (user.type) {
            case gameConfig.CHAR_TYPE_FIRE:
              if (util.isNumeric(user.level)) { levels[0] = user.level } else { throw 'Level is not numeric' };
              if (util.isNumeric(user.exp)) { exps[0] = user.exp } else { throw 'Exp is not numeric' };
              for (var i=0; i<user.pyroEquipSkills.length; i++) {
                if (util.isNumeric(user.pyroEquipSkills[i])) {
                  equipSkills += user.pyroEquipSkills[i];
                }
                if (i !== user.pyroEquipSkills.length - 1) {
                  equipSkills += ',';
                }
              }
              // equipSkills = user.pyroEquipSkills.toString();
              equipSkillName = 'pyroEquipSkills';
              break;
            case gameConfig.CHAR_TYPE_FROST:
              if (util.isNumeric(user.level)) { levels[1] = user.level } else { throw 'Level is not numeric' };
              if (util.isNumeric(user.exp)) { exps[1] = user.exp } else { throw 'Exp is not numeric' };
              for (var i=0; i<user.frosterEquipSkills.length; i++) {
                if (util.isNumeric(user.frosterEquipSkills[i])) {
                  equipSkills += user.frosterEquipSkills[i];
                }
                if (i !== user.frosterEquipSkills.length - 1) {
                  equipSkills += ',';
                }
              }
              // equipSkills = user.frosterEquipSkills.toString();
              equipSkillName = 'frosterEquipSkills';
              break;
            case gameConfig.CHAR_TYPE_ARCANE:
              if (util.isNumeric(user.level)) { levels[2] = user.level } else { throw 'Level is not numeric' };
              if (util.isNumeric(user.exp)) { exps[2] = user.exp } else { throw 'Exp is not numeric' };
              for (var i=0; i<user.mysterEquipSkills.length; i++) {
                if (util.isNumeric(user.mysterEquipSkills[i])) {
                  equipSkills += user.mysterEquipSkills[i];
                }
                if (i !== user.mysterEquipSkills.length - 1) {
                  equipSkills += ',';
                }
              }
              // equipSkills = user.mysterEquipSkills.toString();
              equipSkillName = 'mysterEquipSkills';
              break;
            default:
          }
          levels = levels.toString();
          exps = exps.toString();

          var query = 'UPDATE user SET displayName=?, levels=?, exps=?, ' + equipSkillName + '=?, skills=?, gold=?, jewel=?, wasPlayed=? WHERE id=?';
          var data = [ displayName, levels, exps, equipSkills, skills, gold, jewel, 1, id ];
          _updateData(query, data, function(err, result) {
            if (!err) { /* console.log('update success'); */ }
          });
        } catch (e) {
          console.log(e);
        }
      });
    });
  }
  return {
    findById: _findById,
    createGuest: _createGuest,
    findOrCreate: _findOrCreate,
    findOrMerging: _findOrMerging,

    findUserData: _findUserData,
    updateUserData: _updateUserData
  };
})();

var UserModel = function(profile) {
  this.googleId = profile && profile.id ? profile.id : 0;
  this.displayName = profile && profile.displayName ? profile.displayName : 0;
  this.lastConnDate = dateToStr(new Date());
  this.levels = '1,1,1';
  this.exps = '0,0,0';
  this.pyroEquipSkills = '';
  this.frosterEquipSkills = '';
  this.mysterEquipSkills = '';
  this.skills = '';
  this.gold = 0;
  this.jewel = 0;
  this.wasPlayed = 0;
}

function dateToStr(date) {
  var d = date ? new Date(date) : new Date(),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('');
}
function dbDateToStr(date) {
  var year = date.slice(0, 4),
      month = date.slice(5, 7),
      day = date.slice(8, 10);
  return [year, month, day].join('');
}

module.exports = DBQuery;
