#!/usr/bin/env bash

# Put the edison images in a zip file.

IMAGE="$1"

# Folder to contain all of the files
mkdir $IMAGE

# Copy over what we need. We do this because we don't want future
# changes to break the image now.
cp flash/$IMAGE.boot $IMAGE/
cp flash/$IMAGE.root $IMAGE/
cp flash/$IMAGE.home $IMAGE/

cp flash/flashall.sh $IMAGE/
cp flash/ftx_prog $IMAGE/

mkdir -p $IMAGE/ifwi
cp flash/ifwi/*.bin $IMAGE/ifwi/


mkdir -p $IMAGE/u-boot
cp flash/u-boot/u-boot-edison-2017_05.bin $IMAGE/u-boot/
cp flash/u-boot/edison-gateway.txt $IMAGE/u-boot/

cp flash/README-IMAGE.md $IMAGE/README.md

# Update flashall.sh so you don't have to pass in the --image argument.
sed -i -E "s/^IMAGE_ROOT=.*/IMAGE_ROOT=\"$IMAGE\"/" $IMAGE/flashall.sh

# And zip it
zip $IMAGE.zip -r $IMAGE
rm -r $IMAGE
