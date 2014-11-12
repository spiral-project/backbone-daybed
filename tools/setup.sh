#!/bin/bash

SERVER_URL=https://daybed.io/v1

http -v POST ${SERVER_URL}/models @definition.json
echo "Now you can connect to http://spiral-project.github.io/backbone-daybed/#<above-id>"
