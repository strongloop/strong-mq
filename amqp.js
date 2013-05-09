// Provider: AMQP

module.exports = CreateAmqp;

var amqp = require('amqp');
var assert = require('assert');
var events = require('events');
var util = require('util');

function forwardEvent(name, from, to)
{
  from.on(name, to.emit.bind(to, name));
}

//-- Connection

function CreateAmqp(provider, url, options) {
  this.provider = provider;
  options = url ? {url: url} : options;
  amqp.Connection.call(this, options);
}

util.inherits(CreateAmqp, amqp.Connection);

CreateAmqp.prototype.open = function(callback) {
  //XXX assert(!this._connection, 'cannot open if already open');
  assert(callback);
  var self = this;
  this.once('ready', callback);
  this.connect();
  return this;
};

CreateAmqp.prototype.close = function(callback) {
  //XXXassert(this._connection, 'cannot close if not open');
  if (callback) {
    this.once('close', function() {
      callback(); // discard the arguments
    });
  }
  this.end();
  return this;
};

// XXX override .emit(), and filter out connection reset events after close?

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

function queueOpen(self, type, connection, name, callback) {
  self.name = name;
  self.type = type;
  self._connection = connection;
  self._q = c(self).queue(name, CREATE_OPTIONS, function() {
    callback(); // discard arguments from underlying cb
  });
  forwardEvent('error', self._q, self);
}

function queueClose(callback) {
  assert(this._q, 'cannot close queue if not open');

  if (callback) {
    this._q.once('close', callback);
  }

  this._q.close();
  this._q = null;

  return this;
}

function PushAmqp(connection, name, callback) {
  queueOpen(this, 'push', connection, name, callback);
}

util.inherits(PushAmqp, events.EventEmitter);

PushAmqp.prototype.publish = function(msg) {
  c(this).publish(this._q.name, msg);
  return this;
};

PushAmqp.prototype.close = queueClose;

CreateAmqp.prototype.pushQueue = function(name, callback) {
  return new PushAmqp(this, name, callback);
};

function PullAmqp(connection, name, callback) {
  queueOpen(this, 'pull', connection, name, callback);
}

util.inherits(PullAmqp, events.EventEmitter);

PullAmqp.prototype.subscribe = function(callback) {
  this._q.subscribe(/* ack? prefetchCount? */ function(msg) {
    if (msg.data && msg.contentType)
      msg = msg.data; // non-json
    // else msg is already-parsed json
    callback(msg);
  });
  return this;
};

PullAmqp.prototype.close = queueClose;

CreateAmqp.prototype.pullQueue = function(name, callback) {
  return new PullAmqp(this, name, callback);
};



//-- Pub/Sub Queue

function PubAmqp(connection, name, callback) {
  this._connection = connection;
  this.name = name;
  this.type = 'pub';
  this._q = c(this).exchange(name,
    {autoDelete: true, type: 'topic'}, function() {
    callback();
  });
}

util.inherits(PubAmqp, events.EventEmitter);

PubAmqp.prototype.publish = function(msg, topic) {
  this._q.publish(topic, msg);
  return this;
};

PubAmqp.prototype.close = queueClose;

CreateAmqp.prototype.pubQueue = function(name, callback) {
  return new PubAmqp(this, name, callback);
};

function SubAmqp(connection, name, callback) {
  var self = this;
  this._connection = connection;
  this.name = name;
  this.type = 'sub';
  this._q = c(this).queue('', {autoDelete: true, exclusive: true}, function(q) {
    callback();
  });
  this._q.subscribe(function(msg) {
    if (msg.data && msg.contentType)
      msg = msg.data; // non-json
    // else msg is already-parsed json
    self.emit('message', msg);
  });
  //onceOnEvents(this._q, 'queueBindOk', callback);
}

util.inherits(SubAmqp, events.EventEmitter);

SubAmqp.prototype.subscribe = function(pattern, callback) {
  assert(pattern.indexOf('*') < 0);
  assert(pattern.indexOf('#') < 0);

  this._q.bind(this.name, pattern + '.#');
  if (callback) {
    this.on('message', callback);
  }
  return this;
};

SubAmqp.prototype.close = queueClose;

CreateAmqp.prototype.subQueue = function(name, callback) {
  return new SubAmqp(this, name, callback);
};
