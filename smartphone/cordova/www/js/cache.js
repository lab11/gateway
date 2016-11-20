
// Main place to store cached items in memory.
var _cache = {};

// How long to keep things in the cache in ms.
var CACHE_TIMEOUT = 5*60*1000;

function cache_load_from_file () {
	// Open file from phone OS
	// If it doesnt exist, create an empty JSON blob and save it

	// Interpret the contents as JSON and update _cache_cache.
}

function cache_store (key, value) {
	_cache[key] = [new Date.now(), value];

	var to_store = JSON.stringify(_cache);

	// write `to_store` to the file.
}

function cache_load (key, enforce_timeout) {
	var now = new Date.now();

	if (!(key in _cache)) {
		return undefined;
	}

	// If we want to timeout this record, then check if it's too old.
	if (enforce_timeout && (now - _cache[key][0] > CACHE_TIMEOUT)) {
		return undefined;
	}

	return _cache[key][1];
}
