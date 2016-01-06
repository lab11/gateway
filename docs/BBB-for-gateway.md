BeagleBone Black Setup for Gateway
==================================

This is the setup directions for creating a gateway out of a
BeagleBone Black. These steps were originally designed for the
Urban Heartbeat Workshop (January 13, 2016).

1. Download a new
[Debian image](http://elinux.org/Beagleboard:BeagleBoneBlack_Debian#Jessie_Snapshot_console)
for the BBB. I used:

        microSD/Standalone: (console) (BeagleBone/BeagleBone Black/BeagleBone Green)
        wget https://rcn-ee.com/rootfs/bb.org/testing/2016-01-03/console/bone-debian-8.2-console-armhf-2016-01-03-2gb.img.xz
        sha256sum: 0e50b5e436a10626f2880f9cd70ddb7688f0875f24801a5f538e7417e2971238

2. Write the image to an SD card. I use `Win32 Disk Imager``.
3. Plug the SD card into a BBB and boot the BBB.
4. SSH to the BBB with `username: debian` and `password: temppwd`.
5. Install some useful packages.

        sudo apt-get update
        sudo apt-get install vim

5. Disable root SSH.

        # Edit /etc/ssh/sshd_config
        # Change PermitRootLogin to no
        PermitRootLogin no

5. Change the `debian` account password.

        passwd


