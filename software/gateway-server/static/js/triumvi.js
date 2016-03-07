
var queryDict = {}
location.search.substr(1).split("&").forEach(function(item) {queryDict[item.split("=")[0]] = item.split("=")[1]});

var ws_host = queryDict.ws_host || window.location.hostname + ':3001';

var ws = new WebSocket('ws://' + ws_host);
ws.onopen = function() { };
ws.onclose = function() { };
ws.onmessage = function(event) {
    var data = JSON.parse(event.data);

    var device_type = data.device;

    // Filter for just triumvi packets
    if (device_type == 'Triumvi') {
        var panel_id = data['Panel ID'];
        var circuit_id = data['Circuit ID'];
        console.log(panel_id + ' ' + circuit_id);

        // Lookup the table for this meter and create it if it doesn't exist
        var table = $('#table-' + panel_id);
        if (table.length == 0) {
            console.log('no table')
            // Need to create a new table for this panel
            var new_table = '<table id="table-'+panel_id+'">';
            new_table += '<thead>';
            new_table += '<tr><td colspan="4">Panel ID: ' + panel_id + '</td></tr>';
            new_table += '</table>';
            $("#meters").append(new_table);
            table = $("#table-" + panel_id);
        }

        // Find the spot for this reading for the given breaker
        var cell = $('#panel-'+panel_id+'-cell-'+circuit_id);
        if (cell.length == 0) {
            // Have this panel, haven't created a cell for this breaker yet
            // console.log($('#table-' + panel_id + ' tr').length)
            var row_count = $('#table-' + panel_id + ' tr').length-1;
            console.log('rows: ' + row_count);

            var rows_required = Math.floor((circuit_id-1) / 2) + 1;
            console.log('rows_required: ' + rows_required)

            // Add all needed rows
            for (var i=row_count; i<rows_required; i++) {
                var new_row = '<tr>';
                new_row += '<td>' + ((i*2)+1) + '</td>';
                new_row += '<td id="panel-'+panel_id+'-cell-'+((i*2)+1)+'"></td>';
                new_row += '<td id="panel-'+panel_id+'-cell-'+((i*2)+2)+'"></td>';
                new_row += '<td>' + ((i*2)+2) + '</td>';
                new_row += '</tr>';
                table.append(new_row);
            }

            // Set this variable
            cell = $('#panel-'+panel_id+'-cell-'+circuit_id);
        }

        // Now update the cell with the value
        console.log(data.Power);
        cell.html(data.Power);
    }

};
