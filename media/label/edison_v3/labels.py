#!/usr/bin/env python

"""
Generate pdfs of labels for the top of the edison gateway v3 cases
"""

import os
import sys
import svgutils.transform as sg

import sh
from sh import pdf2svg
from sh import rsvg_convert

# Template labels source files
LABEL_SVG = 'edison_v3_top.svg'

# Root of device IDs
DEVICE_ID = 'C0:98:E5:C0:'

# Rest of URL
URL = '{}.device.lab11.eecs.umich.edu'

# Where to start on the page
POSITION_START_X = 0
POSITION_START_Y = 0

# Parse command line
if len(sys.argv) != 3:
	print('Usage: {} <start id in hex> <number of labels>'.format(__file__))
	print('example: {} 003a 6'.format(__file__))
	sys.exit(1)

start_id = int(sys.argv[1], 16)
count = int(sys.argv[2])

# State
x = POSITION_START_X
y = POSITION_START_Y

label_specs = {}
label_specs['offset_x'] = 36
label_specs['gap_x']    = 36
label_specs['width_x']  = 252
label_specs['offset_y'] = 36
label_specs['gap_y']    = 36
label_specs['height_y'] = 216
label_specs['y_count']  = 3
label_specs['x_count']  = 2

def get_coordinates ():
	global x, y

	xpx = label_specs['offset_x'] + (x*(label_specs['gap_x'] + label_specs['width_x']))
	ypx = label_specs['offset_y'] + (y*(label_specs['gap_y'] + label_specs['height_y']))

	x += 1

	if x > label_specs['x_count']-1:
		x = 0
		y += 1

	return (round(xpx), round(ypx))

# List of ids to make QR codes of
ids = []

for id in range(start_id, start_id+count):
	first = id >> 8
	second = id & 0xff

	label_id = '{}{:02X}:{:02X}'.format(DEVICE_ID, first, second)
	ids.append(label_id)


if len(ids) == 0:
	print('No IDs to make labels for!')
	sys.exit(1)


label_svg = LABEL_SVG
label_pixels_x = 252
label_pixels_y = 216
label_id_pos_x = 85
label_id_pos_y = 137
label_id_font  = 7.5
label_id_letterspacing = -0.7
label_url_pos_x = 85
label_url_pos_y = 150.5
label_url_font  = 7.5
label_url_letterspacing = -0.7
label_rotate = False

label_sheet = sg.SVGFigure('612', '792') # 8.5"x11" paper at 72dpi
labels = []

for nodeid in ids:
	nodeidstr = nodeid.replace(':', '')
	url = URL.format(nodeidstr.lower())

	# Create the node specific svg
	fig = sg.SVGFigure(width='{}px'.format(label_pixels_x), height='{}px'.format(label_pixels_y))

	rawlabel = sg.fromfile(label_svg)
	rawlabelr = rawlabel.getroot()

	txt = sg.TextElement(label_id_pos_x,
	                     label_id_pos_y, nodeid,
	                     anchor='left',
	                     size=label_id_font,
	                     font='Courier',
	                     letterspacing=label_id_letterspacing,
	                     color='black')
	urltxt = sg.TextElement(label_url_pos_x,
	                     label_url_pos_y, url,
	                     anchor='left',
	                     size=label_url_font,
	                     font='Courier',
	                     letterspacing=label_url_letterspacing,
	                     color='black')
	fig.append([rawlabelr, txt, urltxt])
	fig.save('label_{}.svg'.format(nodeidstr))

	if label_rotate:
		fig = sg.SVGFigure('{}px'.format(label_pixels_y), '{}px'.format(label_pixels_x))
		dlabel = sg.fromfile('label_{}.svg'.format(nodeidstr))
		dlabelr = dlabel.getroot()
		dlabelr.rotate(90, x=0, y=0)
		dlabelr.moveto(0, -1*label_pixels_y)
		fig.append([dlabelr])
		fig.save('label_{}.svg'.format(nodeidstr))

	lbl = sg.fromfile('label_{}.svg'.format(nodeidstr))
	lblr = lbl.getroot()
	pos = get_coordinates()
	lblr.moveto(pos[0], pos[1], 1) # position correctly (hand tweaked)

	labels.append(lblr)

label_sheet.append(labels)
base_name = 'edison-v3_{}_{}'.format(sys.argv[1], sys.argv[2])
label_sheet.save('{}.svg'.format(base_name))
sh.rsvg_convert('-f', 'pdf', '-d', '72', '-p', '72', '-o',
	'{}.pdf'.format(base_name), '{}.svg'.format(base_name))
print('{}.pdf'.format(base_name))
