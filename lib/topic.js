// topic: utility code for topics

var assert = require('assert');

exports.valid = valid;
exports.escape = escape;

function valid(topic) {
  if (!isString(topic)) {
    return false;
  }

  if (topic === '') {
    return true;
  }

  if (/^\w+(?:\.\w+)*$/.test(topic)) {
    return true;
  }

  return false;
}

function isString(obj) {
  return typeof obj === 'string' || obj instanceof String;
}

function escape(topic) {
  assert(valid(topic));

  return topic.replace(/\./g, '\\.');
}
