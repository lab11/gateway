
from mySPI import mySPI
from edisonLED import edisonLED
from time import sleep
import uuid
import mraa
from datetime import datetime

import threading

CC2538INTPINNUM = 38 # MRAA number, GP43
CC2538RESETPINNUM = 51 # MRAA number, GP41
MAX_TRIUMVI_PKT_LEN = 16 # maximum triumvi packet length
MIN_TRIUMVI_PKT_LEN = 14 # maximum triumvi packet length
MAX_FLUSH_THRESHOLD = 32 # maximum trials before reset cc2538

gateway_id = ':'.join(['{:02x}'.format((uuid.getnode() >> i) & 0xff) for i in range(0,8*6,8)][::-1])


condition = threading.Condition()

def triumviCallBackISR(args):
    # args.cc2538ISR()
    condition.acquire()
    condition.notify()
    condition.release()

class triumviPacket(object):
    def __init__(self, data):
        self.dictionary = {}

        self._TRIUMVI_PKT_ID = 160
        self._AES_PKT_ID = 120
        self._DISPLAYORDER = \
        ['Packet Type', 'Source Addr', 'Power', \
        'External Voltage Waveform', 'Battery Pack Attached', 'Three Phase Unit', \
        'Frame Write', 'Panel ID', 'Circuit ID']

        if data[0] == self._TRIUMVI_PKT_ID:
            self.dictionary['Packet Type'] = 'Triumvi Packet'
        elif data[0] == self._AES_PKT_ID:
            self.dictionary['Packet Type'] = 'Old Triumvi Packet'
        else:
            return None

        # self.dictionary['Source Addr'] = [hex(i) for i in data[1:9]]
        device_id = ''.join(['{:02x}'.format(i) for i in data[1:9]])
        self.dictionary['Power'] = (data[9] + (data[10]<<8) + (data[11]<<16) + (data[12]<<24))/1000
        if self.dictionary['Packet Type'] == 'Triumvi Packet':
            if data[13] & 128:
                self.dictionary['External Voltage Waveform'] = True
            if data[13] & 64:
                self.dictionary['Battery Pack Attached'] = True
            if data[13] & 48:
                self.dictionary['Three Phase Unit'] = True
            if data[13] & 8:
                self.dictionary['Fram Write'] = True
        if self.dictionary.get('Battery Pack Attached', False):
            self.dictionary['Panel ID'] = data[14]
            self.dictionary['Circuit ID'] = data[15]

        self.dictionary['_meta'] = {
            'received_time': datetime.utcnow().isoformat(),
            'gateway_id': gateway_id,
            'receiver': 'cc2538',
            'device_id': device_id
        }
        self.dictionary['device'] = 'Triumvi'

    def addTimeStamp(self, timeStamp):
        self.dictionary['Time Stamp'] = {\
            'Year':timeStamp.year, \
            'Month':timeStamp.month, \
            'Day:':timeStamp.day, \
            'Hour':timeStamp.hour, \
            'Minute':timeStamp.minute, \
            'Second':timeStamp.second }



class triumvi(object):
    def __init__(self, callback):
        self.callback = callback
        self.cc2538Spi = mySPI(0)
        self.cc2520Spi = mySPI(1)
        self.cc2538DataReadyInt = mraa.Gpio(CC2538INTPINNUM)
        self.cc2538DataReadyInt.dir(mraa.DIR_IN)
        self.cc2538DataReadyInt.isr(mraa.EDGE_RISING, triumviCallBackISR, 8)
        self.cc2538Reset = mraa.Gpio(CC2538RESETPINNUM)
        self.cc2538Reset.dir(mraa.DIR_OUT)
        self.cc2538Reset.write(0) # active low
        self.cc2538Reset.write(1) # active low
        self.resetCount = 0

        self.redLed     = edisonLED('red')
        self.greenLed   = edisonLED('green')
        self.blueLed    = edisonLED('blue')
        # macro, don't touch
        self._SPI_MASTER_REQ_DATA = 0
        self._SPI_MASTER_DUMMY = 1
        self._SPI_MASTER_GET_DATA = 2
        self._SPI_MASTER_RADIO_ON = 3
        self._SPI_MASTER_RADIO_OFF = 4

        condition.acquire()
        while True:
            condition.wait()
            # When we have been notified we want to read the cc2538
            self.cc2538ISR()

            # Keep reading while there are pending interrupts
            while self.cc2538DataReadyInt.read() == 1:
                self.cc2538ISR()

    def requestData(self):
        dummy = self.cc2538Spi.writeByte(self._SPI_MASTER_REQ_DATA)

    def getData(self):
        length = self.cc2538Spi.writeByte(self._SPI_MASTER_DUMMY)
        if length < MIN_TRIUMVI_PKT_LEN or length > MAX_TRIUMVI_PKT_LEN:
            self.flushCC2538TXFIFO()
            return
        self.blueLed.leds_on()
        #print('data length: {0}'.format(length))
        dataOut = [self._SPI_MASTER_GET_DATA, length-1] + (length-2)*[0]
        data = self.cc2538Spi.write(dataOut)
        #print("Data: {0}".format(data))
        timeStamp = datetime.now()
        # print('Time Stamp: {0}, {1:02d}/{2:02d}, {3:02d}:{4:02d}:{5:02d}'.\
        #     format(timeStamp.year, timeStamp.month, timeStamp.day,\
        #     timeStamp.hour, timeStamp.minute, timeStamp.second))
        newPacket = triumviPacket(data)
        if newPacket:
            # newPacket.addTimeStamp(timeStamp)
            self.callback(newPacket)
            self.blueLed.leds_off()
            self.resetCount = 0

    def flushCC2538TXFIFO(self):
        self.redLed.leds_on()
        dummy = self.cc2538Spi.write([self._SPI_MASTER_GET_DATA, MAX_TRIUMVI_PKT_LEN-1] + (MAX_TRIUMVI_PKT_LEN-2)*[0])
        self.resetCount += 1
        if self.resetCount == MAX_FLUSH_THRESHOLD:
            self.resetCount = 0
            self.resetcc2538()
        self.redLed.leds_off()

    def cc2538ISR(self):
        self.requestData()
        while self.cc2538DataReadyInt.read() == 1:
            pass
        self.getData()

    def resetcc2538(self):
        self.cc2538Reset.write(0) # active low
        self.cc2538Reset.write(1)

    def radioOn(self):
        dummy = self.cc2538Spi.writeByte(self._SPI_MASTER_RADIO_ON)

    def radioOff(self):
        dummy = self.cc2538Spi.writeByte(self._SPI_MASTER_RADIO_OFF)



