Gateway Image with Buildroot
============================

Buildroot is a system for getting a filesystem for a Linux platform.

These steps will build an image (including the kernel) for a gateway.

**NOTE: THIS ATTEMPT WAS ABANDONED.** There is just too much magic that has to
happen to get an edison to boot and run correctly that starting from a bare
filesystem is just brutally difficult.

What I did do:

- Got buildroot to compile with newest kernel (4.11 at the time) and upgraded
u-boot on the edison. Getting a `/boot` partition with the kernel was tricky
because the one from jubilinux wasn't big enough to hold the new kernel.
I think I ended up figuring out how to make a MSDOS filesystem 32 MB partition
with a bootable flag and put the new kernel in there. I can't remember if I got
the edison to boot with this setup.
- Then I tried using buildroot but using the 3.10.98 kernel from the 1-org
github repo. I managed to get that to compile and load on the edison and boot.
I realized after a while that one has to disable the watchdog manually
(`echo 1 >/sys/devices/virtual/misc/watchdog/disable`). I gave up on this
because no BLE devices were found nor did any network interfaces show
up.

The next step on this adventure may be to try to figure out how to use
yocto. In theory that too would allow for a pre-compiled build of the entire
filesystem and kernel.

Setup
-----

The user visible version number is set in:

    external/board/lab11/common/overlay/etc/issue.net

Building the Image
------------------

First, make sure you have the submodule checked out:

    git submodule update --init buildroot
    cd buildroot

Now setup buildroot so that it knows we have this external tree full of
configuration stuff.

    make BR2_EXTERNAL=../external help

Now specify which gateway board you want to build for.

    make edison_v3_defconfig

If there are any changes that need to be made to the buildroot setup:

    make menuconfig

If there are any changes, this will save them back to the external config
folder so they can be committed.

    make savedefconfig

Now setup the Linux config for this board.

    make linux-menuconfig

If there are changes, this saves them to the file in the gateway repo.

    make linux-update-defconfig

Then build it! This takes a while.

    make
