# clustermq - MQ API with cluster integration, implemented over various message queues

Run tests:

    % make test

Requires rabbitmq server running on localhost:

    % rabbitmq-server

Works with 3.0.4, from homebrew.

Not working with 1.8.1, from debian 6.

Upgraded to 3.0.4 on debian using [rabbitmq repo](http://www.rabbitmq.com/install-debian.html)


Queue types:

- push/pull: each pushed msg is pulled by one
- pub/sub: publish msg with tag, subscribe to tag pattern
- req/rsp: each request gets one reply

Durability? Set at declaration?

Format: for receive.. json? strings?

