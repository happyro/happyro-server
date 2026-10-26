import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO battle environment regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/battle-environment.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/battle-environment.test.mjs ../../work/battle-environment-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const start = source.indexOf('// Deployment overrides');
  const end = source.indexOf('/*=====================================\n * Read battle.conf', start);
  assert(start >= 0 && end > start);
  assert.match(source, /if \(count == 0\) \{\s*battle_apply_environment\(\);\s*battle_adjust_conf\(\);/);
  assert.match(source, /&battle_config.area_size,\s+14,/);
  assert.match(readFileSync(resolve(root, 'conf/battle/client.conf'), 'utf8'), /^area_size: 14$/m);
  const entries = [...source.slice(start, end).matchAll(/\{ "(HAPPYRO_[A-Z_]+)", "([a-z_]+)", &battle_config\.([a-z_]+), (\d+), (\d+|MAX_WALKPATH), (true|false) \}/g)];
  assert.equal(entries.length, 32);
  const extraFields = entries.slice(2).map(e => `int32 ${e[3]}=0;`).join(' ');
  const code = `#include <cerrno>\n#include <cstdlib>\n#include <cstring>\n#include <cstdio>\n#include <cstdint>\nusing int32 = int32_t;\n#define MAX_WALKPATH 32\n#define ShowError(...) fprintf(stderr, __VA_ARGS__)\n#define ShowInfo(...) fprintf(stderr, __VA_ARGS__)\nstruct { int32 area_size=23; int32 max_walk_path=16; ${extraFields} } battle_config;\n`
    + source.slice(start, end)
    + '\nint main(int argc, char** argv) { battle_apply_environment(); if(argc>1) { for(const auto& setting : battle_environment_settings) if(std::strcmp(argv[1],setting.name)==0) { printf("%d %s",*setting.value,battle_environment_override(setting.key) ? "locked" : "editable"); return 0; } return 2; } battle_config.area_size += 1; battle_apply_environment(); printf("%d %d", battle_config.area_size, battle_config.max_walk_path); }\n';
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-x', 'c++', '-', '-o', output], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const env = { ...process.env };
  for (const entry of entries) delete env[entry[1]];
  let count = 0;
  function check(values, expected) {
    const run = spawnSync(output, [], { env: { ...env, ...values }, encoding: 'utf8' });
    if (expected === null) { assert.notEqual(run.status, 0); assert.match(run.stderr, /must be (a decimal integer|true or false)/); }
    else { assert.equal(run.status, 0, run.stderr); assert.equal(run.stdout, expected); }
    count++;
  }
  check({}, '24 16'); // Without overrides, imported config survives both applications.
  check({ HAPPYRO_GAME_ENTITY_SYNC_RANGE_CELLS: '', HAPPYRO_GAME_MAX_WALK_PATH_CELLS: '' }, '24 16');
  for (const area of [5, 18, 20, 50]) for (const walk of [1, 17, 32])
    check({ HAPPYRO_GAME_ENTITY_SYNC_RANGE_CELLS: String(area), HAPPYRO_GAME_MAX_WALK_PATH_CELLS: String(walk) }, `${area} ${walk}`);
  for (const key of ['HAPPYRO_GAME_ENTITY_SYNC_RANGE_CELLS', 'HAPPYRO_GAME_MAX_WALK_PATH_CELLS'])
    for (const bad of ['0', '-1', '1.5', '+18', ' 18', '18 ', 'true', '18x', '9999999999999999999999999999']) check({ [key]: bad }, null);
  check({ HAPPYRO_GAME_ENTITY_SYNC_RANGE_CELLS: '4' }, null); check({ HAPPYRO_GAME_ENTITY_SYNC_RANGE_CELLS: '51' }, null);
  check({ HAPPYRO_GAME_MAX_WALK_PATH_CELLS: '33' }, null);
  for (const e of entries.slice(2)) {
    const name=e[1], min=Number(e[4]), max=Number(e[5]);
    for (const value of [min,max]) {
      const run=spawnSync(output,[name],{env:{...env,[name]:(e[6]==='true' ? String(Boolean(value)) : String(value))},encoding:'utf8'});
      assert.equal(run.status,0,run.stderr);assert.equal(run.stdout,`${value} locked`);count++;
    }
    const empty=spawnSync(output,[name],{env:{...env,[name]:''},encoding:'utf8'});
    assert.equal(empty.stdout,'0 editable');count++;
    for(const bad of [String(min-1),String(max+1),e[6]==='true'?'1':'true','1.5',' 1','99999999999999999999999']) check({[name]:bad},null);
  }
  console.log(`${count} battle environment cases passed (including repeated application)`);
}
