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



	# try:
	# 	for i in range(1, 100):
	# 		message = yield from C.deliver_message()
	# 		packet = message.publish_packet
	# 		print("%d:  %s => %s" % (i, packet.variable_header.topic_name, str(packet.payload.data)))
	# 	yield from C.unsubscribe(['$SYS/broker/uptime', '$SYS/broker/load/#'])
	# 	yield from C.disconnect()
	# except ClientException as ce:
	# 	logger.error("Client exception: %s" % ce)

asyncio.get_event_loop().run_until_complete(recv())
