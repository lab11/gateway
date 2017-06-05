#!/usr/bin/env node

// Map Internet connectivity and packet rate to LEDs

var dns  = require('dns');
var fs   = require('fs');

var mqtt     = require('mqtt');
var watchout = require('watchout');

// Current state
var _internet = false;
var _packets = false;


/*******************************************************************************
 * GPIO Functions
 ******************************************************************************/

var GPIO_RED   = 13
var GPIO_GREEN = 12
var GPIO_BLUE  = 182

function enable_gpio (pin) {
    if (!fs.existsSync('/sys/class/gpio/gpio'+pin)) {
        fs.writeFileSync('/sys/class/gpio/export', pin);
    }

    fs.writeFileSync('/sys/class/gpio/gpio'+pin+'/direction', 'out');
    fs.writeFileSync('/sys/class/gpio/gpio'+pin+'/value', '0');
}

function set_leds () {
    var red_led = false;
    var green_led = false;
    var blue_led = false;

    if (!_internet && !_packets) {
        // No internet and no packets, set to RED
        red_led = true;
    } else if (_internet && !_packets) {
        // Online, but no sensors, set to BLUE
        blue_led = true;
    } else if (!_internet && _packets) {
        // Sensors, but no internet, set to PURPLE
        red_led = true;
        blue_led = true;
    } else {
        // Online and sensors, set to GREEN
        green_led = true;
    }

    function led_set (led, val) {
        fs.writeFileSync('/sys/class/gpio/gpio'+led+'/value', val ? '1' : '0');
    }

    led_set(GPIO_RED, red_led);
    led_set(GPIO_GREEN, green_led);
    led_set(GPIO_BLUE, blue_led);
}



/*******************************************************************************
 * Checks
 ******************************************************************************/

function check_internet () {
    dns.lookup('google.com', function (err) {
        if (err && err.code == "ENOTFOUND") {
            _internet = false;
        } else {
            _internet = true;
        }
    });
}

//
// Check for packets on the gateway-data MQTT topic
//

// Set a watchdog for a minute, which, if it expires, means we are not
// getting gateway packets.
var watchdog = new watchout(1*60*1000, function(didCancelWatchdog) {
    if (!didCancelWatchdog) {
        _packets = false;

        // Hack to get watchdog to start again if we call reset again
        // after it has expired.
        watchdog._stopped = false;
    }
});

var mqtt_client = mqtt.connect('mqtt://localhost');
mqtt_client.on('connect', function () {
    // Subscribe to all packets
    mqtt_client.subscribe('gateway-data');

    // Callback for each packet
    mqtt_client.on('message', function (topic, message) {
        _packets = true;
        watchdog.reset();
    });
});


/*******************************************************************************
 * Main
 ******************************************************************************/

// Setup the LED pins
enable_gpio(GPIO_RED);
enable_gpio(GPIO_GREEN);
enable_gpio(GPIO_BLUE);

// Periodically run the checks
check_internet();
setInterval(check_internet, 1*60*1000);

// Periodically update the LEDs
set_leds();
setInterval(set_leds, 10*1000);
