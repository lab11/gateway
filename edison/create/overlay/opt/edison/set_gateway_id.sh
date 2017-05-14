#!/bin/bash

# Get the ID out of the u-boot environment variables
gateway_id=`sudo fw_printenv gateway_id | cut -d "=" -f 2`

# Make sure it is the correct length to avoid any problems
if [ ${#gateway_id} -ne 17 ]; then
	echo "ERROR: Could not set gateway_id"
	echo "Unable to determine gateway_id"
	exit
fi

echo Setting gateway ID to $gateway_id

# Do the replace in the network ethernet setup file if this is being used.
sudo sed -i -E "s/hwaddress ether(.*)$/hwaddress ether $gateway_id/" /etc/network/interfaces

# Update the NetworkManager profile for the ethernet
sudo sed -i -E "s/cloned-mac-address=.*$/cloned-mac-address=$gateway_id/g" /etc/NetworkManager/system-connections/wired

# Update the sensu file if it exists
if [ -f /etc/sensu/conf.d/client.json ]; then
    gateway_id_no_colon=${gateway_id//:}
    sudo sed -i -E "s/\"name\":\"swarm-gateway-(.{12})\"/\"name\":\"swarm-gateway-$gateway_id_no_colon\"/" /etc/sensu/conf.d/client.json
    sudo sed -i -E "s/\"address\":\"(.{12}).device.lab11.eecs.umich.edu\"/\"address\":\"$gateway_id_no_colon.device.lab11.eecs.umich.edu\"/" /etc/sensu/conf.d/client.json
fi

# Set the gateway ID in the factory partition
echo "$gateway_id" > /factory/gateway_id
