#!/bin/bash

# Usage:
#
#  ./make_edison_debian_image.sh --version 0.1.0 --umich --triumvi
#
#  --umich and --triumvi are optional
#
#  Pass --uboot to build an edison-compatible u-boot from source.

# Parse arguments
UMICH=0
TRIUMVI=0
UBOOT=0

while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    --version)
    VERSION="$2"
    shift # past argument
    ;;
    --umich)
    UMICH=1
    ;;
    --triumvi)
    TRIUMVI=1
    ;;
    --uboot)
    UBOOT=1
    ;;
    *)
            # unknown option
    ;;
esac
shift # past argument or value
done

# Build output file name for this copy of the edison
VERSION_STRING=$VERSION-edison
if [[ $UMICH -eq 1 ]]; then VERSION_STRING=$VERSION_STRING-umich; fi
if [[ $TRIUMVI -eq 1 ]]; then VERSION_STRING=$VERSION_STRING-triumvi; fi
OUTFILENAME="swarm_gateway-$VERSION_STRING"

if [[ "VER$VERSION" == "VER" ]]; then
	echo "ERROR! Need a version!"
	exit 1
fi

read -p "Creating image named $OUTFILENAME. Look good? " -n 1 -r
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi
echo ""

set -x

# Where the debian file system will be created
ROOTDIR=`pwd`/debroot-$VERSION_STRING
ROOTDIR_CLEAN=debroot-clean

# This allows us to run commands inside of the new filesystem
CHROOTCMD="eval LC_ALL=C LANGUAGE=C LANG=C chroot $ROOTDIR"

# Other key directories
MODULESDIR="edison-linux-helper/collected/3.10.98-poky-edison/lib/modules/3.10.98-poky-edison"

# Detect the user that owns this folder and try to run the non root command
# as this user. Maybe it will work!
# https://unix.stackexchange.com/questions/7730
USER=$(stat -c '%U' `pwd`)

if [[ $UBOOT -eq 1 ]]; then
	echo "*** Building u-boot for the edison ***"

	# Make sure we have the repo
	sudo -u $USER git submodule update --init edison-u-boot

	# Apply any patches that we need
	pushd edison-u-boot
	for P in ../patches/u-boot/*.patch; do
		sudo -u $USER git apply $P
	done

	# Setup the .config file
	sudo -u $USER make edison_defconfig

	# Build the new version of u-boot
	sudo -u $USER make -j8

	# Need to round up the filesize to a multiple of 4096 bytes
	sudo -u $USER truncate -s %4096 u-boot.bin
	popd

	sudo -u $USER cp edison-u-boot/u-boot.bin u-boot-edison-2017_05.bin
fi

if [ ! -d $MODULESDIR ]; then
	echo "*** Build the edison kernel ***"

	# Make sure we have the submodule checked out
	sudo -u $USER git submodule update --init edison-linux-helper

	# Copy all of our additional patches
	sudo -u $USER cp patches/linux/* edison-linux-helper/patches/

	# Get the kernel
	pushd edison-linux-helper
	sudo -u $USER git submodule update --init edison-linux
	sudo -u $USER git submodule update --init edison-bcm43340
	sudo -u $USER ./apply.sh
	popd

	# Use our kernel config file
	sudo -u $USER cp configs/edison_v3-3.10.98.config edison-linux-helper/edison-linux/.config

	# Build the kernel.
	# NOTE: need gcc <= 5 for this old of a kernel.
	pushd edison-linux-helper/edison-linux
	sudo -u $USER make -j8 CC=gcc-5
	popd

	# Build the BCM43340 module
	pushd edison-linux-helper/edison-bcm43340
	sudo -u $USER KERNEL_SRC=../edison-linux make CC=gcc-5
	popd

	# Capture all of the required built output into collected
	pushd edison-linux-helper
	sudo -u $USER mkdir -p collected
	sudo -u $USER ./collect.sh
	popd

else
	echo "*** Edison kernel already built! ***"
	echo "***   Not rebuilding."
	echo "***   Using what is in $MODULESDIR"
fi

echo "*** Start creating a debian rootfs image ***"

# Clean up an old filesystem if it exists
rm -rf $ROOTDIR

# Check to see if we already have a copy of the debian base image.
# If we do, then don't bother running debootstrap again.
if [ ! -d $ROOTDIR_CLEAN ]; then
	# Create the base filesystem using a debian tool.
	debootstrap --arch i386 stretch $ROOTDIR_CLEAN http://http.debian.net/debian/
	echo "***** Finished creating base debian filesystem"
else
	echo "***** Using existing base debian filesystem"
fi

# Copy the base filesystem so we can both save it and work on it.
cp -r $ROOTDIR_CLEAN $ROOTDIR

# Make /tmp writable
chmod 777 $ROOTDIR/tmp

# I don't know why we have to do this.
# The first time I ran this script this was already done. Later, it changed,
# and didn't work until I ran this command.
echo "deb http://cdn-fastly.deb.debian.org/debian sid main" > $ROOTDIR/etc/apt/sources.list

# Install necessary packages
$CHROOTCMD apt clean
$CHROOTCMD apt update
$CHROOTCMD apt -y install dbus vim openssh-server sudo bash-completion dosfstools file curl
$CHROOTCMD apt -y install network-manager net-tools
$CHROOTCMD apt -y install python python-serial python3 python3-pip
$CHROOTCMD apt -y install bluetooth bluez libbluetooth-dev libudev-dev libavahi-compat-libdnssd-dev
$CHROOTCMD apt -y install libqmi-utils resolvconf mosquitto mosquitto-clients git u-boot-tools usbutils dnsutils
$CHROOTCMD apt -y install screen psmisc rfkill
$CHROOTCMD apt -y install make g++
$CHROOTCMD apt -y install exfat-fuse exfat-utils
$CHROOTCMD apt -y install libftdi-dev

# Add in kernel modules
mkdir -p $ROOTDIR/lib/modules
cp -r $MODULESDIR $ROOTDIR/lib/modules/

# Remove machine-id so that it will get generated on boot.
rm $ROOTDIR/var/lib/dbus/machine-id
rm $ROOTDIR/etc/machine-id
touch $ROOTDIR/etc/machine-id
chmod 444 $ROOTDIR/etc/machine-id

# Setup SSH so root can't ssh
sed -i -E "s/.*PermitRootLogin.*/PermitRootLogin no/g" $ROOTDIR/etc/ssh/sshd_config

