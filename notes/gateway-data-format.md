Gateway Data Format
===================

Our gateway is, at a high-level, providing a data stream of nearby
sensors to interested clients. One question this raises is:

> What format should the data stream be in?

If we expect many different applications to operate on the data stream,
there has to be some standardization of the data packets in the stream.
This raises another question:

> Who should do the data standardization?


### Method 1: Make the device do it

Ideally, devices would transmit data only in standard formats.
This would allow any listener (our gateway and others) to
use a standard mapping to understand what the device is
and what format the data is in.

This has been somewhat successful in Bluetooth Classic where devices
fulfill standard profiles based on their desired application. Many
brands of speakers manage to agree on a single "Audio Device" profile
and many brands of headset agree on a single "Headset" profile.

In BLE advertisements, this could be done using the UUID data
section. After specifying the relevant short UUID, the advertisement
could then contain packed data in a standard format.

The BLE profiles that exist today are insufficient to handle the variety
of IoT devices. Moreover, existing devices would have to be modified to 
make their data fit profiles rather than the manufacturer-specific formats
implemented today.

### Method 2: Make the gateway do it

If we assume devices are going to do whatever crazy thing that they
want, then the first receiver (the gateway) may be the best place to format
the data in some standard way. This requires something to specify
data formats/hierarchy, and raises a question:

> What data formats/structures/hierarchies are the correct ones?

Moreover, if you're making a brand-new device, how do you determine whether
you device fits with existing profiles? What if you have some of the data
for a profile, but not all of it? How do you enable a process for the creation
of new profiles that is quick enough to accomodate new designs, without
exploding into an enormous pile of mostly-redundant formats?

### Method 3: Make the applications do it

Applications get the data stream in a human readable but not necessarily
machine understood structure. The application programmer then customizes
the application logic to handle device packets from all understood devices.
While clumsy, it is certainly clear how to implement this.

The problem of course is that each application would have to handle each
possible device that it wants to work with. A power metering application would
have to handle both PowerBlade and Oort, and then wouldn't work with new device
X that comes out next year...

### Method 4: Make something between the gateway and application do it

The gateway's job may just be to get data from devices however it can.
Then something else can take the raw data and format it based on whatever
devices it knows about.

Imagine a MQTT service, where the raw data comes in, and the service
creates MQTT topics where each topic is a data type. If an application
wants, say, power data, it subscribes to only the `power_data` topic.

In practice, is this different than Method 2?


