#!/bin/bash

# This puts the correct MAC addresses in the correct spots so they get
# used at boot. The addresses are based on the gateway_id.
#
# The goals is to assign addresses as follows:
#  ethernet: c0:98:e5:c0:1x:xx
#  wifi:     c0:98:e5:c0:2x:xx
#  wwan:     c0:98:e5:c0:3x:xx
#  usb:      c0:98:e5:c0:4x:xx
#  ble:      c0:98:e5:c0:5x:xx
# where x:xx is the last 12 bits of the gateway_id. If there are ever more
# network interfaces they should get added. This numbering method supports up
# to 16 network interfaces.

# Get the gateway_id
GATEWAY_ID=`cat /factory/gateway_id`

BASE=${GATEWAY_ID:0:12}
END=${GATEWAY_ID:13:4}

ADDR_ETHERNET="${BASE}1${END}"
ADDR_WIFI="${BASE}2${END}"
ADDR_WWAN="${BASE}3${END}"
ADDR_USB="${BASE}4${END}"
ADDR_BLE="${BASE}5${END}"

echo "Update MAC addresses based on $GATEWAY_ID"

# Ethernet address is configured by systemd
sed -i -E "s/^MACAddress=.*$/MACAddress=$ADDR_ETHERNET/g" /etc/systemd/network/10-enp0s17u1u1.link

# USB local network adapter address is configured by systemd
sed -i -E "s/^MACAddress=.*$/MACAddress=$ADDR_USB/g" /etc/systemd/network/10-usb0.link

# GSM radio address is configured by systemd
sed -i -E "s/^MACAddress=.*$/MACAddress=$ADDR_WWAN/g" /etc/systemd/network/10-wwp0s17u1u2i2.link

# WiFi address is set in a bizarre config file (/config/wifi/mac.txt)
# https://github.com/01org/edison-bcm43340/blob/9d609e1ffadbf8895a701e6283392bb54bd962f9/dhd_custom_gpio.c#L146
ADDR_WIFI_NO_COLON=${ADDR_WIFI//:}
echo "$ADDR_WIFI_NO_COLON" > /config/wifi/mac.txt

# Bluetooth address is set from a file in /factory and used by the
# bluetooth patchram script to setup the adapter.
echo "$ADDR_BLE" > /factory/bluetooth_address
