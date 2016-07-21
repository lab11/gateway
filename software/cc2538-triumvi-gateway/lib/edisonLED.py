
LED_RED_MRAA_NUM = 14
LED_GREEN_MRAA_NUM = 20
LED_BLUE_MRAA_NUM = 0

import mraa
class edisonLED(object):
    def __init__(self, color):
        if color == 'red':
            self.led = mraa.Gpio(LED_RED_MRAA_NUM)
        elif color == 'green':
            self.led = mraa.Gpio(LED_GREEN_MRAA_NUM)
        elif color == 'blue':
            self.led = mraa.Gpio(LED_BLUE_MRAA_NUM)
        else:
            print "Unknown color"
            return
        self.led.dir(mraa.DIR_OUT)
        self.led.write(0)
        self.ledState = False

    def leds_on(self):
        self.led.write(1)
        self.ledState = True

    def leds_off(self):
        self.led.write(0)
        self.ledState = False

    def leds_toggle(self):
        self.ledState = not self.ledState
        if self.ledState:
            self.led.write(1)
        else:
            self.led.write(0)
