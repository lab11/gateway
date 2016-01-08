import asyncio
import json


class Recv:

    def connection_made (self, transport):
        pass

    def datagram_received (self, data, addr):
        adv_obj = json.loads(data.decode())
        print(adv_obj)

    def error_received (self, exc):
        print('Error received:', exc)

    def connection_lost (self, exc):
        print('closing transport', exc)
        loop = asyncio.get_event_loop()
        loop.stop()


loop = asyncio.get_event_loop()
loop.create_task(loop.create_datagram_endpoint(Recv, local_addr=('255.255.255.255', 3002)))
loop.run_forever()
