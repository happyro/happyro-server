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
  console.log(`\n${color('1;36', 'HappyRO deletion command fence regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/admin-delete-control.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/admin-delete-control.test.mjs /tmp/happyro-delete-control-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fence = readFileSync(resolve(root, 'src/map/admin_delete.cpp'), 'utf8').replace(/^#include.*$/gm, '');
  const control = readFileSync(resolve(root, 'src/map/game_control.cpp'), 'utf8');
  const start = control.indexOf('} else if (map_session_data* sd = map_charid2sd(char_id);');
  const end = control.indexOf('} else if (command_type == "character.appearance.update")', start);
  if (start < 0 || end < 0) throw new Error('Cannot locate production character admission checks');
  const admission = '\nvoid command(int32 char_id, int& status, nlohmann::json& result) { if (false) {\n'
    + control.slice(start, end) + '} else { ++mutations; status = 200; } }\n';
  const code = readFileSync(resolve(root, 'tests/admin-delete-control-stubs.hpp'), 'utf8')
    + fence + admission + readFileSync(resolve(root, 'tests/admin-delete-control-cases.hpp'), 'utf8');
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-I', resolve(root, '3rdparty/json/include'), '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
