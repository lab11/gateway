#!/bin/bash

# Get the ID out of the u-boot environment variables
GATEWAY_ID=`sudo fw_printenv gateway_id | cut -d "=" -f 2`

# Make sure it is the correct length to avoid any problems
if [ ${#GATEWAY_ID} -ne 17 ]; then
	echo "ERROR: Could not set gateway_id"
	echo "Unable to determine gateway_id"
	exit
fi

echo Setting gateway ID to $GATEWAY_ID

# Update the sensu file if it exists
if [ -f /etc/sensu/conf.d/client.json ]; then
    GATEWAY_ID_NO_COLON=${GATEWAY_ID//:}
    sed -i -E "s/\"name\":\"swarm-gateway-(.{12})\"/\"name\":\"swarm-gateway-$GATEWAY_ID_NO_COLON\"/" /etc/sensu/conf.d/client.json
    sed -i -E "s/\"address\":\"(.{12}).device.lab11.eecs.umich.edu\"/\"address\":\"$GATEWAY_ID_NO_COLON.device.lab11.eecs.umich.edu\"/" /etc/sensu/conf.d/client.json
fi

# Update the USB serial number
sed -i -E "s/iSerialNumber=([^ \n]+)/iSerialNumber=$GATEWAY_ID/" /etc/modprobe.d/g_multi.conf

# Set the gateway ID in the factory partition
echo "$GATEWAY_ID" > /factory/gateway_id
