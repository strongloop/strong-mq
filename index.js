// clustermq

var amqp = require("amqp");
var assert = require("assert");

var providers = {};

// amqp

providers.amqp = DeclareAmqp;

// Supported options are as for amqp.createConnection(): host, port, login,
// password, vhost.
function DeclareAmqp(options) {
  this.provider = options.provider;
  this._connectOptions = copy(options);

  delete this._connectOptions.provider;
}

DeclareAmqp.prototype.open = function (callback) {
  assert(!this._connection, "connectors can only be opened once");

  var c = this._connection = amqp.createConnection(this._connectOptions);

  function on_ready() {
    c.removeListener('error', on_error);
    callback();
  };

  function on_error(err) {
    c.removeListener('ready', on_ready);
    callback(err);
  };

  c.once('ready', on_ready);
  c.once('error', on_error);

  return this;
};

DeclareAmqp.prototype.close = function (callback) {
  if (this._connection) {
    if (callback) {
      this._connection.on('close', function (had_error) {
        // discard had_error, it's boolean instead of an Error object
        callback();
      });
    }
    this._connection.end();
    this._connection = null;
  }
  return this;
};

// options.provider: mandatory, one of "amqp"
// options.*: as supported by provider
exports.declare = function (options) {
  return new providers[options.provider](options);
};

// TODO find libs for these
function copy(s) {
  var t = {};
  for (var p in s) {
    t[p] = s[p];
  }
  return t;
}

