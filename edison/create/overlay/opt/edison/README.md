Other Edison Scripts
====================

- `bluetooth_patchram.sh`: This comes from the Edison project (somewhere).
It sets up the BLE device so it runs and must be run on boot. It is modified
here to use our gateway ID as the BLE address rather than the Intel provided
one.
- `first-install.sh`: This script runs the first time the Edison boots after
being flashed and configures some things that should be unique to each module.
- `rc.local.edison`: The `rc.local` file we use on the Edison that runs
on each boot.
- `set_gateway_id.sh`: This pulls the gateway_id from the u-boot environment
variables and sets it in various places.
