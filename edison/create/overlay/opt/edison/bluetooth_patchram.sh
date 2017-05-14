#!/bin/bash

# Use the configured gateway_id rather than the intel provided bluetooth_address
BD_ADDR=$(echo $(cat /factory/gateway_id))

rfkill unblock bluetooth

/opt/edison/brcm_patchram_plus \
  --bd_addr $BD_ADDR \
  --use_baudrate_for_download \
  --no2bytes \
  --enable_lpm \
  --enable_hci \
  --baudrate 3000000 \
  --patchram /etc/firmware/bcm43341.hcd \
  /dev/ttyMFD0

