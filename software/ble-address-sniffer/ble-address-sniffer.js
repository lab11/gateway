var crypto = require('crypto');

var noble = require('noble');

noble.on('stateChange', function(state) {
	console.log(state)
	if (state === 'poweredOn') {
		console.log('Scanning for BLE peripherals')
		noble.startScanning([], true);
	} else {
		noble.stopScanning();
	}
});

noble.on('scanChanged', function (enable, filter_dups) {
	try {
		noble.startScanning([], true);
	} catch (e) { }
});

// Takes address as a buffer
function hash_address (address) {
	var hash = crypto.createHash('sha256');
	hash.update(address);
	var value = hash.digest()[31];
	var out = '0x' + value.toString(16);
	return out;
}


var hash_to_addresses = {};



noble.on('discover', function (peripheral) {
	// console.log(peripheral.address)
	var address_buffer = new Buffer(peripheral.id, 'hex')
	var hashed_address = hash_address(address_buffer);
	// console.log(hashed_address)


	if (!(hashed_address in hash_to_addresses)) {
		hash_to_addresses[hashed_address] = [];
	}

	if (hash_to_addresses[hashed_address].indexOf(peripheral.address) < 0) {
		hash_to_addresses[hashed_address].push(peripheral.address);
	}

});

process.on('SIGINT', function() {
	console.log();
	console.log(hash_to_addresses);
	process.exit();
});
