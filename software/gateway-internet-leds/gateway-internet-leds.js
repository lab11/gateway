#!/usr/bin/env node

// Map Internet connectivity and packet rate to LEDs

var dns  = require('dns');
var exec = require('child_process').exec;
var fs   = require('fs');

// Current state
var _internet = false;
var _ble_packets = false;


/*******************************************************************************
 * GPIO Functions
 ******************************************************************************/

var GPIO_RED   = 13
var GPIO_GREEN = 12
var GPIO_BLUE  = 182

var red_led   = false;
var green_led = false;
var blue_led   = false;

function enable_gpio (pin) {
    if (!fs.existsSync('/sys/class/gpio/gpio'+pin)) {
        fs.writeFileSync('/sys/class/gpio/export', pin);
    }

    fs.writeFileSync('/sys/class/gpio/gpio'+pin+'/direction', 'out');
    fs.writeFileSync('/sys/class/gpio/gpio'+pin+'/value', '0');
}


function configure_color () {
    red_led = false;
    green_led = false;
    blue_led = false;

    if (!_internet && !_ble_packets) {
        red_led = true;
    } else if (_internet && !_ble_packets) {
        blue_led = true;
    } else if (_ble_packets && !_internet) {
        red_led = true;
        blue_led = true;
    } else {
        green_led = true;
    }
}

function set_leds () {

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
        configure_color();
        set_leds();
    });
}

function check_ble () {
    function get_ble_count (cb) {
        exec('hciconfig', function (err, stdout, stderr) {
            var lines = stdout.split('\n');
            var fields = lines[3].split(/(\s+)/);
            var result = parseInt(fields[4].split(':')[1]);
            cb(result)
        });
    }
    get_ble_count(function (count_start) {
        setTimeout(function () {
            get_ble_count(function (count_end) {
                _ble_packets = (count_end != count_start);
            })
        }, 100);
    });
}


/*******************************************************************************
 * Main
 ******************************************************************************/

// Setup the LED pins
enable_gpio(GPIO_RED);
enable_gpio(GPIO_GREEN);
enable_gpio(GPIO_BLUE);

// Periodically run the checks
setInterval(check_internet, 1000);
setInterval(check_ble, 1005);
