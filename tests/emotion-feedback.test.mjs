import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO emotion feedback regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/emotion-feedback.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/emotion-feedback.test.mjs ../../work/diagnostics/emotion-feedback-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  function extract(file, start, end) {
    const source = readFileSync(resolve(root, file), 'utf8');
    const begin = source.indexOf(start), finish = source.indexOf(end, begin);
    if (begin < 0 || finish < 0) throw new Error(`Cannot locate ${start}`);
    return source.slice(begin, finish);
  }
  const code = readFileSync(resolve(root, 'tests/emotion-feedback-stubs.hpp'), 'utf8')
    + extract('src/map/clif.cpp', 'void clif_parse_Emotion(', '/// Amount of currently online players')
    + readFileSync(resolve(root, 'tests/emotion-feedback-cases.hpp'), 'utf8');
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-x', 'c++', '-', '-o', output], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(output, [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
