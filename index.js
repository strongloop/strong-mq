// attempt to lazy-load providers on reference

var assert = require('assert');
var copy = require('underscore').clone;
var parse = require('url').parse;

function urlProvider(url) {
  var protocol = parse(url).protocol;
  return protocol.split(':')[0];
}

function extractProvider(options) {
  var provider;
  var url;
  if (typeof options == 'string') {
    provider = urlProvider(options);
    url = options;
    options = null;
  } else {
    provider = options.provider;
    url = null;
    options = copy(options);
    delete options.provider;
  }

  assert(provider, 'options must specify the provider');

  return [provider, url, options];
}

exports.create = function(options) {
  var parsed = extractProvider(options || {
    provider: 'native'
  });
  var provider = parsed[0];
  var url = parsed[1];
  options = parsed[2];
  var Connection = require('./lib/adapters/' + provider);
  return new Connection(provider, url, options);
};
