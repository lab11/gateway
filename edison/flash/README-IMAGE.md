Edison Gateway Image
====================

This folder contains Intel Edison images that can be flashed on to an Edison
to create a gateway.

Make sure you have the needed dependencies:

    sudo apt get install u-boot-tools dfu-util

Then to use:

    sudo ./flashall.sh --id <gateway_id> --model <model>

like:

    sudo ./flashall.sh --id c0:98:e5:c0:00:01 --model edison-v3
