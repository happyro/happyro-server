import net from 'node:net';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options.includes('--help')) {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO TCP frame smoke test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/stream-live.test.mjs --port <port>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/stream-live.test.mjs --port 5121 --no-color')}\n`);
} else {
  assert.equal(options.length, 2);
  assert.equal(options[0], '--port');
  const port = Number(options[1]);
  assert(Number.isInteger(port) && port > 0 && port < 65536);
  function packet(size) {
    const bytes = Buffer.alloc(size);
    bytes.writeUInt16LE(0xcfa, 0);
    bytes.writeUInt16LE(size, 2);
    return bytes;
  }
  async function probe(chunks, invalid = false) {
    const socket = net.connect(port, '127.0.0.1');
    socket.resume();
    let closed = false;
    let failure;
    socket.on('close', () => { closed = true; });
    socket.on('error', error => { failure = error; });
    try {
      await once(socket, 'connect');
      for (const chunk of chunks) {
        socket.write(chunk);
        await delay(30);
        if (!invalid) assert(!closed && !failure, 'Server rejected an incomplete legal frame');
      }
      await delay(100);
      if (invalid) {
        for (let attempt = 0; !closed && attempt < 30; attempt++) await delay(50);
        assert(closed, 'Server failed to reject an invalid frame');
      } else {
        assert(!closed && !failure, 'Server rejected a legal stream');
        // A known invalid opcode after the frames proves that parsing advanced
        // to the end, rather than simply leaving a stuck connection open.
        const ended = once(socket, 'close');
        socket.write(Buffer.from([0xff, 0xff]));
        const timeout = setTimeout(() => socket.destroy(new Error('Parser did not reach sentinel')), 5000);
        try { await ended; if (failure) throw failure; } finally { clearTimeout(timeout); }
      }
    } finally { socket.destroy(); }
  }
  // Unauthenticated valid packets are framed and skipped without gameplay.
  const chunks = [];
  for (const size of [898, 1210, 32768]) {
    const p = packet(size);
    for (const split of [1, 3, 838]) chunks.push(p.subarray(0, split), p.subarray(split));
  }
  chunks.push(Buffer.concat(Array.from({ length: 50 }, () => packet(898))));
  await probe(chunks);
  await probe([Buffer.from([0xfa, 0x0c, 3, 0])], true);
  console.log('Live map-server: partial headers/bodies, 32KB frames, coalescing and invalid lengths passed');
}
