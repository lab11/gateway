import asyncio
import json

import hbmqtt.client

HOST = '127.0.0.1'

async def recv ():
	client = hbmqtt.client.MQTTClient()
	await client.connect('mqtt://{}'.format(HOST))
	await client.subscribe([('ble-gateway-advertisements', hbmqtt.client.QOS_0)])

	while True:
		message = await client.deliver_message()
		adv_obj = json.loads(message.publish_packet.payload.data.decode('utf-8'))
		print(adv_obj)

asyncio.get_event_loop().run_until_complete(recv())
