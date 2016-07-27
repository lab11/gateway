
import mraa
class mySPI(object):
    def __init__(self, cs):
        self.spi = mraa.Spi(0)
        self.cs = mraa.Gpio(23) if cs == 0 else mraa.Gpio(9)
        self.cs.dir(mraa.DIR_OUT)
        self.cs.write(1)
        self.spi.frequency(2000000) # 2 MHz
        self.spi.mode(mraa.SPI_MODE3)
        # first write a dummy byte
        self.spi.writeByte(0)

    def setFrequency(self, freq):
        self.spi.frequency(freq)

    # 1 byte Data
    def writeByte(self, data):
        # dummy byte
        self.spi.writeByte(0)
        self.cs.write(0)
        miso = self.spi.writeByte(data)
        self.cs.write(1)
        return miso

    # byte array
    def write(self, data):
        data = bytearray(data)
        self.spi.writeByte(0)
        self.cs.write(0)
        miso = self.spi.write(data)
        self.cs.write(1)
        return miso
