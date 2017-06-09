function buf2id (buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join(':');
}

var app = {

    // Global state for which gateway was selected
    _selected_gateway_data: {
        gateway_id: '',
        ble_address: '',
    },

    // _last_connected_device: '',

    // // Application Constructor
    // initialize: function() {
    //     document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    // },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    // onDeviceReady: function() {
    // ready: function() {
    //     // this.receivedEvent('deviceready');

    //     // ble.startScan([], this.onBleAdvertisement.bind(this), this.bleScanError.bind(this));

    //     // $(document).delegate("#gateways", "pageshow", function() {
    //     //     console.log("Hello world!");
    //     // });

    //     console.log('yeah!')


    // },

    ready: function () {
        document.addEventListener("pause", app.pause, false);
        document.addEventListener("resume", app.resume, false);

    },

    pause: function () {
        console.log('pause')
        ble.stopScan();

        if (app._selected_gateway_data.ble_address.length) {
            ble.disconnect(app._selected_gateway_data.ble_address, app.bleDisconnect);
        }
    },

    resume: function () {
        var active_page = $.mobile.activePage.attr('id');
        console.log('Resume on page: ' + active_page);

        if (app._selected_gateway_data.ble_address.length) {
            // There was a gateway connected before, bring that back.
            ble.connect(app._selected_gateway_data.ble_address, app.bleConnect, app.bleConnectFailure);
        }

        if (active_page == 'gateways') {
            // Want to scan for gateways.

            // Delete any found gateways because they will need to be rediscovered
            $('.discovered-gateway').remove();

            ble.startScan([], app.onBleAdvertisement, app.bleScanError);
        }
    },

    onBleAdvertisement: function (device) {
        console.log(device.id);

        if (device.name == 'triumvi_gateway') {
            console.log(JSON.stringify(device));

            app.displayDiscoveredGateway(device);
        }
    },

    bleScanError: function (err) {
        console.log('BLE SCANNING ERROR');
        console.log(err);
    },

    displayDiscoveredGateway: function (device) {
        console.log('found gateway');

        var ble_address = device.id;
        // Replace the BLE identifier half byte with a 0 to get gateway id.
        var gateway_id = device.id.substring(0, 12) + '0' + device.id.substring(13)

        // var p = document.createElement("p");
        // p.innerHTML = "Gateway: " + device.id;
        // document.getElementById("gateways").appendChild(p);


        var item = '<li class="discovered-gateway">\
                      <a href="#gateway" class="a-gateway" data-gateway-id="'+gateway_id+'" data-ble-address="'+ble_address+'">\
                        <h2>Triumvi Gateway</h2>\
                        <p>'+gateway_id+'</p>\
                      </a>\
                    </li>';

        $("#gateway-list").append(item);
        $("#gateway-list").listview('refresh');
    },

    displayDiscoveredTriumvi: function (buf) {
        // var data = new Uint8Array(buf);
        // var addr = data.slice(0, 8);

        // console.log(typeof buf);
        // console.log(buf.byteLength);

        // Each returned buffer can be a group of multiple records.
        // Iterate through all records.
        for (i=0; i<buf.byteLength; i+=14) {
            var record = buf.slice(i, i+14);


            var id = buf2id(record.slice(0, 8));
            var idnocolon = id.replace(/:/g, '');

            var panel_circuit = new Uint8Array(record.slice(8, 10));
            var panel = panel_circuit[0];
            var circuit = panel_circuit[1];

            var power = new Uint32Array(record.slice(10, 14))[0];


            console.log(id + ' = panel:' + panel + ' circuit:' + circuit + ' power:' + power);


            // console.log(id);
            // console.log(idnocolon);


            if ($('#triumvi-' + idnocolon).length) {
                // Already exists
                // console.log('already exists')
                $('#triumvi-' + idnocolon + ' .panel').text(panel);
                $('#triumvi-' + idnocolon + ' .circuit').text(circuit);
                $('#triumvi-' + idnocolon + ' .power').text(power);
                $('#triumvi-' + idnocolon + ' time').timeago('update', new Date());
            } else {
                // New, add it

                var item = '<li id="triumvi-'+idnocolon+'" class="triumvi">\
                              <a href="#">\
                                <h2>Triumvi '+id+'</h2>\
                                <p>Panel: <span class="panel">'+panel+'</span>; Circuit: <span class="circuit">'+circuit+'</span></p>\
                                <div class="ui-li-aside">\
                                  <h3><span class="power">'+power+'</span> W</h3>\
                                  <p>Updated <time>just now</time></p>\
                                </div>\
                              </a>\
                            </li>';

                $("#triumvi-list").append(item);
                $('#triumvi-' + idnocolon + ' time').timeago('init');
                $('#triumvi-' + idnocolon + ' time').timeago('update', new Date());
                $("#triumvi-list").listview('refresh');
            }
        }
    },

    stopBleScan: function () {
        ble.stopScan(this.bleStopScanSuccess.bind(this), this.bleStopScanError.bind(this))
    },

    bleStopScanSuccess: function () {

    },

    bleStopScanError: function (err) {
        console.log('BLE STOP SCAN ERROR');
        console.log(err);
    },

    bleConnect: function (device) {
        console.log('connected')

        // Mark as connected in the UI
        $(".gateway-bleconnected").text('Yes');

        // app._last_connected_device = device.id;


        console.log(JSON.stringify(device));

        ble.startNotification(device.id,
                              '774a035e-b8d2-4f0c-9d32-47901afef8e0',
                              '774a035e-b8d2-4f0c-9d32-47901afef8e1',
                              app.bleNotify,
                              app.bleNotifyFailure);
        // ble.read(device.id, '774a035e-b8d2-4f0c-9d32-47901afef8e0', '774a035e-b8d2-4f0c-9d32-47901afef8e1', app.bleRead, app.bleReadFailure);

        // "{"name":"triumvi_gateway",
        // "id":"C0:98:E5:C0:50:36",
        // "advertising":{},
        // "rssi":-67,
        // "services":["1800","1801","774a035e-b8d2-4f0c-9d32-47901afef8e0"],
        // "characteristics":[{"service":"1800","characteristic":"2a00","properties":["Read"]},
        // {"service":"1800","characteristic":"2a01","properties":["Read"]},
        // {"service":"1801","characteristic":"2a05","properties":["Indicate"],"descriptors":[{"uuid":"2902"}]},
        // {"service":"774a035e-b8d2-4f0c-9d32-47901afef8e0","characteristic":"774a035e-b8d2-4f0c-9d32-47901afef8e1","properties":["Read","Notify"],"descriptors":[{"uuid":"2902"}]}]}
        // ", source: file:///android_asset/www/js/index.js (87)

    },

    bleConnectFailure: function (err) {
        console.log('CONNECT ERROR');
        console.log(err);
        console.log(JSON.stringify(err));

        // Mark not connected
        $(".gateway-bleconnected").text('No');

        // "{"name":"triumvi_gateway","id":"C0:98:E5:C0:50:36","errorMessage":"Peripheral Disconnected"}"

        // check if errorMessage is Peripheral Disconnected
        // then reconnect
        if (err && err.errorMessage == 'Peripheral Disconnected') {
            console.log('Unwanted disconnect, try again.');
            ble.connect(err.id, app.bleConnect, app.bleConnectFailure);
        }
    },

    bleDisconnect: function (device) {
        console.log('disconnected')

        // Mark not connected
        $(".gateway-bleconnected").text('No');

        // if (app._last_connected_device != '') {
        //     ble.disconnect(app._last_connected_device, app.bleDisconnect, app.bleDisconnectFailure);
        // }

        // app._last_connected_device = '';
    },

    bleRead: function (value) {
        // console.log('value');
        // console.log(value);

        app.displayDiscoveredTriumvi(value);
    },

    bleReadFailure: function (err) {
        console.log('ERROR READING CHARACTERISTIC');
    },

    bleNotify: function (value) {
        // console.log('notify value');
        // console.log(value);
        ble.read(app._selected_gateway_data.ble_address,
                 '774a035e-b8d2-4f0c-9d32-47901afef8e0',
                 '774a035e-b8d2-4f0c-9d32-47901afef8e1',
                 app.bleRead,
                 app.bleReadFailure);
    },

    bleNotifyFailure: function (err) {
        console.log('ERROR NOTIFY');
    }


    // // Update DOM on a Received Event
    // receivedEvent: function(id) {
    //     var parentElement = document.getElementById(id);
    //     var listeningElement = parentElement.querySelector('.listening');
    //     var receivedElement = parentElement.querySelector('.received');

    //     listeningElement.setAttribute('style', 'display:none;');
    //     receivedElement.setAttribute('style', 'display:block;');

    //     console.log('Received Event: ' + id);
    // }
};







