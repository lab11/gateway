#!/bin/bash

# Where the debian file system will be created
ROOTDIR=`pwd`/sidroot

# This allows us to run commands inside of the new filesystem
CHROOTCMD="eval LC_ALL=C LANGUAGE=C LANG=C chroot $ROOTDIR"


echo "*** Build the edison kernel ***"

git submodule update --init edison-linux-helper

# Copy all of our additional patches
cp patches/* edison-linux-helper/patches/

# Get the kernel
pushd edison-linux-helper
make config
popd

# Use our kernel config file
cp configs/edison_v3-3.10.98.config edison-linux-helper/edison-linux/.config
pushd edison-linux-helper
make config
popd

# Build the kernel
pushd edison-linux-helper/edison-linux
make -j8
popd

# Capture all of the required built output into collected
pushd edison-linux-helper
make collected
popd

echo "*** Start creating a debian rootfs image ***"

# Make a spot to put the debian filesystem.
rm -rf $ROOTDIR
mkdir $ROOTDIR

# Create the base filesystem using a debian tool.
debootstrap --arch i386 sid $ROOTDIR http://http.debian.net/debian/

# Install necessary packages
$CHROOTCMD apt clean
$CHROOTCMD apt update
$CHROOTCMD apt -y install dbus vim openssh-server sudo bash-completion dosfstools file curl
$CHROOTCMD apt -y install network-manager net-tools
$CHROOTCMD apt -y install python python-serial
$CHROOTCMD apt -y install bluetooth bluez libbluetooth-dev libudev-dev libavahi-compat-libdnssd-dev
$CHROOTCMD apt -y install libqmi-utils resolvconf mosquitto git u-boot-tools usbutils
$CHROOTCMD apt -y install screen psmisc rfkill
$CHROOTCMD apt -y install make g++

# Create a default user "debian" with the correct password and settings
$CHROOTCMD useradd -m debian -p '$6$8FSbjofK.cgC3M$.gkGcDrdnUlsbKxxjYVfwBWK5zW5TNa2r7XICejwwDIOWT.99iv9wCM.VvxOCeaWE9ik/P6tRgW8sH0Z0tCbZ/' -G adm,sudo,dialout -s /bin/bash

# Add in kernel modules
mkdir -p $ROOTDIR/lib/modules
cp -r edison-linux-helper/collected/3.10.98-poky-edison/lib/modules/3.10.98-poky-edison $ROOTDIR/lib/modules/

# Setup SSH so root can't ssh
sed -i -E "s/.*PermitRootLogin.*/PermitRootLogin no/g" $ROOTDIR/etc/ssh/sshd_config

# Add /sbin to user path
sed -i 's\/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games\/usr/local/bin:/usr/bin:/bin:/sbin\g' $ROOTDIR/etc/profile

# Set hostname
echo "swarmgateway" > $ROOTDIR/etc/hostname

# Add swarmgateway to hosts so sudo doesn't complain
echo "127.0.1.1    swarmgateway" >> $ROOTDIR/etc/hosts

# Start modem manager on boot
$CHROOTCMD systemctl enable ModemManager.service

# Make QMI config file for libqmi tools that want it.
echo "APN=" > $ROOTDIR/etc/qmi-network.conf

# Setup resolv.conf so that cellular doesn't break our DNS
printf '%s\n' 'nameserver 8.8.8.8' 'nameserver 8.8.4.4' > $ROOTDIR/etc/resolvconf/resolv.conf.d/base
$CHROOTCMD resolvconf -u

# Install node.js
$CHROOTCMD curl -sL https://deb.nodesource.com/setup_6.x | $CHROOTCMD bash -
$CHROOTCMD apt -y install nodejs

# Enable Node privileged access to BLE so it doesn't need sudo.
$CHROOTCMD setcap cap_net_raw+eip $(eval readlink -f `which node`)

# Make sure we can do IPv6 mDNS lookups.
sed -i "s/mdns4_minimal/mdns_minimal/g" $ROOTDIR/etc/nsswitch.conf

