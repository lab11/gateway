Edison Gateway Image
====================

This folder contains Intel Edison images that can be flashed on to an Edison
to create a gateway. To use:

1. Get a copy of the gateway repo:

        git clone https://github.com/lab11/gateway

2. Copy the `.boot`, `.root`, and `.home` images to the `gateway/edison/flash`
folder.

3. Plug in both USB cables and run the `flashall.sh` script:

        sudo ./flashall.sh <gateway_id> <basename of image> <model>

    like:

        sudo ./flashall.sh c0:98:e5:c0:00:01 swarm_gateway-2.0.0-edison edison-v3
