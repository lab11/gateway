#!/bin/bash

# This script configures /etc/qmi-network.conf with the correct APN
# setting based on which cellular modem is connected.

# Get the QMI library to output which model is attached.
MODEL=`qmicli -d /dev/cdc-wdm0 --dms-get-model`

# If the radio is a "LE910-SVG", it supports verizon
if [[ $MODEL == *"LE910-SVG"* ]]; then
	echo "Configuring /etc/qmi-network.conf for Verizon modem."
	sed -i -E "s/^APN=(.*)$/APN=VZWINTERNET/g" /etc/qmi-network.conf
fi

# If the radio is a "LE910-NAG", it supports at&t
if [[ $MODEL == *"LE910-NAG"* ]]; then
	echo "Configuring /etc/qmi-network.conf for AT&T modem."
	sed -i -E "s/^APN=(.*)$/APN=I2GOLD/g" /etc/qmi-network.conf
fi