# Cap log files so we don't run out of space
echo "# Cap log files on the constrained edison" >> $ROOTDIR/etc/logrotate.conf
echo "rotate 1" >> $ROOTDIR/etc/logrotate.conf
echo "maxsize 10M" >> $ROOTDIR/etc/logrotate.conf

# Set login banner
sed -i -E "s/.*Banner.*/Banner \/etc\/issue.net/g" $ROOTDIR/etc/ssh/sshd_config

# Make space for the SD card
mkdir -p $ROOTDIR/media/sdcard

# Make space for /factory
mkdir -p $ROOTDIR/factory

# Setup the make file system config so that we don't create 64 bit filesystems on the edison
sed -i "s/features = has_journal,extent,huge_file,flex_bg,metadata_csum,64bit,dir_nlink,extra_isize/features = has_journal,extent,huge_file,flex_bg,uninit_bg,dir_nlink,extra_isize/g" $ROOTDIR/etc/mke2fs.conf
sed -i "s/features = has_journal,extent,huge_file,flex_bg,metadata_csum,inline_data,64bit,dir_nlink,extra_isize/features = has_journal,extent,huge_file,flex_bg,uninit_bg,dir_nlink,extra_isize/g" $ROOTDIR/etc/mke2fs.conf

# Setup /home
mkdir -p $ROOTDIR/home/debian
$CHROOTCMD git clone https://github.com/lab11/gateway.git /home/debian/gateway
$CHROOTCMD git clone https://github.com/lab11/gateway-tools.git /home/debian/gateway-tools

# Copy overlay files into this filesystem
cp -r overlay $ROOTDIR

# Setup bluetooth
$CHROOTCMD systemctl enable bluetooth-patchram.service
ln -s /lib/systemd/system/bluetooth.target $ROOTDIR/etc/systemd/system/multi-user.target.wants/bluetooth.target

# Make sure rc.local runs on boot.
# Not sure what the other arguments that systemd-rc-local-generator wants are...
$CHROOTCMD /lib/systemd/system-generators/systemd-rc-local-generator /etc/systemd/system a b

# Install node packages for hte gateway software
mkdir -p $ROOTDIR/home/debian/gateway/software/node_modules
for i in $ROOTDIR/home/debian/gateway/software/* ; do
  if [[ -d $i ]] && [[ $i != "node_modules" ]]; then
    pushd $i > /dev/null
    PREFIX=/home/debian/gateway/software/`basename $i`
    $CHROOTCMD npm --prefix $PREFIX install --build-from-source
    popd > /dev/null
  fi;
done

# Setup permissions
chown -R 1000:1000 $ROOTDIR/home/debian

# Cleanup space on rootfs
$CHROOTCMD apt-get clean

# Create the rootfs ext4 image
rm -f edison-image.root
dd if=/dev/zero of=edison-image.root count=1500 bs=1M
mkfs.ext4 -F -L rootfs -O none,has_journal,ext_attr,resize_inode,dir_index,filetype,extent,flex_bg,sparse_super,large_file,huge_file,uninit_bg,dir_nlink,extra_isize edison-image.root

# Copy the rootfs content in the ext4 image
rm -rf mntroot
mkdir mntroot
mount -o loop edison-image.root mntroot
cp -a $ROOTDIR/* mntroot/
rm -rf mntroot/home
mkdir -p mntroot/home
umount mntroot
rmdir mntroot

# Create the rootfs home image
rm -f edison-image.home
dd if=/dev/zero of=edison-image.home count=2785247 bs=512
mkfs.ext4 -F -L home -O none,has_journal,ext_attr,resize_inode,dir_index,filetype,extent,flex_bg,sparse_super,large_file,huge_file,uninit_bg,dir_nlink,extra_isize edison-image.home

# Copy the home content in the ext4 image
rm -rf mnthome
mkdir mnthome
mount -o loop edison-image.home mnthome
cp -aR $ROOTDIR/home/debian mnthome/
umount mnthome
rmdir mnthome
