

var PacketsPerSecond = function () {
	this._window = 60*1000; // 60 seconds
	this._timestamps = {};
};

PacketsPerSecond.prototype.add = function (category) {
	var now = new Date();

	if (!(category in this._timestamps)) {
		this._timestamps[category] = [];
	}

	this._timestamps[category].push(now);
	this._prune(category);
}

PacketsPerSecond.prototype.rate = function (category) {
	if (!(category in this._timestamps) || this._timestamps[category].length == 0) {
		return 0;
	}

	// Prune to make sure our calculation works
	this._prune(category);

	// Now calculate packets per second
	return this._timestamps[category].length / 60;
}

// Strip down category to just recent packets
PacketsPerSecond.prototype._prune = function (category) {
	var timestamps = this._timestamps[category];
	var now = new Date();

	while (true && timestamps.length > 0) {
		if (now - timestamps[0] > this._window) {
			timestamps.shift();
		} else {
			break;
		}
	}
}

module.exports = new PacketsPerSecond();
