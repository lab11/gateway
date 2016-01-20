var crypto = require('crypto');
var events = require('events');
var fs = require('fs');
var util = require('util');

var noble = require('noble');


var BleAddressSniffer = function () {
	// Map of peripheral address to salt buffer
	this._salts = {};

	// Whether we should save randomly generated salts
	this._save_salts = false;

	noble.on('discover', this.on_discover.bind(this));
	noble.on('scanChanged', this.on_scan_changed.bind(this));
};

util.inherits(BleAddressSniffer, events.EventEmitter);

BleAddressSniffer.prototype.start = function (save_salts) {
	var startScanningOnPowerOn = function() {
		if (noble.state === 'poweredOn') {
			noble.startScanning([], true);
		} else {
			noble.once('stateChange', startScanningOnPowerOn);
		}
	};

	// Check for saved salts
	try {
		var salts_json = fs.readFileSync('salts.json', 'utf8');
		this._salts = JSON.parse(salts_json);
		console.log('Successfully loaded salts.json');
	} catch (e) {}

	this._save_salts = save_salts;

	startScanningOnPowerOn();
};

BleAddressSniffer.prototype.on_scan_changed = function (enable, filter_dups) {
	try {
		noble.startScanning([], true);
	} catch (e) { }
};

BleAddressSniffer.prototype.on_discover = function (peripheral) {
	var address_buffer = new Buffer(peripheral.id, 'hex')
	var hashes = this.hash_address(address_buffer);
	var full_hash = hashes[0];
	var hashed_address = hashes[1];

	var adv = {
		globalHashedAddress: hashed_address,
		localHashedAddress: full_hash
	};
	this.emit('advertisement', adv);
};

// Takes address as a buffer
BleAddressSniffer.prototype.hash_address = function (address) {

	// Create a pure hash with a salt

	// Lookup to see if we have a salt
	var address_string = address.toString('hex');
	if (!(address_string in this._salts)) {
		// Need to create a new salt
		this._salts[address_string] = crypto.randomBytes(256).toString('hex');

		if (this._save_salts) {
			this.save_salts();
		}
	}

	// Do hash with the salt
	var to_hash = Buffer.concat([address, new Buffer(this._salts[address_string], 'hex')]);
	var hash1 = crypto.createHash('sha256');
	hash1.update(to_hash);
	var address_salt_hash = hash1.digest('hex');

	// Do the regular hash and truncate to just a few bits
	var hash2 = crypto.createHash('sha256');
	hash2.update(address);
	var value = hash2.digest()[31];
	var out = '' + ('0' + value.toString(16)).slice(-2);

	return [address_salt_hash, out];
}

BleAddressSniffer.prototype.save_salts = function () {
	var salts_json = JSON.stringify(this._salts);
	fs.writeFileSync('salts.json', salts_json, 'utf8');
}

if (require.main === module) {
	var bas = new BleAddressSniffer();

	var hash_to_addresses = {};

	bas.on('advertisement', function (adv) {
		if (!(adv.globalHashedAddress in hash_to_addresses)) {
			hash_to_addresses[adv.globalHashedAddress] = [];
			console.log(adv.localHashedAddress);
		}

		if (hash_to_addresses[adv.globalHashedAddress].indexOf(adv.localHashedAddress) < 0) {
			hash_to_addresses[adv.globalHashedAddress].push(adv.localHashedAddress);
			console.log(hash_to_addresses);
		}
	});

	bas.start(true);
} else {
	module.exports = new BleAddressSniffer();
}
