// Provider: AMQP

module.exports = CreateAmqp;

var amqp = require('amqp');
var assert = require('assert');
var dbg = require('../dbg');
var events = require('events');
var jobs = require('../jobs');
var checkTopic = require('../topic').check;
var util = require('util');

function forwardEvent(name, from, to)
{
  from.on(name, to.emit.bind(to, name));
}


//-- Connection

function CreateAmqp(provider, url, options) {
  var self = this;
  options = url ? {url: url} : options;
  amqp.Connection.call(self, options, {reconnect: false});

  self.provider = provider;

  // slmq private extensions to node-amqp connection
  self._slmq = {
    whenReady: jobs.delayed(),  // delayed until connection ready
  };

  self.once('ready', function() {
    dbg('task-start');
    self._slmq.whenReady.start();
  });
}

util.inherits(CreateAmqp, amqp.Connection);

CreateAmqp.prototype.open = function() {
  this.connect();
  return this;
};

CreateAmqp.prototype._doWhenReady = function(callback) {
  dbg('task-queue:', callback.name);
  assert(callback.name);
  this._slmq.whenReady.push(callback, function() {
    dbg('task-done:', callback.name);
  });
  return this;
};

CreateAmqp.prototype.close = function(callback) {
  var self = this;

  self._doWhenReady(function connClose(done) {
    dbg('connection close start');
    //XXX(sam) don't think its clean to FIN a connection, amqp likes to see
    //an explicit close, sometimes self causes RST (but not always).
    self.end();
    self.once('close', function() {
      dbg('connection close done');
      done();
      if (callback) {
        callback();
      }
    });
  });

  return self;
};

//-- Push/Pull Queue

// Get amqp connection for a queue
function c(q) {
  return q._connection;
}

// Common options when creating and destroying queues
var CREATE_OPTIONS = {
  autoDelete: true
};

// Using these options causes an error event to be emitted if the q is in use
// or non-empty, so the autoDelete flag appears to be a better way.
var DESTROY_OPTIONS = {
  //ifUnused: true,
  //ifEmpty: true,
};

function amqpOpen(self, type, connection, name) {
  self.name = name;
  self.type = type;
  self._connection = connection;
  c(self)._doWhenReady(function amqpOpen(done) {
    dbg('queue open start', name);
    self._q = c(self).queue(name, CREATE_OPTIONS, function() {
      dbg('queue open done', name);
      done();
    });
    forwardEvent('error', self._q, self);
  });
}

function amqpClose() {
  var self = this;

  c(self)._doWhenReady(function amqpClose(done) {
    if (self._q == null) {
      dbg('queue double close', self.type, self.name);
      done();
      return;
    }
    dbg('queue close start', self.type, self.name);
    self._q.once('close', function() {
      dbg('queue close done', self.type, self.name);
      done();
    });
    self._q.close();
    self._q = null;
  });

  return self;
}

function PushAmqp(connection, name) {
  amqpOpen(this, 'push', connection, name);
}

util.inherits(PushAmqp, events.EventEmitter);

PushAmqp.prototype.publish = function(msg) {
  var self = this;
  c(self)._doWhenReady(function pushPublish(done) {
    dbg('push publish start', msg);
    c(self).publish(self._q.name, msg, null, function() {
    }); //XXX(sam) callback will only happen if we force the
    // default exchange to have .confirm set, not sure how, maybe open an
    // exchange explicitly? this is sucky, but for now, just have to say done
    // in next tick
    process.nextTick(function() {
      dbg('push publish HOPEFULLY done');
      done();
    });
  });
  return self;
};

PushAmqp.prototype.close = amqpClose;

CreateAmqp.prototype.createPushQueue = function(name) {
  return new PushAmqp(this, name);
};

function PullAmqp(connection, name) {
  amqpOpen(this, 'pull', connection, name);
}

util.inherits(PullAmqp, events.EventEmitter);

