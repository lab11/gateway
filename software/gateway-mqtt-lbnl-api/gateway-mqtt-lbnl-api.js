#!/usr/bin/env node

/*******************************************************************************
 * RePublish MQTT in accordance to LBNL API.
 *
 * On:
 *  - MQTT
 ******************************************************************************/

var mqtt  = require('mqtt');
var debug = require('debug')('gateway-mqtt-lbnl-api');

var argv = require('yargs')
    .help('h')
    .alias('h', 'help')
    .strict()
    .argv;

/*******************************************************************************
 * CONFIGURATION OPTIONS
 ******************************************************************************/
var MQTT_SUBSCRIBE_TOPIC_NAME = 'device/Permamote/#';
var MQTT_PUBLISH_TOPIC_NAME = 'lbnl-api';

/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

var mqtt_client = mqtt.connect('mqtt://localhost');

mqtt_client.on('connect', function () {
    debug('Connected to MQTT');

    // Subscribe
    mqtt_client.subscribe(MQTT_SUBSCRIBE_TOPIC_NAME);
    mqtt_client.on('message', new_message);
});

function new_message(topic, message) {
  api_data = {};
  var data = JSON.parse(message.toString());
  if (data.device != 'Permamote') return;
  if (!(data.topic == 'light_lux' || data.topic == 'light_cct_k' || data.topic == 'motion')) return;
  api_data.EntityID = data._meta.device_id;
  api_data.EntityModel = data.device;
  api_data.EntityAPIVersion = data._meta.version.toString();
  api_data.TimeStamp = data._meta.timestamp;
  if (data.topic == 'light_lux') {
    api_data.LightSensorLevel = data.light_lux;
  }
  if (data.topic == 'light_cct_k') {
    api_data.SensorCCT = data.light_cct_k;
  }
  if (data.topic == 'motion') {
    api_data.OccupancySensorState = data.motion;
  }
  debug(api_data);
  mqtt_client.publish(MQTT_PUBLISH_TOPIC_NAME, JSON.stringify(api_data));
}
