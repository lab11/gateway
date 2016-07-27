#!/usr/bin/env python2

# Do some hacking for the edison and sudo and python and oh my god why
# is this so hard.
import sys
sys.path.append('/usr/local/lib/python2.7/site-packages')
import os

# make print statements unbuffered
#    this makes them show up in the syslog
sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', 0)

# Use systemd to watchdog process
import sdnotify
sd_watchdog = sdnotify.SystemdNotifier()

# Library for getting data from the CC2538/Triumvi
from lib import receive

# MQTT
import paho.mqtt.client as mqtt


# Called on every packet from the Triumvi
def callback (raw_bytes):
	sd_watchdog.notify("WATCHDOG=1")
	try:
		client.publish('ieee802154-raw', raw_bytes)
	except Exception as e:
		print('Error in callback with raw packet')
		print(e);

print("Starting 802.15.4 packet collection")

# Connect to the local MQTT broker
client = mqtt.Client()
client.connect('localhost', 1883, 60)
print("Connected to mqtt at localhost")

# Start getting 15.4 Packets
receive.receive(callback)
