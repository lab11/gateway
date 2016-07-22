#!/usr/bin/env python2

# Do some hacking for the edison and sudo and python and oh my god why
# is this so hard.
import sys
sys.path.append('/usr/local/lib/python2.7/site-packages')
import os

# make print statements unbuffered
#    this makes them show up in the syslog
sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', 0)

# System dependencies
import time
import json

# Use systemd to watchdog process
import sdnotify
sd_watchdog = sdnotify.SystemdNotifier()

# Library for getting data from the CC2538/Triumvi
from lib import triumvi

# MQTT
import paho.mqtt.client as mqtt


# Called on every packet from the Triumvi
def callback (pkt):
	sd_watchdog.notify("WATCHDOG=1")
	try:
		json_pkt = json.dumps(pkt.dictionary)
		client.publish('gateway-data', json_pkt)
	except Exception as e:
		print('Error in callback with Triumvi packet')
		print(e);

print("Starting triumvi packet collection")

# Connect to the local MQTT broker
client = mqtt.Client()
client.connect('localhost', 1883, 60)
print("Connected to mqtt at localhost")

# Start getting Triumvi Packets
triumvi.triumvi(callback)
