import json

import websocket

HOST = '127.0.0.1';
PORT = 3001

def on_message (ws, message):
	adv_obj = json.loads(message)
	print(adv_obj)

def on_error (ws, error):
	print(error)

def on_close (ws):
	pass

def on_open (ws):
	pass


if __name__ == "__main__":
	ws = websocket.WebSocketApp('ws://{}:{}'.format(HOST, PORT),
	                            on_message = on_message,
	                            on_error = on_error,
	                            on_close = on_close)
	ws.on_open = on_open
	ws.run_forever()
