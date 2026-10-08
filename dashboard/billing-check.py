#!/usr/bin/python3
import json
import socket
import time

with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
    client.settimeout(290)
    for attempt in range(20):
        try:
            client.connect('/run/vw-dashboard/broker.sock')
            break
        except (FileNotFoundError, ConnectionRefusedError):
            if attempt == 19:raise
            time.sleep(0.5)
    client.sendall(b'{"op":"billing_sync"}\n')
    result = b''
    while not result.endswith(b'\n'):
        block = client.recv(65536)
        if not block:
            raise RuntimeError('Broker disconnected')
        result += block
        if len(result) > 4_000_000:
            raise RuntimeError('Oversized response')
    report = json.loads(result)
    if not report.get('ok') or report.get('data', {}).get('error'):
        raise RuntimeError('Fakturor synchronization failed; hosting unchanged')
    print('Fakturor synchronized; hosting unchanged (monitoring only)')
