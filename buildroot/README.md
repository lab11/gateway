Gateway Image with Buildroot
============================

Buildroot is a system for getting a filesystem for a Linux platform.

These steps will build an image (including the kernel) for a gateway.

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
