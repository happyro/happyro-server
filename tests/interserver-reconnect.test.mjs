import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO interserver reconnect regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/interserver-reconnect.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/interserver-reconnect.test.mjs ../../work/diagnostics/interserver-reconnect-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const read = path => readFileSync(resolve(root, path), 'utf8');
  function between(file, start, end) {
    const source = read(file);
    const begin = source.indexOf(start);
    const finish = source.indexOf(end, begin + start.length);
    if (begin < 0 || finish < 0) throw new Error(`Cannot locate ${start}`);
    return source.slice(begin + start.length, finish);
  }
  function block(file, start) {
    const source = read(file);
    const begin = source.indexOf(start);
    if (begin < 0) throw new Error(`Cannot locate ${start}`);
    let depth = 0;
    for (let i = source.indexOf('{', begin); i < source.length; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}' && --depth === 0) return source.slice(begin, i + 1);
    }
    throw new Error(`Unclosed block ${start}`);
  }
  const code = read('tests/interserver-reconnect-stubs.hpp')
    + block('src/map/chrif.cpp', 'int32 chrif_setip(')
    + '\n' + block('src/map/chrif.cpp', 'static TIMER_FUNC(check_connect_char_server){')
    + '\n' + block('src/char/char_logif.cpp', 'TIMER_FUNC(chlogif_check_connect_logserver){')
    + '\nvoid configure_map(const char* w2) {\n'
    + between('src/map/map.cpp', 'else if (strcmpi(w1, "char_ip") == 0) {', '\n\t\t}') + '\n}\n'
    + '\nvoid configure_char(const char* w2) {\n'
    + between('src/char/char.cpp', '} else if (strcmpi(w1, "login_ip") == 0) {', '} else if') + '\n}\n'
    + '\nvoid autodetect_char() {\n'
    + block('src/char/char.cpp', '\tif ((naddr_ != 0) &&') + '\n}\n'
    + read('tests/interserver-reconnect-cases.hpp');
  const output = resolve(options[0]);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(`${output}.cpp`, code);
  const build = spawnSync('c++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', `${output}.cpp`, '-o', output], { stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(output, [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
