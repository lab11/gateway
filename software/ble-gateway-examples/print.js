#!/usr/bin/env node

/*******************************************************************************
 * Print formatted advertisement packets to the console.
 ******************************************************************************/

var BleGateway = require('ble-gateway');
var bleg = new BleGateway();

console.log(bleg)
bleg.on('advertisement', function (adv_obj) {
	console.log(adv_obj);
});

bleg.start();
