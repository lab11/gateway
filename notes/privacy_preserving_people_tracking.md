Privacy Preserving People Tracking
==================================

We want to be able to track the short-term (maximum of 1 hour or so) movements
of people in a city. One way to do this is to track BLE devices by watching for
the same BLE MAC address to show up nearby multiple gateways. However,
simply recording MAC address exposes a host of privacy concerns.


Goals
----

Enable short-term people tracking while ensuring people remain anonymous.


Requirements
------------

1. Do NOT allow long-term longitudinal tracking of any person (even an anonymous person).
2. Identifying a person (associating a BLE MAC address with a specific person)
should not allow historical tracking of that person from the historical dataset.
3. If a person leaves the monitored area and then returns, there should be
no way to associate the new movement trace with the old one.



Techniques
----------

There are two main technique distinctions:

1. Protocols that assume gateways have a secure and possibly reliable connection
with other gateways.
2. Protocols which allow gateways to operate entirely independently.

### Securely Connected Gateways

In this scheme gateways can coordinate to ensure that devices are tracked reliably
while ensuring that the requirements are met.

Two preliminary ideas:

1. When a gateway first sees a new BLE address it asks all nearby gateways
if they have seen the same device. If none has, the gateway creates a random
ID for the device and emits that ID to the BLE scan dataset. If a nearby
gateway has seen the device, it shares the random ID with the new gateway.
Each random ID is given a lifetime to ensure that it changes overtime, preventing
long-term tracking.
2. Each gateway hashes the received BLE MAC address with a salt and emits
that ID. Each gateway has a copy of all of the salts, and the salts are changed
periodically.

The major downside to this technique is it assume secure and likely reliable
communication between gateways, and that certain information is kept
protected and secret. This burden on gateways may inhibit the practical
deployability of the system.


### Independent Gateways

In this scheme gateways operate independently and operate only
on local state.

In the first version of this, each gateway publishes all BLE devices that
it sees.
To allow for anonymity, only a hashed version of BLE MAC addresses
is emitted. To prevent against a rainbow table attack (where a user
hashes all 48 bit MAC addresses and compares that again the dataset),
the hash function is designed to ensure a sufficient number of collisions.
This adds ambiguity to the dataset, as simply hashing a known MAC address
does not guarantee that a trace in the dataset matches the known device.

The downside to this approach, however, is that peoples' movements over time
likely form a pattern when observed over a week or a month. Even if the same
hashed value appears in multiple places at once, when observed over time,
it is likely the same hashed value will appear in places at regular times.
Then, if a person can be identified to have a device that hashes to that value
and is at one of places at the predicted time, it is likely that one could
monitor that person's historical movements.

To make this type of tracking much more difficult, the hash function could
change in a defined fashion over time (for example every hour). This would
significantly obscure any patterns. The issue with changing hash functions
is it aids tracking specific people if you have a known BLE MAC address.
For example, imagine you learn that person `X` has a device with BLE MAC address
`Y`. At time interval `t1` you hash `Y` with the `t1` hash function and find
that there is a match in locations `A`, `B`, and `C`. Then you wait until
time interval `t2`. You again hash `Y` with the `t2` hash function and find
that the gateways found a match in locations `B`, `D`, `E`. Now you can
reasonably conclude that the person `X` was in location `B` during `t1` and `t2`.
Without the changing hash function you could only narrow it down to
locations `A`, `B`, or `C`.

#### Two-level proposal

This proposal would create a two-tiered dataset. The first tier would be the output
of the constant but collision prone hash function. This dataset would only
be available to "trusted" applications that we verified to be at least not
looking for patterns or otherwise overtly subverting user privacy.
This dataset would then be post-processed to add more randomness with the
addresses and then be made public.

#### Unexplored idea

Another crazy idea is a hash function that adjusts based on device
density. If there are very few devices near a gateway, they get hashed
into one of two bins: left and right. As the number of devices grows so
does the number of bins. Each bin is divided in half. For example, in the two
bin case, call the bins `A` and `B`. When more devices appear, each bin is
split in half into `A1, A2` and `B1, B2`. The one property that holds of the
hash function is that if a device hashed into bin `A` in the low density case,
it will hash into `A1` or `A2` in the higher density case.

This may provide some interesting properties, but we haven't explored it fully.



