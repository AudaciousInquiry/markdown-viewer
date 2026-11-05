#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# The AWS Architecture Icons asset package is not redistributed with this
# extension. Download it from https://aws.amazon.com/architecture/icons/,
# unpack it, and point AWS_ICONS_DIR at the resulting folder.
#
#   AWS_ICONS_DIR=/path/to/asset-package sh build/package.sh chrome
#
# Without it the extension still builds; mermaid simply has no aws: icon
# pack registered, and diagrams that reference one fall back to a
# placeholder with a pointer to the gallery.

if [ -z "$AWS_ICONS_DIR" ]; then
  echo "aws-icons: AWS_ICONS_DIR not set, skipping icon pack"
  echo "aws-icons: see doc/aws-icons.md"
  exit 0
fi

if [ ! -d "$AWS_ICONS_DIR" ]; then
  echo "aws-icons: AWS_ICONS_DIR=$AWS_ICONS_DIR is not a directory" >&2
  exit 1
fi

node build-icons.js "$AWS_ICONS_DIR" ../../vendor/aws-icons.json
