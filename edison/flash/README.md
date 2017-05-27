Edison Gateway V3
=================

Files and tools to flash the Edison.

Dependencies
------------

Need `mkenvimage` to prepare environment variables for u-boot.

    apt get install u-boot-tools dfu-util

There are probably more that need to be added here that I have forgotten about.
Please add them if you have issues.


Images
------

Check https://owncloud.lab11.eecs.umich.edu for swarm gateway images.


Usage
-----

Follow these steps to program an Edison:

1. Plug cables into both micro USB ports on the gateway.

2. On the host computer:

        sudo ./flashall.sh --id c0:98:e5:c0:00:<gateway_id> --image <root of image to flash> --model <gateway model>

    For example:

        sudo ./flashall.sh --id c0:98:e5:c0:00:01 --image swarm-gateway-1.9.0.edison.umich.triumvi --model edison-v3

3. Plug in power to the gateway. The gateway should start flashing. If not,
when the serial terminal gets to
`Hit any key to stop autoboot: `, press a key. This happens very quickly.
Then at the boot prompt, enter `run do_flash`:

        boot > run do_flash
