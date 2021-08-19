Awair Local Publisher
===============

This pulls from local Awair smart air quality monitors and publishes to MQTT.

It needs arpscan data from `arp-scan` tool.

Config
------

```
arpscan_file = /path/to/arpscan/file
```


arp-scan service
----------------

We need an arpscan file that is periodically updated to find awair devices.

arpscan-127_27_0_0_16.service:

```
[Unit]
Description=Runs arp-scan
Wants=one-hour-timer.timer

[Service]
ExecStart=/bin/sh -c 'arp-scan 172.27.0.0/16 > /opt/arpscan_172.27.0.0-16.txt'
Type=simple

[Install]
WantedBy=one-hour-timer.target
```


one-hour-timer.timer:

```
[Unit]
Description=One Hour Timer

[Timer]
OnBootSec=60min
OnCalendar=hourly
RandomizedDelaySec=5m
Unit=one-hour-timer.target

[Install]
WantedBy=timers.target
```

one-hour-timer.target:

```
[Unit]
Description=One Hour Timer Target
StopWhenUnneeded=yes
```
