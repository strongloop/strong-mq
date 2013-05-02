# clustermq - abstract message queue API

[slnode-clustermq](https://github.com/strongloop/slnode-clustermq) is an abstraction layer
over 3 common message distribution patterns, and (eventually) several different message
queue implementations.


## Message Patterns

- work queue: published messages are delivered to a single subscriber, common when
  distributing work items that should be processed by a single worker
- topic: published messages are delivered to all subscribers, each message is associated
  with a "topic", and subscribers can specify the topic patterns they want to receive
- rpc: published messages are delivered to a single subscriber, and a associated response
  is returned to the original publisher


## Installation

    % npm test
    % npm install clustermq

XXX(sroberts) Requires clustermq to be published to a (private?) npm repository


## Synopsis

An example of connecting to a server and listening on a work queue:

```javascript
var connection = require('clustermq')
    .declare('amqp://localhost');

connection.open(function (err, c) {
    assert(!err);
    c.pushQueue(function (err, q) {
        q.subscribe(function (err, msg) {
            assert(!err);
            console.log(msg);
        });
    });
});
```


## Callbacks

All callbacks follow the standard convention of the first argument being an `Error` object
on failure, or null on success. Any other results will follow the error argument.

Asynchronous errors are emitted as events.


## Messages

Message objects can be either an `Object` or `Array`, transmitted as JSON, or a `String`
or `Buffer`, transmitted as data.


## Queues

Queues are closed when they are empty and have no users. They might or might not
be persistent across restarts of the queue broker, depending on the provider.


## Connections

### clustermq.declare(options|url)

Returns a connection object for a specific provider, configuration can
be declared using a options object, or a url:

* `options` {Object}
* `url` {provider://...}

Supported providers are:

* `'amqp'`: RabbitMQ

Supported options, other than `provider`, depend on the provider:

* `provider` {String} Mandatory name of provider, such as `'amqp'`
* `host` {String} Name of host to connect to (if supported by provider)
* `port` {String} Port to connect to (if supported by provider)
* `...` As supported by the provider

The connection object is an `EventEmitter`:

* Event: 'error' {Error} Errors during connection open and close will be passed to the
  callback, but asynchronous errors are emitted. The specific reasons for the error
  will depend on the provider.

Example of declaring amqp, using an options object:

    connection = clustemq.declare({
        provider: 'amqp',
        host: 'localhost',
        user: 'guest',
    });

Example of declaring amqp, using a URL:

    connection = clusermq.declare('amqp://guest@localhost');


### connection.open(function callback(err))

Callsback with null when connection is ready for use, or an `Error` object on failure.


### connection.close(function callback(err))

Callsback with null when connection has been closed sucesfully, or an `Error` object on failure.


## Work queues (push/pull)

### connection.pushQueue(function callback(err))

Returns a queue for pushing work items.

Callsback with null on success, an `Error` object on failure.

### push.publish(msg)

* `msg` {Object} Message to push onto the queue

### push.close(function callback(err))

Callsback with null, an `Error` object on failure.

### connection.pullQueue(function callback(err))

Returns a queue for pulling work items.

Callsback with null on success, an `Error` object on failure.

### pull.subscribe(function callback(err, msg))

* `msg` {Object} Message pulled off the queue

### pull.close(function callback(err))

Callsback with null, an `Error` object on failure.

### queue.name {String}

Name used to create queue.

### queue.type {String}

Either 'push', or 'pull'.

## Topic queue (pub/sub)

Topics are dot-seperated words with wildcards.

XXX(sroberts) Fill in exact syntax.
XXX(sroberts) Can topics be empty?

### connection.pubQueue(function callback(err))

Returns a queue for publishing on topics.

Callsback with null on success, an `Error` object on failure.

### pub.publish(msg, topic)

* `msg` {Object} Message to publish onto the queue
* `topic` {String} Topic of message, default is `''`

### pub.close(function callback(err))

Callsback with null, an `Error` object on failure.

### connection.subQueue(function callback(err))

Returns a queue for subscribing to topics.

Callsback with null on success, an `Error` object on failure.

### sub.subscribe([topic,] function callback(err, msg))

* `msg` {Object} Message subed off the queue
* `topic` {String} Topic of message, may contain wildcards, default is `''`

XXX(sroberts) Multiple subscribes lead to a callback per topic? Even with duplicate
topics? Hm, maybe Events would be better here:

    sub.subscribe('that.*')
      .subscribe('this.*')
      .on('receive', function callback(msg) { ... })

### sub.close(function callback(err))

Callsback with null, an `Error` object on failure.


## Provider: AMQP

Support for RabbitMQ using the AMQP protocol. This provider is based
on the [node-amqp](https://npmjs.org/package/node-amqp) module, see
its documentation for more information.

The options (except for `.provider`) or url is passed directly to node-amqp, supported
options are:

* `host` {String} Hostname to connect to, defaults to `'localhost'`
* `port` {String} Port to connect to, defaults to `5672`
* `login` {String} Username to authenticate as, defaults to `'guest'`
* `password` {String} Password to authenticate as, defaults to `'guest'`
* `vhost` {String} Vhost, defaults to `'/'`

The URL format for specifying the options above is:

    amqp://[login][:password][@]host[:port][/vhost]

Note that the `host` is mandatory when using a URL.

Note that node-amqp supports RabbitMQ 3.0.4, or higher.


## Testing

Requires rabbitmq server running on localhost:

    % rabbitmq-server

Works with 3.0.4, from homebrew.

Not working with 1.8.1, from debian 6.

Upgraded to 3.0.4 on debian using [rabbitmq repo](http://www.rabbitmq.com/install-debian.html)


## Future work

Future work may include support for the following, as needed, and if
common mechanisms exist among the various queue providers.

- Acknowledgement of msg processing, particularly for work queues, so
  "exactly once" message handling can be guaranteed. The current API
  is strictly "one or less", if a consumer fails to process a message
  that has been delivered to it, it will never be processed.
- Flow control, so consumers aren't overwhelmed by msgs, and can
  provide back pressure on the queue when under load.
- Persistence, whether queues persist beyond the existence of any
  users or undelivered messages.


