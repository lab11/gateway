Edison Gateway V3
=================

Files needed to flash edison.

Dependencies
------------

Need `mkenvimage` to prepare environment variables for u-boot.

    apt get install u-boot-tools


Usage
-----

1. Plug cables into both micro USB ports on the gateway.

2. Connect to serial:

        miniterm.py /dev/ttyUSB0 115200

3. Plug in power to the gateway. When the serial terminal gets to
`Hit any key to stop autoboot: `, press a key. This happens very quickly.

4. On the edison at the boot prompt, enter `run do_flash`:

        boot > run do_flash

5. On the host computer:

        ./flashall.sh c0:98:e5:c0:00:<gateway_id> <root of image to flash>

    For example:

        ./flashall.sh c0:98:e5:c0:00:01 swarm-gateway-1.9.0.edison.umich.triumvi

