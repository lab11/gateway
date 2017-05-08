#!/bin/bash

# This script creates the .boot .root .home images from a running edison
# that can be flashed on to a new edison.
#
# This script takes a while.

# USAGE
# =====
#
# sudo ./save_edison_image.sh <version> <qualifiers>
#
# Example:
# sudo ./save_edison_image.sh 1.10.0 edison_v3-umich-triumvi

set -o pipefail
set -e
set -x

SDCARD_PATH=/media/sdcard
VERSION=$1
QUALIFIERS=$2

NAME_ROOT=swarm-gateway-$VERSION-$QUALIFIERS.root
NAME_HOME=swarm-gateway-$VERSION-$QUALIFIERS.home
NAME_BOOT=swarm-gateway-$VERSION-$QUALIFIERS.boot

# Another copy of root to mount
mkdir -p $SDCARD_PATH/rootcopy
mount /dev/mmcblk0p8 $SDCARD_PATH/rootcopy

# Setup a filesystem in a file on the SD card to put the root filesystem in
dd if=/dev/zero of=$SDCARD_PATH/$NAME_ROOT count=1500 bs=1M iflag=fullblock
mkfs.ext4 $SDCARD_PATH/$NAME_ROOT

# Mount that filesystem so we can copy to it
mkdir -p $SDCARD_PATH/rootimage
mount $SDCARD_PATH/$NAME_ROOT $SDCARD_PATH/rootimage

# Copy the root filesystem into that virtual filesystem
cp -r $SDCARD_PATH/rootcopy/* $SDCARD_PATH/rootimage/

# Make it so that first_install.sh runs on boot
sed -i -E "s/^(#*)(.*)(first-install\.sh)(.*)$/\2\3\4/g" $SDCARD_PATH/rootimage/etc/rc.local

# Can unmount these now
umount $SDCARD_PATH/rootcopy
umount $SDCARD_PATH/rootimage
rm -r $SDCARD_PATH/rootcopy
rm -r $SDCARD_PATH/rootimage

# Can probably just copy these directly as we don't really expect them to
# get written to.
sudo dd bs=4M if=/dev/mmcblk0p7 of=$SDCARD_PATH/$NAME_BOOT
sudo dd bs=4M if=/dev/mmcblk0p10 of=$SDCARD_PATH/$NAME_HOME
