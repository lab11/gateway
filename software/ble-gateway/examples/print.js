#!/usr/bin/env node

/*******************************************************************************
 * Print formatted advertisement packets to the console.
 ******************************************************************************/

var BleGateway = require('../ble-gateway');
var bleg = new BleGateway();

bleg.on('advertisement', function (adv_obj) {
	console.log(adv_obj);
});

bleg.start();