// Gateway is selected from the list of gateways
$(document).on('click', '.a-gateway', function() {
    // var gateway_id = $(this).attr('data-gateway-id');
    // var ble_address = $(this).attr('data-ble-address');

    console.log('CLICK')

    // Save
    app._selected_gateway_data.gateway_id = $(this).attr('data-gateway-id');
    app._selected_gateway_data.ble_address = $(this).attr('data-ble-address');

    // // Update the ID on the view page
    // $("#gateway .gateway-id").text(gateway_id);

    // // We no longer need to scan for BLE advertisements
    // app.stopBleScan();

    // // We do want to connect to the gateway to get its triumvi data
    // ble.connect(ble_address, app.bleConnect, app.bleConnectFailure);
});

$(document).on('pagebeforeshow', '#gateways', function (event, ui) {
    console.log('>> BEFORE SHOW MAIN')

    // Delete any found gateways because they will need to be rediscovered
    $('.discovered-gateway').remove();

    ble.startScan([], app.onBleAdvertisement, app.bleScanError);

    // app.displayDiscoveredGateway({id:'c0:98:e5:c0:00:98'})
});

$(document).on('pagebeforehide', '#gateways', function (event, ui) {
    console.log('>> BEFORE HIDE MAIN')

    // When we leave the main page, we want to stop scanning.
    app.stopBleScan();
});

