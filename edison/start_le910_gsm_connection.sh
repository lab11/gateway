#!/bin/bash

# Turn on LE910 cell radio.
#
# To make this happen at boot:
#
#   start_le910_gsm_connection.sh --on-boot

sudo nmcli con up id LE910

if [ "$1" == "--on-boot" ]; then
	sudo nmcli con modify id LE910 connection.autoconnect true
fi
