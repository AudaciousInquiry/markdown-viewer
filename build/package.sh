#!/bin/bash

# exit if any of the intermediate steps fail
set -e

browser=$1

if [ -z "$browser" ]; then
  echo "Specify target browser"
  echo "chrome, firefox"
  exit 1
fi

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# cleanup
rm -rf ../themes
rm -rf ../vendor
rm -f ../markdown-viewer.zip
mkdir -p ../themes
mkdir -p ../vendor

# build deps
sh aws-icons/build.sh
sh bootstrap/build.sh
sh csso/build.sh
sh markdown-it/build.sh
sh marked/build.sh
sh mathjax/build.sh
sh mdc/build.sh
sh mermaid/build.sh
sh mithril/build.sh
sh panzoom/build.sh
sh prism/build.sh
sh remark/build.sh
sh themes/build.sh $browser

# copy files
mkdir -p tmp
mkdir -p tmp/markdown-viewer
cd ..
cp -r background content gallery icons options popup themes vendor LICENSE build/tmp/markdown-viewer/

# copy manifest.json
if [ "$browser" = "chrome" ]; then
  cp manifest.chrome.json build/tmp/markdown-viewer/manifest.json
  cp manifest.chrome.json manifest.json
elif [ "$browser" = "firefox" ]; then
  cp manifest.firefox.json build/tmp/markdown-viewer/manifest.json
  cp manifest.firefox.json manifest.json
fi

# The repo root is a loadable unpacked extension at this point: themes/,
# vendor/ and manifest.json are all in place. The zip is only needed to submit
# to a store, so a missing zip binary (common on Windows) should not fail the
# build for someone who only wants to load the extension unpacked.
if ! command -v zip > /dev/null 2>&1; then
  echo
  echo "zip not found, skipping archive."
  echo "The unpacked extension is ready: load this folder via"
  echo "  chrome://extensions -> Developer mode -> Load unpacked"
  # cwd is the repo root here, not build/
  rm -rf build/tmp/
  exit 0
fi

# archive the markdown-viewer folder itself
if [ "$browser" = "chrome" ]; then
  cd build/tmp/
  zip -r ../../markdown-viewer.zip markdown-viewer
  cd ..
# archive the contents of the markdown-viewer folder
elif [ "$browser" = "firefox" ]; then
  cd build/tmp/markdown-viewer/
  zip -r ../../../markdown-viewer.zip .
  cd ../../
fi

# cleanup
rm -rf tmp/