# Add /sbin to user path
sed -i 's\/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games\/usr/local/bin:/usr/bin:/bin:/sbin\g' $ROOTDIR/etc/profile

# Add swarmgateway to hosts so sudo doesn't complain
echo "127.0.1.1    swarmgateway" >> $ROOTDIR/etc/hosts

# Start modem manager on boot
$CHROOTCMD systemctl enable ModemManager.service

# Setup resolv.conf so that cellular doesn't break our DNS
printf '%s\n' 'nameserver 8.8.8.8' 'nameserver 8.8.4.4' > $ROOTDIR/etc/resolvconf/resolv.conf.d/base
$CHROOTCMD resolvconf -u

# Install node.js
$CHROOTCMD curl -sL https://deb.nodesource.com/setup_6.x | $CHROOTCMD bash -
$CHROOTCMD apt -y install nodejs

# Install package for DDNS script support
$CHROOTCMD pip3 install dnspython3

# Enable Node privileged access to BLE so it doesn't need sudo.
$CHROOTCMD setcap cap_net_raw+eip $(eval readlink -f `which node`)

# Make sure we can do IPv6 mDNS lookups.
sed -i "s/mdns4_minimal/mdns_minimal/g" $ROOTDIR/etc/nsswitch.conf

# We want to be more diligent about our logs
cp $ROOTDIR/etc/cron.daily/logrotate $ROOTDIR/etc/cron.hourly/logrotate

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
shopt -s dotglob
cp -R overlay/* $ROOTDIR

# Build ftx_prog so that we can setup the FTDI for the CC2538
$CHROOTCMD git clone https://github.com/richardeoin/ftx-prog.git /home/debian/ftx-prog
$CHROOTCMD make -C /home/debian/ftx-prog
cp $ROOTDIR/home/debian/ftx-prog/ftx_prog $ROOTDIR/opt/edison/
rm -rf $ROOTDIR/home/debian/ftx-prog

# Make sure firmware is symlinked to the /etc folder
ln -s /lib/firmware $ROOTDIR/etc/firmware

# Update version number
sed -i -E "s/^(.*)SwarmGateway.*$/\1SwarmGateway v$VERSION_STRING/g" $ROOTDIR/etc/issue.net
sed -i -E "s/^VERSION_STRING.*$/VERSION_STRING=v$VERSION/g" $ROOTDIR/home/debian/.bashrc
echo "$VERSION" > $ROOTDIR/etc/swarm-gateway/version

# Disable watchdog
$CHROOTCMD systemctl enable intel-watchdog-disable.service

# Setup bluetooth
$CHROOTCMD systemctl enable bluetooth-patchram.service
$CHROOTCMD systemctl enable bluetooth-auto-power@hci0.service
$CHROOTCMD systemctl disable bluetooth.service
ln -s /lib/systemd/system/bluetooth.target $ROOTDIR/etc/systemd/system/multi-user.target.wants/bluetooth.target

# Make sure rc.local runs on boot.
# Not sure what the other arguments that systemd-rc-local-generator wants are...
$CHROOTCMD /lib/systemd/system-generators/systemd-rc-local-generator /etc/systemd/system a b

# Install node packages for the gateway software
if [ ! -d node_modules ]; then
	echo "***** Rebuilding node_modules"
	mkdir -p $ROOTDIR/home/debian/gateway/software/node_modules
	for i in $ROOTDIR/home/debian/gateway/software/* ; do
		if [[ -d $i ]] && [[ $i != "node_modules" ]]; then
			pushd $i > /dev/null
			ln -s ../node_modules .
			PREFIX=/home/debian/gateway/software/`basename $i`
			$CHROOTCMD npm --prefix $PREFIX install --build-from-source
			popd > /dev/null
		fi;
	done
	# Remove this log file that seemed to appear
	rm $ROOTDIR/npm-debug.log
else
	echo "***** Using existing node modules"
	cp -r node_modules $ROOTDIR/home/debian/gateway/software/node_modules
fi

# Setup gateway services

# Copy all systemd unit files to /etc/systemd/service
# Ideally these would be links, however that does not seem to work. systemctl
# can find those to call `systemctl start` on, but they do not seem to work
# on boot. It is hard to tell if that is intended behavior or a bug, but at
# some point I had to give up and find something that does work.
cp $ROOTDIR/home/debian/gateway/systemd/*.service $ROOTDIR/etc/systemd/system/

# Default ones we probably want on all gateways
ln -s ../adv-gateway-ip.service          $ROOTDIR/etc/systemd/system/multi-user.target.wants/
ln -s ../ble-gateway-mqtt.service        $ROOTDIR/etc/systemd/system/multi-user.target.wants/
ln -s ../gateway-internet-leds.service   $ROOTDIR/etc/systemd/system/multi-user.target.wants/
ln -s ../gateway-internet-reboot.service $ROOTDIR/etc/systemd/system/multi-user.target.wants/
ln -s ../gateway-mqtt-reboot.service     $ROOTDIR/etc/systemd/system/multi-user.target.wants/
ln -s ../gateway-server.service          $ROOTDIR/etc/systemd/system/multi-user.target.wants/

# Enable other services for a triumvi gateway
if [[ $TRIUMVI -eq 1 ]]; then
	ln -s ../gateway-triumvi-ble.service        $ROOTDIR/etc/systemd/system/multi-user.target.wants/
	ln -s ../gateway-triumvi-server.service     $ROOTDIR/etc/systemd/system/multi-user.target.wants/
	ln -s ../gateway-triumvi-sqlite.service     $ROOTDIR/etc/systemd/system/multi-user.target.wants/
	ln -s ../ieee802154-triumvi-gateway.service $ROOTDIR/etc/systemd/system/multi-user.target.wants/
	ln -s ../ssh-reverse-tunnel.service         $ROOTDIR/etc/systemd/system/multi-user.target.wants/
	rm $ROOTDIR/etc/systemd/system/multi-user.target.wants/adv-gateway-ip.service
fi

# Umich specific services
if [[ $UMICH -eq 1 ]]; then
	# Create a default user "debian" with the correct password and settings
	$CHROOTCMD useradd -m debian -p '\$6\$8FSbjofK.cgC3M$.gkGcDrdnUlsbKxxjYVfwBWK5zW5TNa2r7XICejwwDIOWT.99iv9wCM.VvxOCeaWE9ik/P6tRgW8sH0Z0tCbZ/' -G adm,sudo,dialout -s /bin/bash

	# Install sensu
	# $CHROOTCMD wget -q http://repositories.sensuapp.org/apt/pubkey.gpg -O- | $CHROOTCMD apt-key add -
	# echo "deb     https://sensu.global.ssl.fastly.net/apt sensu main" > $ROOTDIR/etc/apt/sources.list.d/sensu.list
	# $CHROOTCMD apt update
	# $CHROOTCMD apt -y install sensu
	# rm $ROOTDIR/etc/init.d/sensu*
	# wget https://raw.githubusercontent.com/sensu/sensu-build/master/sensu_configs/systemd/sensu-client.service -O $ROOTDIR/etc/systemd/system/sensu-client.service
	# ln -s ../sensu-client.service $ROOTDIR/etc/systemd/system/multi-user.target.wants/
	# cp -r gateway-private/sensu $ROOTDIR/etc/
	$CHROOTCMD npm --prefix /home/debian/gateway-tools/gateway install --build-from-source getmac

	# Make sure we have the config information for internal gateways
	sudo -u $USER git submodule update --init gateway-private
	shopt -s dotglob
	cp -R gateway-private/overlay/* $ROOTDIR

	# Also publish to our influx server
	ln -s ../gateway-mqtt-influxdb.service $ROOTDIR/etc/systemd/system/multi-user.target.wants/

else
	# Create a default user "debian" with the password "swarmgateway"
	# echo swarmgateway | mkpasswd -m sha-512 -s | sed "s/\\$/\\\\$/g"
	$CHROOTCMD useradd -m debian -p '\$6\$zXSccm7zraCL\$VvpKt.PYTuDfUyrOvGc6s5rYmNa0.e3G3WN4gnHedTS6L36ZCjisMsSkH6Q5u9vRIU.A4hB5/xWUjBCSkGC0w/' -G adm,sudo,dialout -s /bin/bash
fi

# Setup permissions
chown -R 1000:1000 $ROOTDIR/home/debian

# Make sure that NetworkManager config file are root rw only
chmod 600 $ROOTDIR/etc/NetworkManager/system-connections/*

# Cleanup space on rootfs
$CHROOTCMD apt-get clean

# Create the rootfs ext4 image
rm -f $OUTFILENAME.root
dd if=/dev/zero of=$OUTFILENAME.root count=1500 bs=1M
mkfs.ext4 -F -L rootfs -O none,has_journal,ext_attr,resize_inode,dir_index,filetype,extent,flex_bg,sparse_super,large_file,huge_file,uninit_bg,dir_nlink,extra_isize $OUTFILENAME.root

# Copy the rootfs content in the ext4 image
rm -rf mntroot
mkdir mntroot
mount -o loop $OUTFILENAME.root mntroot
shopt -s extglob
cp -a $ROOTDIR/!(home) mntroot/
rm -rf mntroot/home
mkdir -p mntroot/home
umount mntroot
rmdir mntroot

# Create the home ext4 image
rm -f $OUTFILENAME.home
dd if=/dev/zero of=$OUTFILENAME.home count=2785247 bs=512
mkfs.ext4 -F -L home -O none,has_journal,ext_attr,resize_inode,dir_index,filetype,extent,flex_bg,sparse_super,large_file,huge_file,uninit_bg,dir_nlink,extra_isize $OUTFILENAME.home

# Copy the home content in the ext4 image
rm -rf mnthome
mkdir mnthome
mount -o loop $OUTFILENAME.home mnthome
cp -aR $ROOTDIR/home/debian mnthome/
umount mnthome
rmdir mnthome

# Create the boot image
rm -f $OUTFILENAME.boot
dd if=/dev/zero of=$OUTFILENAME.boot count=32 bs=1M
mkfs.msdos -n boot $OUTFILENAME.boot

# Copy the linux kernel to the boot image
rm -rf mntboot
mkdir mntboot
mount -o loop $OUTFILENAME.boot mntboot
cp edison-linux-helper/collected/3.10.98-poky-edison/boot/vmlinuz mntboot/
umount mntboot
rmdir mntboot

chown $USER:$USER $OUTFILENAME.boot
chown $USER:$USER $OUTFILENAME.root
chown $USER:$USER $OUTFILENAME.home
