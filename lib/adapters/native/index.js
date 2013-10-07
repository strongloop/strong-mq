var assert = require('assert');
var cluster = require('cluster');
var VERSION = require('../../../package.json').version;

if(cluster._strongMqNative) {
  assert(
    cluster._strongMqNative.VERSION === VERSION,
    'Multiple versions of strong-mq are being initialized.\n' +
    'This version ' + VERSION + ' is incompatible with already initialized\n' +
    'version ' + cluster._strongMqNative.VERSION + '.\n'
  );
  module.exports = cluster._strongMqNative;
  return;
}
module.exports = require('./connection');
module.exports.VERSION = VERSION;
cluster._strongMqNative = module.exports;
