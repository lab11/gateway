
// Convert an ArrayBuffer to a Triumvi ID.
function buf2id (buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join(':');
}

var app = {

    // Global state for which gateway was selected
    _selected_gateway_data: {
        gateway_id: '',
        ble_address: '',
    },

    // Setup normal app style callbacks for mobile platforms.
    ready: function () {
        document.addEventListener("pause", app.pause, false);
        document.addEventListener("resume", app.resume, false);
    },

    // On pause basically end all BLE stuff.
    pause: function () {
        console.log('Pause.')
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
        console.log('Discovered BLE device: ' + device.id);

        // Looking for a very particular gateway type.
        if (device.name == 'triumvi_gateway') {
            app.displayDiscoveredGateway(device);
        }
    },

    bleScanError: function (err) {
        console.log('BLE SCANNING ERROR');
        console.log(err);
    },

    // Add a gateway to the list on the first page.
    displayDiscoveredGateway: function (device) {
        var ble_address = device.id;
        // Replace the BLE identifier half byte with a 0 to get gateway id.
        var gateway_id = device.id.substring(0, 12) + '0' + device.id.substring(13)

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

            if ($('#triumvi-' + idnocolon).length) {
                // Already exists
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

    bleStopScanSuccess: function () {
        console.log('Successfully stopped scanning.');
    },

    bleStopScanError: function (err) {
        console.log('BLE STOP SCAN ERROR');
        console.log(err);
    },

    bleConnect: function (device) {
        // Mark as connected in the UI
        $(".gateway-bleconnected").text('Yes');

        console.log(JSON.stringify(device));

        // Get notifications from the Triumvi BLE characteristic.
        ble.startNotification(device.id,
                              '774a035e-b8d2-4f0c-9d32-47901afef8e0',
                              '774a035e-b8d2-4f0c-9d32-47901afef8e1',
                              app.bleNotify,
                              app.bleNotifyFailure);
    },

    bleConnectFailure: function (err) {
        console.log('CONNECT ERROR');

        // Mark not connected
        $(".gateway-bleconnected").text('No');

        // Check if errorMessage is "Peripheral Disconnected", then reconnect.
        if (err && err.errorMessage == 'Peripheral Disconnected') {
            console.log('Unwanted disconnect, try again.');
            ble.connect(err.id, app.bleConnect, app.bleConnectFailure);
        }
    },

    bleDisconnect: function (device) {
        // Mark not connected
        $(".gateway-bleconnected").text('No');
    },

    bleRead: function (value) {
        app.displayDiscoveredTriumvi(value);
    },

    bleReadFailure: function (err) {
        console.log('ERROR READING CHARACTERISTIC');
    },

    bleNotify: function (value) {
        // Need to read to get the full characteristic.
        ble.read(app._selected_gateway_data.ble_address,
                 '774a035e-b8d2-4f0c-9d32-47901afef8e0',
                 '774a035e-b8d2-4f0c-9d32-47901afef8e1',
                 app.bleRead,
                 app.bleReadFailure);
    },

    bleNotifyFailure: function (err) {
        console.log('ERROR NOTIFY');
    }
};


// Gateway is selected from the list of gateways
$(document).on('click', '.a-gateway', function() {
    // Save which gateway we clicked on.
    app._selected_gateway_data.gateway_id = $(this).attr('data-gateway-id');
    app._selected_gateway_data.ble_address = $(this).attr('data-ble-address');
});

$(document).on('pagebeforeshow', '#gateways', function (event, ui) {
    // Delete any found gateways because they will need to be rediscovered
    $('.discovered-gateway').remove();

    ble.startScan([], app.onBleAdvertisement, app.bleScanError);
});

$(document).on('pagebeforehide', '#gateways', function (event, ui) {
    // When we leave the main page, we want to stop scanning.
    ble.stopScan(app.bleStopScanSuccess, app.bleStopScanError)
});

// Called when loading page to get detailed view of a gateway
$(document).on('pagebeforeshow', '#gateway', function (event, ui) {
    // Remove any existing Triumvis to not confuse things.
    $('.triumvi').remove();

    // Update the ID on the view page
    ui.toPage.find('.gateway-id').text(app._selected_gateway_data.gateway_id);

    // We do want to connect to the gateway to get its triumvi data
    ble.connect(app._selected_gateway_data.ble_address, app.bleConnect, app.bleConnectFailure);
});

$(document).on('pagebeforehide', '#gateway', function (event, ui) {
    // When we leave a gateway id page we want to disconnect from it
    ble.disconnect(app._selected_gateway_data.ble_address, app.bleDisconnect);

    // Clear state so we know we aren't on this page anymore.
    app._selected_gateway_data.gateway_id = '';
    app._selected_gateway_data.ble_address = '';

});

// Make back button work.
document.addEventListener('backbutton', function(e) {
    window.history.back();
}, false);
