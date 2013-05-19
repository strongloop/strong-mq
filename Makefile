# Makefile

-include local.mk

.PHONY: test lint default

default: lint test

test:
	@npm test

lint:
	@npm run lint

glint:
	@gjslint --nojsdoc *.js test/*.js lib

jenkins-build: jenkins-install jenkins-test

jenkins-install:
	npm install

jenkins-test:
	./node_modules/.bin/mocha -R xunit > xunit.xml

README.html: README.md
	./node_modules/.bin/marked -o $@ $^

