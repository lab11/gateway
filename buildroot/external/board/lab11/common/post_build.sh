#!/bin/bash

TARGET_ROOTFS_DIR=$1

# Add swarmgateway to `hosts`
echo "127.0.1.1    swarmgateway" >> $TARGET_ROOTFS_DIR/etc/hosts

### MAKE SURE WE ACTUALLY NEED THIS
# Make sure we can do IPv6 mDNS lookups
sed -i "s/mdns4_minimal/mdns_minimal/g" $TARGET_ROOTFS_DIR/etc/nsswitch.conf

# Setup issue.net so the banner prints on ssh login
echo "Banner /etc/issue.net" >> $TARGET_ROOTFS_DIR/etc/ssh/sshd_config
