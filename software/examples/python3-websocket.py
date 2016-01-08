import asyncio
import json

try:
	import websockets
except ImportError as e:
	print('Need websockets package.')
	print('')
	print('    sudo pip3 install websockets')
	print('')
	print('Be sure you are on python 3.5+')
	quit()


HOST = '127.0.0.1'
PORT = 3001

async def recv ():
	async with websockets.connect('ws://{}:{}'.format(HOST, PORT)) as websocket:

		while True:
			message = await websocket.recv()
			adv_obj = json.loads(message)
			print(adv_obj)

asyncio.get_event_loop().run_until_complete(recv())
