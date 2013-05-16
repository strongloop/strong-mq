// dbg: console.log if NODE_CLUSTERMQ_DEBUG is in env, otherwise silent

if (process.env.NODE_CLUSTERMQ_DEBUG) {
  module.exports = console.log;
} else {
  module.exports = function() {};
}
