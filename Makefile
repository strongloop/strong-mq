# Makefile

.PHONY: test

test:
	@mocha

lint:
	jshint *.js test

jenkins-build: jenkins-install jenkins-test

jenkins-install:
	npm install

jenkins-test:
	mocha -R xunit > xunit.xml

