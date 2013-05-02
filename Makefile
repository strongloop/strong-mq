# Makefile

.PHONY: test lint default

default: lint test

test:
	@npm test

lint:
	@jshint *.js test

jenkins-build: jenkins-install jenkins-test

jenkins-install:
	npm install

jenkins-test:
	mocha -R xunit > xunit.xml

README.html: README.md
	marked -o $@ $^

