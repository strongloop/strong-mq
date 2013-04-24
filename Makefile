# Makefile

.PHONY: test

test:
	@mocha

jenkins-build: jenkins-install jenkins-test

jenkins-install:
	npm install

jenkins-test:
	mocha -R xunit > xunit.xml

