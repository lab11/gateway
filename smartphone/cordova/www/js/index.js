
var app = {
    // Application Constructor
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {

        // Start scanning for BLE packets
        evothings.ble.startScan(app.on_discover, app.on_scan_error);



    },

    on_discover: function (device) {
        console.log("Got packet");
        console.log(device);
    },

    on_scan_error: function (error_code) {
        console.log("SCAN ERROR " + error_code);
    },
};

app.initialize();