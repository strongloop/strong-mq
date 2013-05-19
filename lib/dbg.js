// dbg: console.log if NODE_SLMQ_DEBUG is in env, otherwise silent

if (process.env.NODE_SLMQ_DEBUG) {
  module.exports = console.log;
} else {
  module.exports = function() {};
}
