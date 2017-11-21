#!/usr/bin/env node

//
// Forward mqtt packets from lora gateway to local mqtt stream
// Convert from hex string to bytes
//

var child_process = require('child_process');
var fs            = require('fs');
var ini           = require('ini');
var mqtt          = require('mqtt');

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/signpost-lab11.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.username == undefined || config.username == '' ||
        config.password == undefined || config.password == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/signpost-lab11.conf');
    process.exit(1);
}



function parse (topic, buf) {

    message_type = buf.readUInt8(0);

    if (topic.endsWith('lab11/energy')) {
        // Controller
        if (message_type == 0x01) {
            // Energy
            var battery_voltage = buf.readUInt16BE(1);
            var battery_current = buf.readInt32BE(3);
            var solar_voltage = buf.readUInt16BE(7);
            var solar_current = buf.readInt32BE(9);
            var battery_percent = buf.readUInt8(13);
            var battery_energy = buf.readUInt16BE(14);
            var battery_capacity = buf.readUInt16BE(16);

            var energy_module0 = buf.readUInt16BE(18);
            var energy_module1 = buf.readUInt16BE(20);
            var energy_module2 = buf.readUInt16BE(22);
            var energy_controller = buf.readUInt16BE(24);
            var energy_linux   = buf.readUInt16BE(26);
            var energy_module5 = buf.readUInt16BE(28);
            var energy_module6 = buf.readUInt16BE(30);
            var energy_module7 = buf.readUInt16BE(32);

            if(buf.length > 45) {
                var average_module0 = buf.readUInt16BE(34);
                var average_module1 = buf.readUInt16BE(36);
                var average_module2 = buf.readUInt16BE(38);
                var average_controller = buf.readUInt16BE(40);
                var average_linux   = 0;
                var average_module5 = buf.readUInt16BE(42);
                var average_module6 = buf.readUInt16BE(44);
                var average_module7 = buf.readUInt16BE(46);
            }

            if(typeof average_module0 !== 'undefined') {
                return {
                    device: "signpost_energy",
                    battery_voltage_mV: battery_voltage,
                    battery_current_uA: battery_current,
                    solar_voltage_mV: solar_voltage,
                    solar_current_uA: solar_current,
                    battery_capacity_percent_remaining: battery_percent,
                    battery_capacity_remaining_mAh: battery_energy,
                    battery_capacity_full_mAh: battery_capacity,
                    controller_energy_remaining_mWh: energy_controller,
                    module0_energy_remaining_mWh: energy_module0,
                    module1_energy_remaining_mWh: energy_module1,
                    module2_energy_remaining_mWh: energy_module2,
                    module5_energy_remaining_mWh: energy_module5,
                    module6_energy_remaining_mWh: energy_module6,
                    module7_energy_remaining_mWh: energy_module7,
                    controller_energy_average_mW: average_controller,
                    module0_energy_average_mW: average_module0,
                    module1_energy_average_mW: average_module1,
                    module2_energy_average_mW: average_module2,
                    module5_energy_average_mW: average_module5,
                    module6_energy_average_mW: average_module6,
                    module7_energy_average_mW: average_module7,
                }
            } else {
                return {
                    device: "signpost_energy",
                    battery_voltage_mV: battery_voltage,
                    battery_current_uA: battery_current,
                    solar_voltage_mV: solar_voltage,
                    solar_current_uA: solar_current,
                    battery_capacity_percent_remaining: battery_percent,
                    battery_capacity_remaining_mAh: battery_energy,
                    battery_capacity_full_mAh: battery_capacity,
                    controller_energy_remaining_mWh: energy_controller,
                    module0_energy_remaining_mWh: energy_module0,
                    module1_energy_remaining_mWh: energy_module1,
                    module2_energy_remaining_mWh: energy_module2,
                    module5_energy_remaining_mWh: energy_module5,
                    module6_energy_remaining_mWh: energy_module6,
                    module7_energy_remaining_mWh: energy_module7,
                }
            }
        }
    } else if (topic.endsWith('lab11/gps')) {
        // GPS
        var day = buf.readUInt8(1);
        var month = buf.readUInt8(2);
        var year = buf.readUInt8(3);
        var hours = buf.readUInt8(4);
        var minutes = buf.readUInt8(5);
        var seconds = buf.readUInt8(6);
        var latitude = buf.readInt32BE(7)/(10000*100.0);
        var longitude = buf.readInt32BE(11)/(10000*100.0);
        var fix = ['', 'No Fix', '2D', '3D'][buf.readUInt8(15)];
        var satellite_count = buf.readUInt8(16);

        if (year >= 80) {
          year += 1900;
        } else {
          year += 2000;
        }

        var latitude_direction = 'N';
        if (latitude < 0) {
          latitude *= -1;
          latitude_direction = 'S';
        }

        var longitude_direction = 'E';
        if (longitude < 0) {
          longitude *= -1;
          longitude_direction = 'W';
        }

        // that's right, month is zero-indexed for some reason
        var utcDate = new Date(Date.UTC(year, month-1, day, hours, minutes, seconds));

        //convert lat long to a geohash

        return {
            device: 'signpost_gps',
            latitude: latitude,
            latitude_direction: latitude_direction,
            longitude: longitude,
            longitude_direction: longitude_direction,
            timestamp: utcDate.toISOString(),
            satellite_count: satellite_count,
        }
    } else if (topic.endsWith('lab11/2.4ghz_spectrum')) {
        if (message_type == 0x01) {
            var chan11 = buf.readInt8(1);
            var chan12 = buf.readInt8(2);
            var chan13 = buf.readInt8(3);
            var chan14 = buf.readInt8(4);
            var chan15 = buf.readInt8(5);
            var chan16 = buf.readInt8(6);
            var chan17 = buf.readInt8(7);
            var chan18 = buf.readInt8(8);
            var chan19 = buf.readInt8(9);
            var chan20 = buf.readInt8(10);
            var chan21 = buf.readInt8(11);
            var chan22 = buf.readInt8(12);
            var chan23 = buf.readInt8(13);
            var chan24 = buf.readInt8(14);
            var chan25 = buf.readInt8(15);
            var chan26 = buf.readInt8(16);

            if (chan11 >= 0 ||
                chan12 >= 0 ||
                chan13 >= 0 ||
                chan14 >= 0 ||
                chan15 >= 0 ||
                chan16 >= 0 ||
                chan17 >= 0 ||
                chan18 >= 0 ||
                chan19 >= 0 ||
                chan20 >= 0 ||
                chan21 >= 0 ||
                chan22 >= 0 ||
                chan22 >= 0 ||
                chan23 >= 0 ||
                chan24 >= 0 ||
                chan25 >= 0 ||
                chan26 >= 0) {
                return undefined;
            }

            return {
                device: 'signpost_2.4ghz_spectrum',
                channel_11: chan11,
                channel_12: chan12,
                channel_13: chan13,
                channel_14: chan14,
                channel_15: chan15,
                channel_16: chan16,
                channel_17: chan17,
                channel_18: chan18,
                channel_19: chan19,
                channel_20: chan20,
                channel_21: chan21,
                channel_22: chan22,
                channel_23: chan23,
                channel_24: chan24,
                channel_25: chan25,
                channel_26: chan26,
            }
        }
    } else if (topic.endsWith('lab11/ambient') || topic.endsWith('ambient')) {
        if (message_type == 0x01) {
                        var temp = buf.readInt16BE(1) / 100.0;
            var humi = buf.readInt16BE(3) / 100.0;
            var ligh = buf.readInt16BE(5);
            // app returns pressure in uBar in 3 bytes, left aligned
                        // pascal = 1x10^-5 Bar = 10 uBar
            var pres;
            var pres1 =  buf.readUInt8(7);
            var pres2 =  buf.readUInt8(8);
            var pres3 =  buf.readUInt8(9);
            pres = ((pres1 << 16) + (pres2 << 8) + pres3) /10.0

            return {
                device: 'signpost_ambient',
                temperature_c: temp,
                humidity: humi,
                light_lux: ligh,
                pressure_pascals: pres,
            }
        }
    } else if (topic.endsWith('lab11/audio')) {
        if (message_type == 0x01) {
            //these are in dB SPL! I simplified the math to some magic numbers
            //here's the rundown
            //output/4096*3.3 = vout
            //vout/2.82 = voutrms
            //voutdB = 20*log(voutrms/ref=-38dBV@SPL=0.0125Vrms)
            //voutmic = voutdB-(msgeq7gain+ampgain@100k=58.5dB)
            //voutmic+94dB SPL = outdB @spl
            //reduces to
            //(20*log(output/43.75))+35.5
            //for right now this is happening here, but I'm trying to move it
            //to the app itself
            var f_63_hz = Number(((Math.log10(buf.readUInt16BE(1)/43.75)*20)+35.5).toFixed(0));
            var f_160_hz = Number(((Math.log10(buf.readUInt16BE(3)/43.75)*20)+35.5).toFixed(0));
            var f_400_hz = Number(((Math.log10(buf.readUInt16BE(5)/43.75)*20)+35.5).toFixed(0));
            var f_1000_hz = Number(((Math.log10(buf.readUInt16BE(7)/43.75)*20)+35.5).toFixed(0));
            var f_2500_hz = Number(((Math.log10(buf.readUInt16BE(9)/43.75)*20)+35.5).toFixed(0));
            var f_6250_hz = Number(((Math.log10(buf.readUInt16BE(11)/43.75)*20)+35.5).toFixed(0));
            var f_16000_hz = Number(((Math.log10(buf.readUInt16BE(13)/43.75)*20)+35.5).toFixed(0));

            return {
                device: 'signpost_audio_frequency',
                "63Hz": f_63_hz,
                '160Hz': f_160_hz,
                '400Hz': f_400_hz,
                '1000Hz': f_1000_hz,
                '2500Hz': f_2500_hz,
                '6250Hz': f_6250_hz,
                '16000Hz': f_16000_hz,
            }
        } else if (message_type == 0x02) {
            //read unix time
            var utime = buf.readUInt32BE(1);
            values = [];
            var i = 0;
            for(; i < 10; i++) {
                var date = new Date((utime+i)*1000).toISOString();
                var f_63_hz = buf.readUInt8(4+i*7+1)
                var f_160_hz = buf.readUInt8(4+i*7+2)
                var f_400_hz = buf.readUInt8(4+i*7+3)
                var f_1000_hz = buf.readUInt8(4+i*7+4)
                var f_2500_hz = buf.readUInt8(4+i*7+5)
                var f_6250_hz = buf.readUInt8(4+i*7+6)
                var f_16000_hz = buf.readUInt8(4+i*7+7)
                freq = {
                    device: 'signpost_audio_frequency',
                     "63Hz": f_63_hz,
                    '160Hz': f_160_hz,
                    '400Hz': f_400_hz,
                    '1000Hz': f_1000_hz,
                    '2500Hz': f_2500_hz,
                    '6250Hz': f_6250_hz,
                    '16000Hz': f_16000_hz,
                    '_meta': {
                        'received_time': date,
                    }
                }

                values.push(freq);
            }

            return values;
        } else if (message_type == 0x03) {
            //read unix time
            var utime = buf.readUInt32BE(1);
            values = [];
            var i = 0;
            for(; i < 10; i++) {
                var date = new Date((utime+i)*1000).toISOString();
                var f_63_hz = buf.readUInt8(4+i*7+1)/10 + 50
                var f_160_hz = buf.readUInt8(4+i*7+2)/10 + 50
                var f_400_hz = buf.readUInt8(4+i*7+3)/10 + 50
                var f_1000_hz = buf.readUInt8(4+i*7+4)/10 + 50
                var f_2500_hz = buf.readUInt8(4+i*7+5)/10 + 50
                var f_6250_hz = buf.readUInt8(4+i*7+6)/10 + 50
                var f_16000_hz = buf.readUInt8(4+i*7+7)/10 + 50
                freq = {
                    device: 'signpost_audio_frequency',
                     "63Hz": f_63_hz,
                    '160Hz': f_160_hz,
                    '400Hz': f_400_hz,
                    '1000Hz': f_1000_hz,
                    '2500Hz': f_2500_hz,
                    '6250Hz': f_6250_hz,
                    '16000Hz': f_16000_hz,
                    '_meta': {
                        'received_time': date,
                    }
                }

                values.push(freq);
            }

            return values;
        }

    } else if (topic.endsWith('lab11/radar')) {
        if (message_type == 0x01) {
            var motion = buf.readInt8(1) > 0;
            var speed = buf.readUInt32BE(2) / 1000.0;
            var motion_confidence = buf.readUInt8(6);

            return {
                device: 'signpost_microwave_radar',
                motion: motion,
                'velocity_m/s': speed,
                'motion_confidence': motion_confidence,
            }
        } else if (message_type == 0x02) {
            var utime = buf.readUInt32BE(1);
            values = [];
            var i = 0;
            for(; i < 20; i++) {
                var date = new Date((utime+i)*1000).toISOString();
                var motion = buf.readUInt8(5+i);
                freq = {
                    device: 'signpost_microwave_radar',
                     "motion_index": motion,
                    '_meta': {
                        'received_time': date,
                    }
                }

                values.push(freq);
            }

            return values;
        }
    } else if (topic.endsWith('lab11/aqm')) {
        if (message_type == 0x01) {
            var co2_ppm = buf.readUInt16BE(1);
            var VOC_PID_ppb = buf.readUInt32BE(3);
            var VOC_IAQ_ppb = buf.readUInt32BE(7);
            var barometric_millibar = buf.readUInt16BE(11);
            var humidity_percent = buf.readUInt16BE(13);
            return {
                device: 'signpost_ucsd_air_quality',
                co2_ppm: co2_ppm,
                VOC_PID_ppb: VOC_PID_ppb,
                VOC_IAQ_ppb: VOC_IAQ_ppb,
                barometric_millibar: barometric_millibar,
                humidity_percent: humidity_percent,
            }
        }
    } else if (topic.endsWith('lab11/radio-status')) {
        if (message_type == 0x01) {
            var controller = 0;
            var audio = 0;
            var microwave = 0;
            var rf = 0;
            var ambient = 0;
            var radio = 0;
            var ucsd = 0;

            var num_mods = buf.readUInt8(1);
            j = 0;
            for(; j < num_mods; j++) {
                switch(buf.readUInt8(1+j*2)) {
                    case 0x20:
                        controller = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x22:
                        radio = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x32:
                        ambient = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x33:
                        audio = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x34:
                        microwave = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x34:
                        ucsd = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x36:
                        rf = buf.readUInt8(1+j*2+1);
                    break;
                }
            }

            queue_size = buf.readUInt8(1+j*2);

            return {
                device: 'signpost_radio',
                packets_sent: {
                    "controller": controller,
                    "rf_spectrum": rf,
                    "ambient_sensing": ambient,
                    "audio_spectrum": audio,
                    "microwave_radar": microwave,
                    "ucsd_air_quality": ucsd,
                    "radio_status": radio,
                },
                packets_delayed_for_muling: {},
                "radio_queue_length": queue_size,
            }
        }
        else if (message_type == 0x02) {
            var controller = 0;
            var audio = 0;
            var microwave = 0;
            var rf = 0;
            var ambient = 0;
            var radio = 0;
            var ucsd = 0;

            var num_mods = buf.readUInt8(1);
            j = 0;
            for(; j < num_mods; j++) {
                switch(buf.readUInt8(1+j*2)) {
                    case 0x20:
                        controller = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x22:
                        radio = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x32:
                        ambient = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x33:
                        audio = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x34:
                        microwave = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x34:
                        ucsd = buf.readUInt8(1+j*2+1);
                    break;
                    case 0x36:
                        rf = buf.readUInt8(1+j*2+1);
                    break;
                }
            }

            var eventual_index = j*2 + 2
            var num_stored = buf.readUInt8(eventual_index);
            eventual_index += 1;
            var lognames = [];
            var remainings = [];
            j = 0;
            for(; j < num_stored; j++) {
              var log_remaining = buf.readUInt16BE(eventual_index);
              eventual_index += 2;
              var logname_len = buf.readUInt8(eventual_index);
              eventual_index += 1;
              var logname = buf.toString('utf8', eventual_index, eventual_index + logname_len);
              eventual_index += logname_len;
              lognames.push(logname);
              remainings.push(log_remaining);
            }
            queue_size = buf.readUInt8(eventual_index);

            json = {
                device: 'signpost_radio',
                packets_sent: {
                    "controller": controller,
                    "rf_spectrum": rf,
                    "ambient_sensing": ambient,
                    "audio_spectrum": audio,
                    "microwave_radar": microwave,
                    "ucsd_air_quality": ucsd,
                    "radio_status": radio,
                },
                packets_delayed_for_muling: {},
                "radio_queue_length": queue_size,
            }
            j = 0;
            for(; j < lognames.length; j++) {
                json.packets_delayed_for_muling[lognames[j]] = remainings[j];
            }
            return json;
        }
    } else if (topic.endsWith('lab11/spectrum')) {
        var datastr = "";
        var retobj = {};
        if(message_type == 0x01) {
            datastr = "max";
            retobj['device'] = 'signpost_rf_spectrum_max';
        } else if(message_type == 0x02) {
            datastr = "mean";
            retobj['device'] = 'signpost_rf_spectrum_mean';
        } else if(message_type == 0x03) {
            datastr = "stddev";
            retobj['device'] = 'signpost_rf_spectrum_stddev';
        }
        for (var i = 0; i < 80; i++) {
            var lowend = 470+i*6;
            var highend = 470+6+i*6;
            var fullstr = lowend.toString()+"MHz"+"-"+highend.toString()+"MHz"+"_"+datastr;
            retobj[fullstr] = buf.readInt8(1+i);
        }
        return retobj;
    }
}

