#!/bin/bash

# Setup a reverse SSH tunnel with port based on gateway id.

PORT_BASE=49000
# SSH_HOST="ssh.lab11.eecs.umich.edu"
SSH_HOST="fram.eecs.umich.edu"
SSH_USER="reversessh"
SSH_ARGS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
-o ServerAliveInterval=20 -o ServerAliveCountMax=1 -o ExitOnForwardFailure=yes -N -T"

GATEWAY_ID=`cat /factory/gateway_id | tr -d '[:space:]'`
GATEWAY_ID_NO_COLON=${GATEWAY_ID//:}
UNIQUE_ID_HEX=`echo "$GATEWAY_ID_NO_COLON" | tail -c 5`
UNIQUE_ID_DECIMAL=`echo $((16#$UNIQUE_ID_HEX))`

# Add the device ID to the port base to get the port to use
PORT=$(($PORT_BASE + $UNIQUE_ID_DECIMAL))

if [ "$PORT" -gt "50000" ]; then
	PORT=49000
fi

# Actually run the SSH command to create the tunnel
ssh $SSH_ARGS -R$PORT:localhost:22 $SSH_USER@$SSH_HOST
