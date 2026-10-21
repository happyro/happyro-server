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
  console.log(`\n${color('1;36', 'HappyRO parent cleanup regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/parent-cleanup.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/parent-cleanup.test.mjs /tmp/happyro-delete-control-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const character = readFileSync(resolve(root, 'src/char/char.cpp'), 'utf8');
  const map = readFileSync(resolve(root, 'src/map/chrif.cpp'), 'utf8');
  const extract = (source, start, end) => {
    const begin = source.indexOf(start);
    const finish = source.indexOf(end, begin);
    if (begin < 0 || finish < 0) throw new Error('Missing production parent helper');
    return source.slice(begin, finish);
  };
  const code = readFileSync(resolve(root, 'tests/parent-cleanup-stubs.hpp'), 'utf8')
    + extract(character, 'static bool char_validate_parent_links(', 'int32 char_mmo_char_tosql(')
    + extract(map, 'static int32 chrif_parent_removed(', 'int32 chrif_deadopt(')
    + readFileSync(resolve(root, 'tests/parent-cleanup-cases.hpp'), 'utf8');
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-I', resolve(root, '3rdparty/json/include'), '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
