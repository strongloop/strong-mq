// test amqp usage

var assert = require('assert');
var amqp = require('amqp');

describe('check for amqp connectivity', function () {
  it('can create a queue with amqp', function (done) {
    var connection = amqp.createConnection();
    // console.log('connection created')
    connection.on('ready', function () {
      // console.log('connection ready')
      connection.queue('my-queue', function (q) {
        // console.log('my-queue ready')
        q.destroy();
        connection.end();
        done();
      });
    });
  });
});