// Called when loading page to get detailed view of a gateway
$(document).on('pagebeforeshow', '#gateway', function (event, ui) {
    console.log('>> BEFORE SHOW')

    console.log(app._selected_gateway_data)
    console.log(app._selected_gateway_data.gateway_id)
    console.log(app._selected_gateway_data.ble_address)

    // Remove any existing Triumvis to not confuse things.
    $('.triumvi').remove();

    // Update the ID on the view page
    ui.toPage.find('.gateway-id').text(app._selected_gateway_data.gateway_id);

    // We do want to connect to the gateway to get its triumvi data
    ble.connect(app._selected_gateway_data.ble_address, app.bleConnect, app.bleConnectFailure);
});

$(document).on('pagebeforehide', '#gateway', function (event, ui) {
    console.log('>> BEFORE HIDE GATEWAY')
    console.log(app._selected_gateway_data.ble_address)

    // When we leave a gateway id page we want to disconnect from it
    console.log('disconnect');
    ble.disconnect(app._selected_gateway_data.ble_address, app.bleDisconnect);

    // Clear state so we know we aren't on this page anymore.
    app._selected_gateway_data.gateway_id = '';
    app._selected_gateway_data.ble_address = '';

});



document.addEventListener('backbutton', function(e) {
    console.log('back button');
    // console.log($.mobile.activePage.is('#gateways'));
    // console.log($.mobile.activePage);
    // console.log(JSON.stringify($.mobile.activePage));
    // console.log($(document).pagecontainer('getActivePage'));
    // if ($.mobile.activePage.is('#gateways')) {
    //     // Event preventDefault/stopPropagation not required as adding backbutton
    //     // listener itself override the default behaviour. Refer below PhoneGap link.
    //     navigator.app.exitApp();
    // } else {
    //     // navigator.app.backHistory()
        window.history.back();
    // }
}, false);



