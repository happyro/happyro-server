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
  console.log(`\n${color('1;36', 'HappyRO Tetra Vortex packet regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/tetra-packet.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/tetra-packet.test.mjs /tmp/happyro-tetra-packet-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const attack = source.indexOf('int64 skill_attack (');
  const start = source.indexOf('case WL_TETRAVORTEX_FIRE:', attack);
  const end = source.indexOf('break;', start);
  if (start < 0 || end < 0) throw new Error('Missing production Tetra Vortex packet branch');
  const branch = source.slice(start, end + 6);
  const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
constexpr int WL_TETRAVORTEX_FIRE = 2218, WL_TETRAVORTEX_WIND = 2220, DMG_SPLASH = 6;
struct Entity { int id; };
struct Damage { int amotion = 200, dmotion = 100, div_ = 1; };
int sent_skill = 0;
void clif_skill_damage(Entity& src, Entity& dst, int64_t tick, int attack, int defense, int64_t damage, int count, int skill, int level, int type) {
 sent_skill = skill;
 assert(src.id == 7 && dst.id == 8 && tick == 1000);
 assert(attack == 200 && defense == 100 && damage == 123456 && count == 1);
 assert(level == -1 && type == DMG_SPLASH);
}
int main() {
 Entity caster{7}, victim{8}; auto* dsrc = &caster; auto* bl = &victim;
 Damage dmg; int64_t tick = 1000, damage = 123456; int skill_id = WL_TETRAVORTEX_FIRE;
 switch(skill_id) { ${branch} }
 assert(sent_skill == WL_TETRAVORTEX_FIRE);
 std::cout << "Tetra Vortex fire packet regression passed\\n";
}
`;
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
