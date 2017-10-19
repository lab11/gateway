Create New Edison Gateway Image
===============================

This folder contains all of the scripts and configuration needed to build
an edison image from scratch for a gateway.


Prereqs
-------

    sudo apt install gcc-5 debootstrap gcc-5-multilib g++-5-multilib

Run
---

    sudo ./make_edison_debian_image.sh --version 2.2.0 --umich
