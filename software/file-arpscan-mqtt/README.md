file-arpscan-mqtt
=================

Publish the output of an arpscan as individual measurements.


arpscan example
---------------

```
Interface: wlan0, datalink type: EN10MB (Ethernet)
Starting arp-scan 1.9 with 32768 hosts (http://www.nta-monitor.com/tools/arp-scan/)
172.27.128.3	42:b4:f0:e2:30:5f	(Unknown)
172.27.128.4	94:e6:f7:17:68:08	(Unknown)
172.27.128.54	f8:1f:32:5b:39:db	(Unknown)
172.27.128.91	f8:4d:89:84:74:97	(Unknown)
172.27.128.127	0c:02:bd:25:8a:64	(Unknown)

5 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.9: 32768 hosts scanned in 135.690 seconds (241.49 hosts/sec). 5 responded
```

config
------

```
arpscan_file=/opt/arpscan.txt
```
