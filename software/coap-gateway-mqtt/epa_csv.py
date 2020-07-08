import paho.mqtt.client as mqtt
import json
import csv
import os
import os.path 
import sys
import traceback

keys = [
    'temperature_c',
    'humidity_percent',
    'motion',
    'light_lux',
    'light_spectrum_f1',
    'light_spectrum_f2',
    'light_spectrum_f3',
    'light_spectrum_f4',
    'light_spectrum_f5',
    'light_spectrum_f6',
    'light_spectrum_f7',
    'light_spectrum_f8',
    'light_spectrum_clear',
    'light_spectrum_nir',
    'light_cct_k',
    'light_cla',
    'light_cs'
]

fout = open('/media/usb/epa_test.csv', 'a')
w = csv.writer(fout)
w.writerow(keys)
fout.close()

# The callback for when the client receives a CONNACK response from the server.
def on_connect(client, userdata, flags, rc):
    print("Connected with result code "+str(rc))

    # Subscribing in on_connect() means that if we lose the connection and
    # reconnect then subscriptions will be renewed.
    client.subscribe('device/epa-mote/#')

# The callback for when a PUBLISH message is received from the server.
def on_message(client, userdata, msg):
    print("-------------")
    print("Topic: " + msg.topic)
    print(json.loads(msg.payload.decode('utf-8')))
    print("-------------")

    try: 
        needHeader = False
        if not os.path.exists('/media/usb/epa_test.csv'):
            needHeader = True
        
        fout = open('/media/usb/epa_test.csv', 'a')
        w = csv.writer(fout)

        if needHeader:
            print("Writing Header")
            w.writerow(keys)
        
        data = json.loads(msg.payload.decode('utf-8'))
        outrow = []
        valid_data = False
        for k in keys: 
            if k in data:
                outrow.append(data[k])
                valid_data = True
            else:
                outrow.append(-1)

        if valid_data: 
            print(outrow)
            w.writerow(outrow)
            fout.flush()

        fout.close()
        print("wrote data")
        print(data)
    except: 
        print("probably no usb drive")
        print(str(sys.exc_info()[0]))
        traceback.print_exc()


client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

client.connect("localhost", 1883, 60)

# Blocking call that processes network traffic, dispatches callbacks and
# handles reconnecting.
# Other loop*() functions are available that give a threaded interface and a
# manual interface.
client.loop_forever()