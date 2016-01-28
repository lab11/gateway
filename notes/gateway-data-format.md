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

In BLE advertisements, this could be done using the UUID data
section. After specifying the relevant short UUID, the advertisement
could then contain packed data in a standard format.


### Method 2: Make the gateway do it

If we assume devices are going to do whatever crazy thing that they
want, then the first receiver (the gateway) may be the best place to format
the data in some standard way. This requires something to specify
data formats/hierarchy, and raises a question:

> What data formats/structures/hierarchies are the correct ones?


### Method 3: Make the applications do it

Applications get the data stream in a human readable but not necessarily
machine understood structure. The application programmer then customizes
the application logic to handle device packets from all understood devices.
While clumsy, it is certainly clear how to implement this.


### Method 4: Make something between the gateway and application do it

The gateway's job may just be to get data from devices however it can.
Then something else can take the raw data and format it based on whatever
devices it knows about.

Imagine a MQTT service, where the raw data comes in, and the service
creates MQTT topics where each topic is a data type. If an application
wants, say, power data, it subscribes to only the `power_data` topic.



