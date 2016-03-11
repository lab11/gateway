Gateway to Local Log File
=========================

Locally log files with collected gateway data. Files collect raw JSON objects
up to a maximum size, after which a new file is logged to and the old file is
compressed and numbered. Note that JSON is highly compressible. Typically 50 MB
log files compress to a 2.5 MB zipped file.

Configuration
-------------

You must tell this tool where to log files, the maximum file size before moving
to a new file and compressing the old one, and the maximum number of files to
keep before overwriting old ones. To do this, create
`/etc/swarm-gateway/log.conf` and add:

    log_file = <path to directory and name for log files>
    file_size = <maximum file size in bytes, can use k,m,g notation>
    num_files = <maximum number of log files>

Example:

    # /etc/swarm-gateway/log.conf
    log_file = /media/sdcard/gateway.log
    file_size = 50m
    num_files = 6000

