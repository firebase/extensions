#!/bin/bash
if ! [ -x "$(command -v firebase)" ]; then
  echo "❌ Firebase tools CLI is missing."
  exit 1
fi
# TODO check out the firebase CLI, there are options for ext emulators
# firebase emulators:start &