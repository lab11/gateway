#!/usr/bin/env python3

'''
Fetch the gateway logs from a gateway and convert the JSON
packets to a tabular format organized by id
'''

import argparse
import glob
import json
import os
import tempfile

import dataprint
import iso8601

from sh import gzip
from sh import mkdir
from sh import sshpass

parser = argparse.ArgumentParser(description='Process gateway logs.')
parser.add_argument('-g', '--gateway',
                    help='SSH style path to gateway logs (e.g. swarmgateway.local:/media/sdcard)')
parser.add_argument('-p', '--password',
                    help='gateway login password')

args = parser.parse_args()


with tempfile.TemporaryDirectory() as tmpdirname:
	print('Copy all gateway logs to this computer')
	sshpass('-p', args.password, 'scp',
	        '-o', 'PreferredAuthentications=keyboard-interactive,password',
	        '-o', 'PubkeyAuthentication=no',
	        'debian@{}/gateway.log*'.format(args.gateway), '{}/'.format(tmpdirname))
	print('Done copying, start parsing')

	devices = {}

	logs = glob.glob(tmpdirname + '/gateway.log*')
	for log in logs:
		name, ext = os.path.splitext(log)

		print('Handling {}'.format(log))

		# Uncompress this log file if needed
		if ext == '.gz':
			print('Have to uncompress first')
			gzip('-d', log)
			log = log[:-3]

		# Open it to read all of the JSON blobs
		with open(log) as f:
			print('Opened {} and parsing JSON'.format(log))

			for l in f:
				try:
					blob = json.loads(l)

					# Check if we can identify this node
					if '_meta' in blob:
						id = blob['_meta']['device_id']

						# Have to create the data structures if this is the
						# first time we have seen this device.
						if not id in devices:
							devices[id] = {'columns': [], 'rows': []}

							# Create the canonical ordering of data based
							# on the first packet
							for k,v in blob.items():
								if not k in ['_meta', 'id', 'device']:
									devices[id]['columns'].append(k)
							devices[id]['columns'] = ['timestamp', 'isotime'] + sorted(devices[id]['columns'])

						# Pull out the data from this packet
						dev = devices[id]
						new_row = []
						try:
							tstamp = int(iso8601.parse_date(blob['_meta']['received_time']).timestamp()*1000)
							blob['timestamp'] = tstamp
							blob['isotime'] = blob['_meta']['received_time']

							for c in dev['columns']:
								new_row.append(blob[c])

							# Save this
							dev['rows'].append(new_row)
						except Exception as e:
							print(e)


				except json.decoder.JSONDecodeError as e:
					print('invalid json: {}'.format(l))
					print(e)

	# Save each device
	print('Writing data files.')
	for device_id, data in devices.items():
		rows = sorted(data['rows'], key=lambda c: c[0])
		dataprint.to_newfile('gateway_log_{}.data'.format(device_id), [data['columns']] + rows, overwrite=True)
