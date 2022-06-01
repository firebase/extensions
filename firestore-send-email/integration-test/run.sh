#!/bin/bash

#source scripts/set-default-credentials.sh
#./scripts/npm-link.sh

firebase --open-sesame extensionsemulator

(
  cd ../functions
  npm install 
  npm run test
)

