Edison Gateway
==============

This folder contains support code for running a gateway on top of an Intel Edison.

Edison Structure
----------------

Hopefully this can explain some of how the Edison works.

### Flash Structure

- Uses u-boot.
  - U-boot contains a bunch of environment variables which setup partitions and things.
- Partitions
  - fill in

### IDs and Addressing

The partition `/dev/mmcblk0p5` contains two files as set by Intel:

    $ sudo mount /dev/mmcblk0p5 /factory
    $ ls -l /factory
    -rw-r--r-- 1 root root    18 Jun 19  2015 bluetooth_address
    -rw-r--r-- 1 root root    18 Jun 19  2015 serial_number

These just contain the constants assigned to the particular Edison.
Since it is difficult to read partitions off of the Edison, we don't
try to update this directly when flashing an Edison. Instead, we set
an u-boot environment variable (`gateway_id`) with the ID of the gateway
the Edison is powering.

### First Boot

When an Edison boots for the first time after being flashed, when
`rc.local` runs it runs a script called `first-install.sh`. This
does some individual-Edison-specific configuration and then comments
itself out before rebooting the Edison.

### Deltas from jubilinux

- Got rid of `first-install` systemd target.
- Removed clloader and galileo target.
- Removed their first, second, and third install and replaced it with ours.
