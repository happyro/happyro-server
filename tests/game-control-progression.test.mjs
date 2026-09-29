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
  console.log(`\n${color('1;36', 'HappyRO progression regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/game-control-progression.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/game-control-progression.test.mjs /tmp/happyro-progression-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/game_control.cpp'), 'utf8');
  const helpers = source.slice(source.indexOf('bool payload_has_only_keys('), source.indexOf('uint32 max_job_level('));
  const marker = '} else if (command_type == "character.progression.update") {';
  const begin = source.indexOf(marker);
  const end = source.indexOf('} else if (command_type == "character.points.update")', begin);
  if (begin < 0 || end < 0) throw new Error('Cannot locate production progression command');
  const code = readFileSync(resolve(root, 'tests/game-control-progression-stubs.hpp'), 'utf8')
    + helpers + source.slice(source.indexOf('int32 minimum_base_level('), source.indexOf('\n}', source.indexOf('int32 normalize_base_level(')) + 2) + '\nvoid apply(map_session_data* sd, const nlohmann::json& body, int& status, nlohmann::json& result) {\n'
    + source.slice(begin + marker.length, end) + '}\n'
    + readFileSync(resolve(root, 'tests/game-control-progression-cases.hpp'), 'utf8');
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-I', resolve(root, '3rdparty/json/include'), '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
