#!/bin/bash

while true; do
  # Wait for a bit
  sleep 15s

  # Check if we are online
  ifconfig wlan0 | grep 'inet '
  if [[ $? -eq 0 ]]; then
    echo "Connected to wahoo all good."
    exit 0
  fi

  # If we get here we are not online. Let's try to fix that.
  nmcli con up id wahoo
done
