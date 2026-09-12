import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
const output = options[0];
if (!output || output === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO stream parser regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/stream-parser.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/stream-parser.test.mjs /tmp/happyro-stream-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/clif.cpp'), 'utf8');
  const begin = source.indexOf('static int32 clif_parse(int32 fd)\n{');
  const end = source.indexOf('\nvoid packetdb_addpacket', begin);
  if (begin < 0 || end < 0) throw new Error('Cannot locate production parser');
  const code = readFileSync(resolve(root, 'tests/stream-parser-stubs.hpp'), 'utf8') + '\n' + source.slice(begin, end) + '\n' + readFileSync(resolve(root, 'tests/stream-parser-cases.hpp'), 'utf8');
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
