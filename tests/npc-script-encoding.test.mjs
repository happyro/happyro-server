import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const serverRoot = path.resolve(import.meta.dirname, '..');
test('all NPC scripts and server configurations are valid UTF-8', () => {
 const decoder = new TextDecoder('utf-8', { fatal: true });
 const invalid = [];
 let checked = 0;
 for (const directory of ['npc', 'conf']) {
 const root = path.join(serverRoot, directory);
 for (const name of fs.readdirSync(root, { recursive: true })) {
  if (!/\.(txt|conf)$/.test(name)) continue;
  checked++;
  try { decoder.decode(fs.readFileSync(path.join(root, name))); }
  catch { invalid.push(`${directory}/${name}`); }
 }
 }
 assert.ok(checked > 800);
 assert.deepEqual(invalid, [], 'Script source must not mix legacy bytes with UTF-8');
});

test('Thai messages retain Thai text even when legacy bytes form valid UTF-8', () => {
 const content = fs.readFileSync(path.join(serverRoot, 'conf/msg_conf/map_msg_tha.conf'), 'utf8');
 for (const message of ['22: Base level ลดลง.', '25: Job level ลดลง.', "53: สถานะของ '%s':"]) {
  assert.ok(content.split(/\r?\n/).includes(message), message);
 }
});
