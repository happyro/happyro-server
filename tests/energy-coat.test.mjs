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
  console.log(`\n${color('1;36', 'HappyRO Energy Coat regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/energy-coat.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/energy-coat.test.mjs /tmp/happyro-energy-coat-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const start = source.indexOf('\t\t\tint32 per =', source.indexOf('if( tsc->getSCE(SC_ENERGYCOAT)'));
  const end = source.indexOf('\n\t\t}', start);
  if (start < 0 || end < 0) throw new Error('Missing production Energy Coat calculation');
  const formula = source.slice(start, end);
  const skill = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const reflectStart = skill.indexOf('int32 per =', skill.indexOf('if( tsc && tsc->getSCE(SC_ENERGYCOAT)'));
  const reflectEnd = skill.indexOf('\n\t\t\t\t}', reflectStart);
  if (reflectStart < 0 || reflectEnd < 0) throw new Error('Missing reflected-magic Energy Coat calculation');
  const reflection = skill.slice(reflectStart, reflectEnd);
  const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
using int32 = int32_t; using int64 = int64_t;
constexpr int SC_ENERGYCOAT = 1;
struct Status { uint32_t sp, max_sp; };
int64 charged; bool ended, can_charge;
bool status_charge(void*, int, int64 cost) { charged = cost; return can_charge; }
void status_change_end(void*, int) { ended = true; }
void check(uint32_t sp, uint32_t maximum, int64 cost, int64 expected_damage, bool enough = true) {
 Status data{sp, maximum}; auto* status = &data;
 int64 damage = 1000; void* bl = nullptr;
 charged = 0; ended = false; can_charge = enough;
 ${formula}
 assert(charged == cost); assert(damage == expected_damage); assert(ended == !enough);
 struct { int64 damage=1000; } dmg;
 charged=0;ended=false;
 {
 ${reflection}
 }
 damage=dmg.damage;
 assert(charged == cost); assert(damage == expected_damage); assert(ended == !enough);
}
int main() {
 check(0, 1000, 10, 940); check(200, 1000, 10, 940);
 check(209, 1000, 10, 940); check(210, 1000, 15, 880); check(800, 1000, 25, 760);
 check(809, 1000, 25, 760); check(810, 1000, 30, 700); check(1000, 1000, 30, 700);
 check(100000000, 100000000, 3000000, 700);
 check(4000000000U, 4000000000U, 120000000, 700);
 check(1000, 1000, 30, 700, false);
 std::cout << "Energy Coat SP boundary and overflow regression cases passed\\n";
}
`;
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
