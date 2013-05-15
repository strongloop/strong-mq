// Provider: AMQP

module.exports = CreateAmqp;

var amqp = require('amqp');
var assert = require('assert');
var jobs = require('../jobs');
var events = require('events');
var util = require('util');

function forwardEvent(name, from, to)
{
  from.on(name, to.emit.bind(to, name));
}

var dbg;
if (process.env.NODE_CLUSTERMQ_DEBUG) {
  dbg = console.log;
} else {
  dbg = function() {};
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

CreateAmqp.prototype.open = function(callback) {
  this.connect();
  if (callback) {
    this.once('ready', callback);
  }
  return this;
};

CreateAmqp.prototype._doWhenReady = function(callback) {
  dbg('task-queue:', callback.name);
  assert(callback.name);
  this._slmq.whenReady.push(callback, function() {dbg('task-done:', callback.name);});
  return this;
};

CreateAmqp.prototype.close = function(callback) {
  var self = this;
  if (callback) {
    self.once('close', function() {
      callback();
    });
  }

  dbg('connection: queue close, cb?', !!callback);

  self._doWhenReady(function connClose(done) {
    dbg('connection: call end');
    //XXX(sam) don't think its clean to FIN a connection, amqp likes to see
    //an explicit close, sometimes self causes RST (but not always).
    self.end();
    self.once('close', function() {
      dbg('connection: end got close');
      done();
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

function queueOpen(self, type, connection, name) {
  self.name = name;
  self.type = type;
  self._connection = connection;
  c(self)._doWhenReady(function queueOpen(done) {
    self._q = c(self).queue(name, CREATE_OPTIONS, function() {
      done();
    });
    forwardEvent('error', self._q, self);
  });
}

function queueClose() {
  var self = this;

  c(self)._doWhenReady(function queueClose(done) {
    self._q.once('close', function() {
      done();
    });
    self._q.close();
    self._q = null;
  });

  return self;
}

function PushAmqp(connection, name) {
  queueOpen(this, 'push', connection, name);
}

util.inherits(PushAmqp, events.EventEmitter);

PushAmqp.prototype.publish = function(msg) {
  var self = this;
  c(self)._doWhenReady(function pushPublish(done) {
    c(self).publish(self._q.name, msg);
    done();
  });
  return self;
};

PushAmqp.prototype.close = queueClose;

CreateAmqp.prototype.pushQueue = function(name) {
  return new PushAmqp(this, name);
};

function PullAmqp(connection, name) {
  queueOpen(this, 'pull', connection, name);
}

util.inherits(PullAmqp, events.EventEmitter);

PullAmqp.prototype.subscribe = function(callback) {
  var self = this;

  if (callback) {
    self.on('message', callback);
  }

  c(self)._doWhenReady(function pullSubscribe(done) {
    self._q.subscribe(/* ack? prefetchCount? */ function(msg) {
      if (msg.data && msg.contentType) {
        msg = msg.data; // non-json
      } // else msg is already-parsed json
      self.emit('message', msg);
    });
    done();
  });
  return self;
};

PullAmqp.prototype.close = queueClose;

CreateAmqp.prototype.pullQueue = function(name, callback) {
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
  c(self)._doWhenReady(function pubPublish(done) {
    self._q.publish(topic, msg);
    done();
  });
  return self;
};

PubAmqp.prototype.close = queueClose;

CreateAmqp.prototype.pubQueue = function(name, callback) {
  return new PubAmqp(this, name, callback);
};

function SubAmqp(connection, name) {
  var self = this;
  self.name = name;
  self.type = 'sub';
  self._connection = connection;
  c(self)._doWhenReady(function subQueueOpen(done) {
    self._q = c(self).queue('', {autoDelete: true, exclusive: true}, function(q) {
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
}

util.inherits(SubAmqp, events.EventEmitter);

SubAmqp.prototype.subscribe = function(pattern, callback) {
  assert(pattern.indexOf('*') < 0);
  assert(pattern.indexOf('#') < 0);

  var self = this;

  if (callback) {
    self.on('message', callback);
  }

  c(self)._doWhenReady(function subBind(done) {
    dbg('pub: bind', pattern);
    self._q.bind(self.name, pattern + '.#');
    self._q.once('queueBindOk', function() {
      dbg('pub: bind ok');
      done();
    });
  });

  return self;
};

SubAmqp.prototype.close = queueClose;

CreateAmqp.prototype.subQueue = function(name) {
  return new SubAmqp(this, name);
};