var mqtt_client = mqtt.connect('mqtt://localhost');
var mqtt_external = mqtt.connect('mqtt://localhost:8883',{username: config.username, password: config.password});

mqtt_client.on('connect', function () {
    // Subscribe to all packets
    mqtt_external.subscribe('signpost/+/lab11/#');
    mqtt_external.subscribe('signpost/#');

    // Callback for each packet
    mqtt_external.on('message', function (topic, message) {
        var json = JSON.parse(message.toString());
        try {
            if(json.data) {
                buf = Buffer.from(json.data);
                console.log("Got " + topic + " packet from " + json.device_id);
                //console.log(buf.toString('hex'));
                var pkt = parse(topic,buf);
                //console.log("packet: \n%j", pkt);
                if(Array.isArray(pkt)) {
                    for(var i = 0; i < pkt.length; i++) {
                        if(typeof(pkt[i]['_meta']) == 'undefined') {
                            pkt[i]['_meta'] = {};
                        }

                        pkt[i]['_meta'].device_id = json.device_id;
                        pkt[i]['_meta'].gateway_id = 'signpost';

                        if(typeof(pkt[i]['_meta'].received_time) == 'undefined') {
                            pkt[i]['_meta'].received_time = json.received_time;
                        }

                        pkt[i]['_meta'].receiver = json.receiver;
                        pkt[i]['_meta'].geohash = json.geohash;
                        pkt[i]['_meta'].sequence_number = json.sequence_number;

                        mqtt_client.publish('gateway-data', JSON.stringify(pkt[i]));
                        mqtt_client.publish('signpost/processed/'+topic, JSON.stringify(pkt[i]));
                    }
                } else {
                    if(typeof(pkt['_meta']) == 'undefined') {
                        pkt['_meta'] = {};
                    }
                    pkt['_meta'].device_id = json.device_id;
                    pkt['_meta'].gateway_id = 'signpost';

                    if(typeof(pkt['_meta'].received_time) == 'undefined') {
                        pkt['_meta'].received_time = json.received_time;
                    }

                    pkt['_meta'].receiver = json.receiver;
                    pkt['_meta'].geohash = json.geohash;
                    pkt['_meta'].sequence_number = json.sequence_number;

                    mqtt_client.publish('gateway-data', JSON.stringify(pkt));
                    mqtt_client.publish('signpost/processed/'+topic, JSON.stringify(pkt));
                }
            }
        } catch (e) {
            console.log(e)
        }

    });
});
