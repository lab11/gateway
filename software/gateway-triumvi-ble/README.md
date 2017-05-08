Publish Triumvi on BLE
======================

This gateway module pulls Triumvi packets from MQTT and publishes
them as a BLE characteristic.

BLE Information
---------------

This service advertises using the name `triumvi_gateway`.

- Service ID: `774a035e-b8d2-4f0c-9d32-47901afef8e0`
  - Characteristic ID: `774a035e-b8d2-4f0c-9d32-47901afef8e1`

The characteristic can be subscribed to and will notify every second or
when the buffer fills up.

### Data Format

The characteristic holds packets in 14 byte chunks. There can be between
1 and 36 data packets in the characteristic.

Each packet:

```
 0 1 2 3 4 5 6 7 8 9 0 1 2 3
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Triumvi ID    |P|C|Power  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- **Triumvi ID**: Eight byte big-endian ID of the Triumvi that took the measurement.
Should start with `c098e55452a0`.
- **P**: One byte panel ID.
- **C**: One byte circuit ID.
- **Power**: Four byte little-endian signed power measurement.

To determine the number of contained data packets in the characteristic,
divide the length of the characteristic buffer by 14.
