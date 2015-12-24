Advertisement Parser
====================

This script:

1. Listens for Eddystone BLE advertisements.

2. Upon finding one, pulls out the URL and tries to fetch `<URL>/parse.js`.

3. If that exists, it uses the resulting JS file to parse other advertisements
the device sends in the future. The parsed advertisement comes in the form
of an object and is printed to stdout.




Usage
-----

```
npm install
./advertisement-parse.js
```
