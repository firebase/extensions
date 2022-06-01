#!/bin/bash

#source scripts/set-default-credentials.sh
#./scripts/npm-link.sh

(
  cd ../functions
  npm install 
  npm run test
)