PullAmqp.prototype.subscribe = function(callback) {
  var self = this;

  if (callback) {
    self.on('message', callback);
  }

  c(self)._doWhenReady(function pullSubscribe(done) {
    dbg('pull subscribe start+done');
    self._q.subscribe(/* ack? prefetchCount? */ function(msg) {
      dbg('pull subscribe callback', msg);
      if (msg.data && msg.contentType) {
        msg = msg.data; // non-json
      } // else msg is already-parsed json
      self.emit('message', msg);
    });
    done();
  });
  return self;
};

PullAmqp.prototype.close = amqpClose;

CreateAmqp.prototype.createPullQueue = function(name, callback) {
  return new PullAmqp(this, name, callback);
};


//-- Pub/Sub Queue

var EXCHANGE_OPTIONS = {autoDelete: true, type: 'topic'};

function PubAmqp(connection, name) {
  var self = this;
  self.name = name;
  self.type = 'pub';
  self._connection = connection;
  c(self)._doWhenReady(function pubExchange(done) {
    self._q = c(self).exchange(name, EXCHANGE_OPTIONS, function () {
      done();
    });
    forwardEvent('error', self._q, self);
  });
}

util.inherits(PubAmqp, events.EventEmitter);

PubAmqp.prototype.publish = function(msg, topic) {
  var self = this;
  topic = checkTopic(topic);
  c(self)._doWhenReady(function pubPublish(done) {
    self._q.publish(topic, msg);
    done();
  });
  return self;
};

PubAmqp.prototype.close = amqpClose;

CreateAmqp.prototype.createPubQueue = function(name) {
  return new PubAmqp(this, name);
};

function SubAmqp(connection, name) {
  var self = this;
  self.name = name;
  self.type = 'sub';
  self._connection = connection;
  c(self)._doWhenReady(function subQueueOpen(done) {
    self._q = c(self).queue('', {
      autoDelete: true, exclusive: true
    }, function(q) {
      done();
    });
    forwardEvent('error', self._q, self);
  });

  // We can subscribe here, because nothing will come from self queue until
  // it's bound to topics (with .subscribe(), below).
  connection._doWhenReady(function subSubscribe(done) {
    self._q.subscribe(function(msg) {
      if (msg.data && msg.contentType) {
        msg = msg.data; // non-json
      } // else msg is already-parsed json
      self.emit('message', msg);
    });
    done();
  });

  c(self)._doWhenReady(function subExchange(done) {
    self._exchange = c(self).exchange(name, EXCHANGE_OPTIONS, function () {
      done();
    });
    forwardEvent('error', self._exchange, self);
  });
}

util.inherits(SubAmqp, events.EventEmitter);

SubAmqp.prototype.subscribe = function(pattern, callback) {
  pattern = checkTopic(pattern);

  // Append AMQP multi-word wildcard to pattern
  if (pattern === '') {
    pattern = '#';
  } else {
    pattern = pattern + '.#';
  }

  var self = this;

  if (callback) {
    self.on('message', callback);
  }

  c(self)._doWhenReady(function subBind(done) {
    dbg('sub subscribe start', pattern);
    self._q.bind(self.name, pattern);
    self._q.once('queueBindOk', function() {
      dbg('sub subscribe done');
      done();
    });
  });

  return self;
};

SubAmqp.prototype.close = function subClose() {
  var self = this;

  // Close the queue, then the topic exchange.
  amqpClose.call(self);

  c(self)._doWhenReady(function subExchangeClose(done) {
    if (self._exchange == null) {
      done();
      return;
    }
    dbg('exchange close start', self.type, self.name);
    self._exchange.once('close', function() {
      dbg('exchange close done', self.type, self.name);
      done();
    });
    self._exchange.close();
    self._exchange = null;
  });

  return self;
};

CreateAmqp.prototype.createSubQueue = function(name) {
  return new SubAmqp(this, name);
};
