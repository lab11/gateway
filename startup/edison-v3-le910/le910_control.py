#!/usr/bin/env python

import subprocess
import sys
import os
import stat
import glob

TELIT_VENDOR_ID = '1bc7'

def main():
    # check if syntax is valid
    if len(sys.argv) != 2 or (sys.argv[1] != 'start' and sys.argv[1] != 'stop'):
        print('Invalid syntax')
        print('correct syntax: python cellular_network.py start|stop')
        print('Example: python cellular_network.py start')
        sys.exit(0)
    op = sys.argv[1]

    # check if USB is attached
    p1 = subprocess.Popen(["lsusb"], stdout=subprocess.PIPE)
    p2 = subprocess.Popen(["grep", TELIT_VENDOR_ID], stdin=p1.stdout, stdout=subprocess.PIPE)
    p1.stdout.close()
    output = p2.communicate()[0]
    if len(output) == 0:
        print('Modem not found, do you connect to the USB port?')
        sys.exit(0)

    # check if device is attached and correct driver is installed
    devices = glob.glob('/dev/cdc-wdm*')
    if len(devices) == 0:
        print('No device found or driver installed')
        sys.exit(0)
    print('Found devices: {:}\t'.format(devices)),
    myDev = devices[0]
    print('Using device: {:}'.format(myDev))

    # check if libqmi is install
    p1 = subprocess.Popen(["ldconfig", "-p"], stdout=subprocess.PIPE)
    p2 = subprocess.Popen(["grep", "libqmi"], stdin=p1.stdout, stdout=subprocess.PIPE)
    p1.stdout.close()
    output = p2.communicate()[0]
    if len(output) == 0:
        print('libqmi is not found, visit: https://www.freedesktop.org/software/libqmi/')
        sys.exit(0)

    # get cellular connection status
    status = subprocess.check_output(['qmicli', '-d', myDev, '--wds-get-packet-service-status']).split()
    status = status[-1][1:-1]

    # get interface name
    sysoutput = subprocess.check_output(['qmicli', '-d', myDev, '-w'])
    ifname = sysoutput[:-1]

    if op == 'start':
        if status == 'connected':
            print('Already connected to cellular network, skipping...')
            sys.exit(0)

        # check if modem is registered to the network
        sysoutput = subprocess.check_output(['qmicli', '-d', myDev, '--nas-get-serving-system'])
        sysoutput = sysoutput.split('\n\t')
        if 'not-registered' in sysoutput[1]:
            print('Not registered to cellular network, do you have sim card installed and antenna attached?')
            sys.exit(0)

        # bring the interface up
        res = subprocess.call(['ifconfig', ifname, 'up'])
        if res != 0:
            print('Cannot bring the network interface {:} up'.format(ifname))
            sys.exit(res)

        # set mode
        sysoutput = subprocess.check_output(['qmicli', '-d', myDev, '--dms-set-operating-mode=online'])
        if 'successfully' not in sysoutput:
            print('cannot set operating mode')
            sys.exit(0)

        # check if APN configuration file exists
        if not os.path.isfile('/etc/qmi-network.conf'):
            print('Cannot find /etc/qmi-network.conf file')
            sys.exit(0)

        # try to connect to network
        print('Starting network...')
        res = subprocess.call(["qmi-network", myDev, 'start'])
        if res != 0:
            print('Failed to connect to network, check the configuration file')
            sys.exit(res)

        # obtain IP address
        print('Acquiring IP address...')
        sysout = subprocess.call(['dhclient', ifname])

    elif op == 'stop':
        print('Stopping network...')
        subprocess.call(['qmi-network', myDev, 'stop'])

        # bring the interface down
        res = subprocess.call(['ifconfig', ifname, 'down'])
        if res != 0:
            print('Cannot bring the network {:} up'.format(ifname))
            sys.exit(res)



if __name__=="__main__":
    main()


