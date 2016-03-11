#! /usr/bin/env node

// watch for errors on gateway and notify via email
//	current checks:
//		watchdog on incoming ble packets over mqtt

var nodemailer = require('nodemailer');
var fs = require('fs');
var ini = require('ini');
var watchout = require('watchout');
var MQTTDiscover = require('mqtt-discover');
var getmac = require('getmac');
var request = require('request');

// discover the local MQTT broker
MQTTDiscover.start();
var MQTT_DATA_TOPIC = 'gateway-data';
var MQTT_DATA_WATCHDOG_DURATION = 1*60*1000;

// configuration
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/email.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.email_transport == undefined || config.email_transport == '') {
	throw new Exception("No email transport configuration");
    }
} catch (e) {
    console.log(e);
    console.log("\nCannot find /etc/swarm-gateway/email.conf of configuration invalid");
    process.exit(1);
}

// keep the ID of the gateway
//  default to a local getmac, but prefer ID as requested from the gateway's
//  webserver API if possible
var gateway_id = '';
getmac.getMac(function (err, addr) {
    if (gateway_id == '') {
	gateway_id = addr;
    }
});

// get the unique id for this gateway
function get_gateway_id (gateway_ip) {
    // http://<gateway_ip>/api/id has a unique ID for the device
    //  This is the MAC address as discovered by getmac
    //  If that response cannot be obtained, default to a local getmac which
    //  will probably be identical
    request('http://'+gateway_ip+'/api/id', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            gateway_id = body;
        } else {
            debug("Error requesting ID from " + gateway_ip);
        }
    });
}

// create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport(config.email_transport);
function send_email (subject, text) {
    // setup e-mail data with unicode symbols
    var mailOptions = {
	from: '4908admin@umich.edu',
	to: config.to_list,
	subject: subject,
	text: text,
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function(error, info){
	if (error) {
	    console.log("Error sending email: " + error);
	    return;
	}
    });
}

// add a watchdog for mqtt packets
var mqtt_down = false;
var mqtt_last_data = '';
var mqtt_watchdog = null;
function mqtt_data_watchdog (didCancelWatchdog) {
    if (!didCancelWatchdog) {
	console.log("MQTT data watchdog tripped");
	mqtt_down = true;
	mqtt_watchdog = null;

	subject = "MQTT data watchdog tripped";

	text = '';
	text += "Swarm Gateway: " + gateway_id + '\n\n';
	text += "MQTT data watchdog tripped\n";
	text += "Last received data packets at : " + mqtt_last_data + '\n'

	send_email(subject, text);
    }
}

// connect to MQTT broker and subscribe to packets
MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    console.log("Connected to MQTT broker: " + mqtt_client.options.host);

    // attempt to get unique ID for gateway
    get_gateway_id(mqtt_client.options.host);

    // subscribe to BLE data
    mqtt_client.subscribe(MQTT_DATA_TOPIC);
    mqtt_client.on('message', function (topic, message) {
	if (topic == MQTT_DATA_TOPIC) {
	    // ping the watchdog
	    if (mqtt_watchdog == null) {
		mqtt_watchdog = new watchout(MQTT_DATA_WATCHDOG_DURATION, mqtt_data_watchdog);
	    }
	    mqtt_watchdog.reset();

	    mqtt_last_data = new Date();
	    if (mqtt_down) {
		console.log("Getting packets again");
		mqtt_down = false;
	    }
	}
    });
});

