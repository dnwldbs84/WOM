var mysql = require('mysql'),
    // conn = null;
    pool = null;

var setting = {
  // socketPath : '/var/run/mysqld/mysqld.sock',
  connectionLimit: 10,
  host: '',
  user: '',
  password: '',
  database: 'test',

  dateStrings: 'date'
};

// var fs = require('fs');
//   // var text = fs.readFileSync('DBSetting.txt', 'utf8');
//   // var datas = text.split(',');
//   // setting.user = datas[0];
//   // setting.password = datas[1];

(function connectPool() {
  var fs = require('fs');
  var text = fs.readFileSync('DBSetting.txt', 'utf8');
  var datas = text.split(',');
  setting.user = datas[0];
  setting.password = datas[1];
  setting.host = datas[2];

  pool = mysql.createPool(setting);
  console.log('Connected to DB Pool!');
  pool.getConnection(function(err, connection) {
    connection.on('error', function(err) {
      connection.release();
      console.log('pool connection error');
    });
    connection.release();
  });
})();

var DB = (function() {
  function _query(query, params, callback) {
    try {
      pool.getConnection(function(err, connection) {
        // connection.on('error', function(err) {
        //   connection.release();
        //   onError(query, params, err, 'connection on error');
        // });
        if (err) {
          if (connection) {
            connection.release();
          }
          callback(err, null);
          onError(query, params, err, 'connection error');
        } else {
          connection.query(query, params, function(err, results) {
            try {
              connection.release();
              if (!err) {
                callback(null, results);
              } else {
                onError(query, params, err, 'query error');
                callback(err, null);
              }
            } catch (e) { onError(query, params, e, 'transaction error 1 (transaction)'); }
          });
        }
      });
    } catch (e) {}
  }
  function _queryTransaction(query, params, callback) {
    try {
      pool.getConnection(function(err, connection) {
        // connection.on('error', function(err) {
        //   connection.release();
        //   onError(query, params, err, 'connection on error (transaction)');
        // });
        if (err) {
          if (connection) {
            connection.release();
          }
          callback(err, null);
          onError(query, params, err, 'connection error (transaction)');
        } else {
          connection.beginTransaction(function(err) {
            try {
              if (err) {
                connection.release();
                onError(query, params, err, 'query error (transaction)');
                callback(err, null);
              } else {
                connection.query(query, params,function(err, result) {
                  if (err) {
                    return connection.rollback(function() {
                      try {
                        connection.release();
                        onError(query, params, err, 'rollback error 1 (transaction)');
                        callback(err, null);
                      } catch (e) { onError(query, params, e, 'transaction error 1 (transaction)'); }
                    });
                  }

                  connection.commit(function(err) {
                    if (err) {
                      return connection.rollback(function() {
                        try {
                          connection.release();
                          onError(query, params, err, 'rollback error 2 (transaction)');
                          callback(err, null);
                        } catch (e) {}
                      });
                    } else {
                      connection.release();
                      callback(null, result);
                    }
                  });
                });
              }
            } catch (e) {
              onError(query, params, e, 'transaction error 2 (transaction)');
              callback(e, null);
            }
          });
        }
      });
    } catch (e) {}
  }
  return {
    query: _query,
    queryTransaction: _queryTransaction,
  };
})();


function onError(query, params, err, info) {
  var time = new Date();
  console.log(info + ' : ' + time);
  console.log(query);
  console.log(params);
  console.log(err);
}

module.exports = DB;
// exports.connectDB = function() {
//   conn = connect(mysql);
//   if(conn) {
//     conn.on('error', function(err) {
//       if (!err.fatal) return;
//       if (err.code !== 'PROTOCOL_CONNECTION_LOST') throw err;
//
//       console.log('reconnecting mysql !!!');
//
//       exports.connectDB();
//     });
//     console.log('mysql connect success');
//     conn.query('SELECT * FROM user', (err, result) => {
//       console.log(err);
//       console.log(result);
//       console.log(arguments);
//     });
//   }
// }
//
// function connect(mysql) {
//   // var fs = require('fs');
//   // var text = fs.readFileSync('DBSetting.txt', 'utf8');
//   // var datas = text.split(',');
//   // setting.user = datas[0];
//   // setting.password = datas[1];
//   conn = mysql.createConnection(setting);
//   conn.connect();
//   return conn;
// }
