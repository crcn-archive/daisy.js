all: node web

clean:
	rm -rf lib

node:
	mesh make node

web:
	mesh make web
