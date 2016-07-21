#!/usr/bin/env python2

# Do some hacking for the edison and sudo and python and oh my god why
# is this so hard.
import sys
sys.path.append('/usr/local/lib/python2.7/site-packages')
import os

# System dependencies
import time
import json

# Restart this when it breaks
from lib import watchdog

# Library for getting data from the CC2538/Triumvi
from lib import triumvi

# MQTT
import paho.mqtt.client as mqtt


# Called on every packet from the Triumvi
def callback (pkt):
	watchdog.reset()
	try:
		json_pkt = json.dumps(pkt.dictionary)
		client.publish('gateway-data', json_pkt)
	except Exception as e:
		print('Error in callback with Triumvi packet')
		print(e);

def watchdog_handler ():
	print("Watchdog expired. Haven't gotten a packet in a while.")
	os._exit(1)

print("Starting triumvi packet collection")

watchdog = watchdog.Watchdog(60, watchdog_handler)

# Connect to the local MQTT broker
client = mqtt.Client()
client.connect('localhost', 1883, 60)
print("Connected to mqtt at localhost")

# Start getting Triumvi Packets
triumvi.triumvi(callback)
