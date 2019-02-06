#!/usr/bin/env node

const fs        = require('fs');

const argv      = require('minimist')(process.argv.slice(2));
const debug     = require('debug')('http-dominion-mqtt');
const ini       = require('ini');
const request   = require('request');
const gatewayId = require('lab11-gateway-id');
const mqtt      = require('mqtt');

const MQTT_TOPIC_NAME = 'gateway-data';

// Get the ID for this gateway
var _gateway_id = '';
gatewayId.id(function (addr) {
    _gateway_id = addr;
});


// Default config file path
var config_file = '/etc/swarm-gateway/dominion.conf';

// Check if the user wants to override that.
if ('config' in argv) {
    config_file = argv.config;
}

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync(config_file, 'utf-8');
    var config = ini.parse(config_file);
    if (config.usernames == undefined || config.username == []) {
        throw new Exception('no settings');
    }
    if (config.passwords == undefined || config.password == []) {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find ' + config_file + ' or dominion not configured.');
    process.exit(1);
}




function update_data (mqtt_client, user, pass) {

    const req_login = {
      url: 'https://mydom.dominionenergy.com/siteminderagent/forms/login.fcc',
      method: 'POST',
      headers: {
        'Host': 'mydom.dominionenergy.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:65.0) Gecko/20100101 Firefox/65.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Upgrade-Insecure-Requests': '1',
      },
      gzip: true,
      form:{
        '__EVENTTARGET':'',
        '__EVENTARGUMENT':'',
        'smauthreason':'0',
        'target':'https://mydom.dominionenergy.com',
        'user':user,
        'password':pass,
      },
    };

    // Login to get a cookie
    request(req_login, function callback(error, response, body) {
        // Iterate all returned cookies to get the one we need.
        let cookies = response.caseless.get('Set-Cookie');
        var cookie = '';
        for (var cookie_index in cookies) {
            if (cookies[cookie_index].indexOf('SMSESSION') >= 0) {
                cookie = cookies[cookie_index];
            }
        }



        const req_mainpage = {
            url: 'https://mya.dominionenergy.com/Usage/DailyIntervalData',
            headers: {
                'Host': 'mya.dominionenergy.com',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:65.0) Gecko/20100101 Firefox/65.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://mya.dominionenergy.com/Usage/DailyIntervalData',
                'Connection': 'keep-alive',
                'Cookie': cookie,
                'Upgrade-Insecure-Requests': '1',
            },
            gzip: true,
        };

        // Request the user page to get the links to the actual interval data.
        request(req_mainpage, function callback(error, response, body) {

            // Find first link in the HTML. Happens to be the TXT one we want.
            var link_location_sta = body.indexOf('href="/usage/ViewDailyIntervalData') + 6;
            var link_location_end = body.indexOf('"', link_location_sta);
            var link = body.substr(link_location_sta, link_location_end-link_location_sta)


            const req_txtdata = {
                url: 'https://mya.dominionenergy.com' + link,
                headers: {
                    'Host': 'mya.dominionenergy.com',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:65.0) Gecko/20100101 Firefox/65.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://mya.dominionenergy.com/Usage/DailyIntervalData',
                    'Connection': 'keep-alive',
                    'Cookie': cookie,
                    'Upgrade-Insecure-Requests': '1',
                  },
                  gzip: true,
            };

            // Get the actual TXT power data.
            request(req_txtdata, function callback(error, response, body) {

                // Get the last day we have processed.
                var last_day = '01/01/2019';
                try {
                    last_day = fs.readFileSync(__dirname + '/' + user + '.last', 'utf-8');
                } catch (e) {}
                last_day = new Date(last_day);

                // Keep track of what will be the new last day.
                var first_day = undefined;

                let lines = body.split(/\r?\n/);
                for (var line_index in lines) {
                    var line = lines[line_index];
                    let fields = line.split(/,/);

                    if (fields.length == 51) {
                        var account_no = fields[0];
                        var recorder_id = fields[1];
                        var day = new Date(fields[2]);

                        if (day <= last_day) {
                            // Days are order in descending order.
                            break;
                        }
                        if (first_day === undefined) {
                            first_day = day;
                        }

                        var daily_kwh = 0.0;

                        // Iterate all 30 minute intervals
                        for (var i=0; i<48; i++) {
                            let tstamp = new Date(day.getTime() + (30*(i+1))*60000).toISOString();
                            let kw = parseFloat(fields[i+3]);
                            // console.log(tstamp + '  :  ' + kw);

                            daily_kwh += (0.5 * kw);

                            // Publish 30 minute interval measurement.
                            var out = {
                                power_w: kw*1000.0,
                            }
                            out._meta = {
                                received_time: tstamp,
                                account_no: account_no,
                                recorder_id: recorder_id,
                                device_id: 'dominion-' + account_no,
                                receiver: 'http-dominion-mqtt',
                                gateway_id: _gateway_id
                            }
                            mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));


                        }

                        // Publish daily energy too.
                        var out = {
                            energy_kWh: daily_kwh,
                        }
                        out._meta = {
                            received_time: day.toISOString(),
                            account_no: account_no,
                            recorder_id: recorder_id,
                            device_id: 'dominion-' + account_no,
                            receiver: 'http-dominion-mqtt',
                            gateway_id: _gateway_id
                        }
                        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
                    }
                }

                // Update which is the last day we have recorded in our database.
                if (first_day != undefined) {
                    var date_str = (first_day.getMonth()+1) + '/' + first_day.getDate() + '/' + first_day.getFullYear();
                    fs.writeFileSync(__dirname + '/' + user + '.last', date_str);
                }
            });
        });

    });
}

function update_all_data () {
    var mqtt_client = mqtt.connect('mqtt://localhost');
    mqtt_client.on('connect', function () {
        for (var user_index in config.usernames) {
            var user = config.usernames[user_index];
            var pass = config.passwords[user_index];
            update_data(mqtt_client, user, pass);
        }
    });
}

update_all_data();

// It seems data is updated every 24 hours, so we sample every 7 hours.
setInterval(update_all_data, 7*60*60*1000);



