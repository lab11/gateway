
// Main place to store cached items in memory.
var _cache = {};

// How long to keep things in the cache in ms.
var CACHE_TIMEOUT = 5*60*1000;

var _cache_file_entry;

function cache_load_from_file (cb) {
	// Open file from phone OS
	// If it doesnt exist, create an empty JSON blob and save it

	// Interpret the contents as JSON and update _cache_cache.

	window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fs) {

		function read_file (fileEntry, done) {
		    fileEntry.file(function (file) {
		        var reader = new FileReader();

		        reader.onloadend = function() {
		            console.log("Successful file read: ");
		            done(this.result);
		        };

		        reader.readAsText(file);

		    }, function () {
		    	console.log('Error reading file');
		    });
		}

	    console.log('file system open: ' + fs.name);
	    fs.root.getFile("ble-gateway-cache.json", { create: true, exclusive: false }, function (fileEntry) {

	    	_cache_file_entry = fileEntry;

	        console.log("fileEntry is file?" + fileEntry.isFile.toString());
	        // fileEntry.name == 'someFile.txt'
	        // fileEntry.fullPath == '/someFile.txt'
	        read_file(fileEntry, function (blob) {
	        	if (blob.length > 0) {
	        		_cache = JSON.parse(blob);
	        		console.log('read back cache as ');
	        		for (var key in _cache) {
	        			console.log('CACHE   ' + key + ' [' + _cache[key][0] + ', ' + _cache[key][1].substr(0, 50).replace(/\n/g, '') + ']');
	        		}
	        	}
	        	cb();
	        });

	    }, function (err) {
	    	console.log('Error creating file')
	    	console.log(err);
	    });

	}, function () {
		console.log('Error loading filesystem');
	});
}

function cache_store (key, value) {
	_cache[key] = [Date.now(), value];

	var to_store = JSON.stringify(_cache);

	// write `to_store` to the file.
    _cache_file_entry.createWriter(function (fileWriter) {

        fileWriter.onwriteend = function() {
            // console.log("Successful file write...");
            // readFile(fileEntry);
        };

        fileWriter.onerror = function (e) {
            console.log("Failed file write: " + e.toString());
        };

        fileWriter.write(new Blob([JSON.stringify(_cache)], { type: 'text/plain' }));
    });
}

function cache_load (key, enforce_timeout) {
	var now = Date.now();

	if (!(key in _cache)) {
		return null;
	}

	// If we want to timeout this record, then check if it's too old.
	if (enforce_timeout && (now - _cache[key][0] > CACHE_TIMEOUT)) {
		return null;
	}

	return _cache[key][1];
}
