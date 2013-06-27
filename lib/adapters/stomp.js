// Provider: STOMP

module.exports = CreateStomp;

var stomp = require('stomp-client');
var assert = require('assert');
var dbg = require('../dbg');
var events = require('events');
var jobs = require('../jobs');
var checkTopic = require('../topic').check;
var util = require('util');
var parse = require('url').parse;

function forwardEvent(name, from, to)
{
  from.on(name, to.emit.bind(to, name));
}


//-- Connection

function CreateStomp(provider, url, options) {
  var self = this;
  options = url ? parseUrl(url) : options;

  self.provider = provider;
  self._stomp = new stomp.StompClient(
    options.host,
    options.port,
    options.login,
    options.password,
    options.protocolVersion
  );
  self._whenReady = jobs.delayed();

  forwardEvent('error', self._stomp, self);
}

util.inherits(CreateStomp, events.EventEmitter);

function parseUrl(url) {
  var parts = parse(url, false, true); // no query, yes extract host
  var options = {
    host: parts.hostname,
    port: parts.port,
  };
  if (parts.auth) {
    var auth = parts.auth.split(':');
    options.login = auth[0];
    options.password = auth[1];
  }
  return options;
}

CreateStomp._parseUrl = parseUrl; // expose to unit tests


CreateStomp.prototype.open = function() {
  var self = this;

  self._stomp.connect(function() {
    dbg('task-start');
    self._whenReady.start();
  });
  return this;
};

CreateStomp.prototype._doWhenReady = function(callback) {
  dbg('task-queue:', callback.name);
  assert(callback.name);
  this._whenReady.push(callback, function() {
    dbg('task-done:', callback.name);
  });
  return this;
};

CreateStomp.prototype.close = function(callback) {
  var self = this;

  self._doWhenReady(function connClose(done) {
    dbg('connection close start');
    self._stomp.disconnect(function() {
      dbg('connection close done');
      done();
      if (callback) {
        callback();
      }
    });
  });

  return self;
};

//-- Common utilities

// Get connection for a queue
function c(q) {
  return q._connection;
}

// Get stomp object for a queue
function s(q) {
  return c(q)._stomp;
}

// stomp doesn't require queues to be opened or closed, your just publish to
// a name (either /queue/ for tasks or /topic/ for topics).
var PREFIX = {
  push: 'queue',
  pull: 'queue',
  pub: 'topic',
  sub: 'topic',
};

function stompOpen(self, type, connection, name) {
  var prefix = PREFIX[type];
  assert(prefix);

  self.name = name;
  self.type = type;
  self._connection = connection;
  self._q = '/'+prefix+'/'+name;
  dbg('queue opened', self._q);
}

function stompClose() {
  var self = this;
  self._q = null;
  return self;
}

function topicSelector(pattern) {
  pattern = checkTopic(pattern);

  // A pattern of '' should match any topic. In this case, we won't even
  // test for the topic key header, allowing a msg that has no topic
  // at all to still match the '' pattern.

  if (pattern == null || pattern === '') {
    return null;
  }

  return 'topickey LIKE \''+pattern+'.%\' OR topickey = \''+pattern+'\'';
}

function stompSubscribe(self, pattern, callback) {
  var selector = topicSelector(pattern);

  if (callback) {
    self.on('message', callback);
  }

  c(self)._doWhenReady(function pullSubscribe(done) {
    var headers = {};

    dbg('pull subscribe start+done');

    if (selector) {
      headers.selector = selector;
    }

    s(self).subscribe(self._q, headers, function(msg, headers) {
      dbg('pull subscribe callback', msg, headers);
      try {
        msg = decode(msg, headers['content-type']);
        self.emit('message', msg);
      } catch(er) {
        er.queue = self._q;
        er.type = self.type;
        er.source = 'subscribe';
        self.emit('error', er);
      }
    });
    done();
  });
  return self;
}

// either encode msg as json, and return encoded msg and content-type value,
// or use string value and return null content-type
// @return [contentType, buffer]
// Note: implementation ripped out of node-amqp
//
// XXX should this be merged to STOMP? if so, could be optional, triggered
// only if body is not a string/buffer, and if header has no content-type.
function encode(body) {
  // Handles 3 cases
  // - body is utf8 string
  // - body is instance of Buffer
  // - body is an object and its JSON representation is sent
  // Does not handle the case for streaming bodies.
  // Returns buffer.
  if (typeof(body) == 'string') {
    return [new Buffer(body, 'utf8')];
  } else if (body instanceof Buffer) {
    return [body];
  } else {
    var jsonBody = JSON.stringify(body);
    return [new Buffer(jsonBody, 'utf8'), 'application/json'];
  }
}

// return either an object/buffer/string, throws!
function decode(body, contentType) {
  if (contentType !== 'application/json') {
    return body;
  }
  return JSON.parse(body);
}

function stompPublish(self, msg, topic) {
  c(self)._doWhenReady(function pushPublish(done) {
    var headers = {};

    dbg(self.type+' publish start', msg);
    var encoding = encode(msg);
    if(encoding[1]) {
      headers['content-type'] = encoding[1];
    }
    if (topic) {
      topic = checkTopic(topic);
      headers.topickey = topic; // XXX see if I can use topic-key in the selector
    }
    s(self).publish(self._q, encoding[0], headers);
    //XXX(sam) callback will only happen if we implement acknowledgement
    // in the stomp client, for now, just have to say done in next tick.
    process.nextTick(function() {
      dbg(self.type+' publish HOPEFULLY done');
      done();
    });
  });
  return self;
}


//-- Push/Pull Queue

function PushStomp(connection, name) {
  stompOpen(this, 'push', connection, name);
}

util.inherits(PushStomp, events.EventEmitter);

PushStomp.prototype.publish = function(msg) {
  return stompPublish(this, msg);
};

PushStomp.prototype.close = stompClose;

CreateStomp.prototype.createPushQueue = function(name) {
  return new PushStomp(this, name);
};

function PullStomp(connection, name) {
  stompOpen(this, 'pull', connection, name);
}

util.inherits(PullStomp, events.EventEmitter);

PullStomp.prototype.subscribe = function(callback) {
  return stompSubscribe(this, null, callback);
};

PullStomp.prototype.close = stompClose;

CreateStomp.prototype.createPullQueue = function(name, callback) {
  return new PullStomp(this, name, callback);
};


//-- Pub/Sub Queue

function PubStomp(connection, name) {
  stompOpen(this, 'pub', connection, name);
}

util.inherits(PubStomp, events.EventEmitter);

PubStomp.prototype.publish = function(msg, topic) {
  topic = checkTopic(topic);
  return stompPublish(this, msg, topic);
};

PubStomp.prototype.close = stompClose;

CreateStomp.prototype.createPubQueue = function(name) {
  return new PubStomp(this, name);
};

function SubStomp(connection, name) {
  stompOpen(this, 'sub', connection, name);
}

util.inherits(SubStomp, events.EventEmitter);

SubStomp.prototype.subscribe = function(pattern, callback) {
  return stompSubscribe(this, pattern, callback);
};

SubStomp.prototype.close = stompClose;

CreateStomp.prototype.createSubQueue = function(name) {
  return new SubStomp(this, name);
};
