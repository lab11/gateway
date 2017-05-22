#!/bin/bash

# bluetooth_address gets set correctly by first-install.sh
BD_ADDR=$(echo $(cat /factory/bluetooth_address))

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
