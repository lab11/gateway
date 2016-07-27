
from mySPI import mySPI
from edisonLED import edisonLED
import mraa

import threading

CC2538INTPINNUM = 38 # MRAA number, GP43
CC2538RESETPINNUM = 51 # MRAA number, GP41
MIN_TRIUMVI_PKT_LEN = 14 # maximum triumvi packet length
MAX_FLUSH_THRESHOLD = 32 # maximum trials before reset cc2538


condition = threading.Condition()

def receiveCallBackISR(args):
    condition.acquire()
    condition.notify()
    condition.release()


class receive(object):
    def __init__(self, callback):
        self.callback = callback
        self.cc2538Spi = mySPI(0)
        self.cc2520Spi = mySPI(1)
        self.cc2538DataReadyInt = mraa.Gpio(CC2538INTPINNUM)
        self.cc2538DataReadyInt.dir(mraa.DIR_IN)
        self.cc2538DataReadyInt.isr(mraa.EDGE_RISING, receiveCallBackISR, 8)
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
        if length < MIN_TRIUMVI_PKT_LEN:
            self.flushCC2538TXFIFO()
            return
        self.blueLed.leds_on()
        dataOut = [self._SPI_MASTER_GET_DATA, length-1] + (length-2)*[0]
        data = self.cc2538Spi.write(dataOut)
        self.callback(data)
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
