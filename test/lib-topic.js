var assert = require('assert');

var topic = require('../lib/topic');

describe('topic', function() {
  it('should be a string', function() {
    assert(topic.valid(''));
    assert(!topic.valid({}));
    assert(!topic.valid(1));
    assert(!topic.valid(true));
  });

  it('should accept null and undefined', function() {
    assert.equal('', topic.check());
    assert.equal('', topic.check(null));
    assert.equal('', topic.check(undefined));
    assert.equal('X', topic.check('X'));
  });

  it('should be dot-seperated words', function() {
    assert(topic.valid('0'));
    assert(topic.valid('A'));
    assert(topic.valid('_'));
    assert(topic.valid('Ab0_z'));
    assert(topic.valid('Ab0_z._'));
    assert(topic.valid('Ab0_z._.a.9.Q'));

    assert(!topic.valid('.'));
    assert(!topic.valid('+'));
    assert(!topic.valid('a.'));
    assert(!topic.valid('Ab0_z._.'));
  });

  it('should escape dots for use in regular expressions', function() {
    assert.equal(topic._escape('a.b.c'), 'a\\.b\\.c');
  });

  it('should match identical prefixes', function() {
    assert(topic.matcher('a').test('a'));
    assert(topic.matcher('a').test('a.c'));
    assert(topic.matcher('a').test('a.c.d'));

    assert(!topic.matcher('a').test('ab'));


    assert(topic.matcher('a0_._9_').test('a0_._9_'));

    assert(!topic.matcher('a0_z._9_').test('a0_._9_'));
    assert(!topic.matcher('a0_._9_').test('a0_z._9_'));
    assert(!topic.matcher('a0_._9_').test('a0_._9_z'));


    assert(topic.matcher('some').test('some.thing.really.deep'));
    assert(topic.matcher('some').test('some.thing.really'));
    assert(topic.matcher('some').test('some.thing'));
    assert(topic.matcher('some').test('some'));

    assert(!topic.matcher('some').test('something'));
    assert(!topic.matcher('some').test('som'));
    assert(!topic.matcher('some').test(''));


    assert(topic.matcher('').test('some.thing.really.deep'));
    assert(topic.matcher('').test('some.thing.really'));
    assert(topic.matcher('').test('some.thing'));
    assert(topic.matcher('').test('some'));
    assert(topic.matcher('').test(''));


    assert(topic.matcher('some.thing').test('some.thing.really.deep'));
    assert(topic.matcher('some.thing').test('some.thing.really'));
    assert(topic.matcher('some.thing').test('some.thing'));

    assert(!topic.matcher('some.thing').test('some'));
    assert(!topic.matcher('some.thing').test(''));
  });

});
