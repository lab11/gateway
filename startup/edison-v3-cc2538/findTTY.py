import subprocess
import glob

path = '/sys/bus/usb/devices/usb*/'

def findSerialDevice(stringToBeMatched):
    res = glob.glob(path)
    for r in res:
        res2 = subprocess.check_output(['find', r, '-name', 'dev'])
        res2 = res2.split()
        for r2 in res2:
            r2 = r2[:-4]
            res3 = subprocess.check_output(['udevadm', 'info', '-q', 'name', '-p', r2]).rstrip()
            if 'bus' in res3:
                continue
            res4 = subprocess.check_output(['udevadm', 'info', '-q', 'property', '--export', '-p', r2]).split()
            for r4 in res4:
                if stringToBeMatched in r4:
                    print ('Device found at: /dev/{:}'.format(res3))
                    return ['/dev/'+res3]
    return None
