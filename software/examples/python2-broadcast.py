import json
import socket

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(('255.255.255.255', 3002))
while True:
	message = s.recvfrom(1024)
	adv_obj = json.loads(message[0])
	print(adv_obj)
