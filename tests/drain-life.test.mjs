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
  console.log(`\n${color('1;36', 'HappyRO Drain Life regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/drain-life.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/drain-life.test.mjs /tmp/happyro-drain-life-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/skills/mage/drainlife.cpp'), 'utf8');
  const method = source.slice(source.indexOf('void SkillDrainLife::castendDamageId'));
  if (!method.startsWith('void ')) throw new Error('Missing production Drain Life handler');
  const code = `
#include <algorithm>
#include <cassert>
#include <climits>
#include <cstdint>
#include <iostream>
using int32 = int32_t; using int64 = int64_t; using uint16 = uint16_t; using t_tick = int64;
using std::max; using std::min;
struct block_list { int type = 0; };
constexpr int BL_SKILL = 1, AL_HEAL = 28;
int64 attack_damage, healed;
int32 notified; int rolls;
int skill_get_type(int) { return 0; }
int64 skill_attack(int, block_list*, block_list*, block_list*, int, uint16, t_tick, int32) { return attack_damage; }
int rnd() { return rolls; }
void status_heal(block_list*, int64 value, int, int) { healed = value; }
void clif_skill_nodamage(void*, block_list&, int, int32 value) { notified = value; }
struct SkillDrainLife {
 int getSkillId() const { return 2210; }
 void castendDamageId(block_list*, block_list*, uint16, t_tick, int32&) const;
};
${method}
void check(int64 damage, uint16 level, int32 expected, int type = 0, int roll = 0) {
 attack_damage = damage; healed = 0; notified = 0; rolls = roll;
 block_list src, dst{type}; int32 flag = 0;
 SkillDrainLife{}.castendDamageId(&src, &dst, level, 0, flag);
 assert(healed == expected); assert(notified == expected);
}
int main() {
 check(999, 1, 99); check(999, 5, 299);
 check(100000000, 5, 30000000); // Previously overflowed in the percentage multiplication.
 check(3000000000LL, 5, 900000000); // Previously narrowed before calculating healing.
 check(10000000000LL, 5, INT_MAX);
 check(INT64_MAX, 5, INT_MAX);
 check(0, 5, 0); check(-1, 5, 0);
 check(10000, 5, 0, BL_SKILL);
 check(10000, 1, 0, 0, 75); check(10000, 1, 1000, 0, 74);
 std::cout << "Drain Life healing regression cases passed\\n";
}
`;
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
