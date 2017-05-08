#!/bin/bash

killall -9 bluetoothd

mkdir -p /factory
mount /dev/mmcblk0p5 /factory

# Use the configured gateway_id rather than the intel provided bluetooth_address
BD_ADDR=$(echo $(cat /factory/gateway_id))

umount /factory

rfkill unblock bluetooth

nohup brcm_patchram_plus \
  --bd_addr $BD_ADDR \
  --use_baudrate_for_download \
  --no2bytes \
  --enable_lpm \
  --enable_hci \
  --baudrate 3000000 \
  --patchram /etc/firmware/bcm43341.hcd \
  /dev/ttyMFD0 > /var/log/brcm_patchram_plus.log 2>&1 &

/usr/local/libexec/bluetooth/bluetoothd &

sleep 5

hciconfig hci0 up
hciconfig hci0 noscan
