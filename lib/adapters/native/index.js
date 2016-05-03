// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: strong-mq
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

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
