#!/bin/bash

# Get this dir
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Assert the program enable pin on the cc2538
DIRECTORY="/sys/class/gpio/gpio45/"
if [ ! -d "$DIRECTORY" ]; then
    echo 45 > /sys/class/gpio/export
fi
echo "out" > /sys/class/gpio/gpio45/direction
echo 1 > /sys/class/gpio/gpio45/value

# Use the BSL script to flash the CC2538
python $DIR/cc2538-bsl.py -b 115200 -e -w -v $DIR/cc2538.bin

# De-assert programming pin
echo 0 > /sys/class/gpio/gpio45/value
