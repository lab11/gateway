SQLite Storage for Triumvi Data
===============================

This tool stores Triumvi data in a local SQLite database. Because
the columns must be fixed, we only try to do this for one data
stream (Triumvi).

Configuration
-------------

`/etc/swarm-gateway/triumvi-sqlite.conf`:

    database_file = /media/sdcard/triumvi.sqlite
