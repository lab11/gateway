import json

try:
	import paho.mqtt.client
except ImportError as e:
	print('Need Paho MQTT package.')
	print('')
	print('    sudo pip install paho-mqtt')
	quit()

HOST = '127.0.0.1'

# The callback for when the client receives a CONNACK response from the server.
def on_connect(client, userdata, flags, rc):
	# Subscribing in on_connect() means that if we lose the connection and
	# reconnect then subscriptions will be renewed.
	client.subscribe('ble-gateway-advertisements')

# The callback for when a PUBLISH message is received from the server.
def on_message(client, userdata, msg):
	adv_obj = json.loads(msg.payload)
	print(adv_obj)

client = paho.mqtt.client.Client()
client.on_connect = on_connect
client.on_message = on_message

client.connect(HOST, 1883, 60)

# Blocking call that processes network traffic, dispatches callbacks and
# handles reconnecting.
# Other loop*() functions are available that give a threaded interface and a
# manual interface.
client.loop_forever()
