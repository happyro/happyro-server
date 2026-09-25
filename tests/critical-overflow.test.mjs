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
  console.log(`\n${color('1;36', 'HappyRO critical overflow regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/critical-overflow.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/critical-overflow.test.mjs /tmp/happyro-critical-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const status = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
  const battle = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const katar = status.match(/if \(sd\) \{\s*if \(sd->status.weapon == W_KATAR\)[\s\S]*?\n\t\t\}/)?.[0];
  const modifiers = battle.match(/int(?:16|32) cri = sstatus->cri;[\s\S]*?(?=\n\t\tswitch\(skill_id\))/)?.[0];
  if (!katar || !modifiers) throw new Error('Cannot locate production critical calculations');
  const code = `
#include <algorithm>
#include <cassert>
#include <climits>
#include <cstdint>
#include <iostream>
using int16 = int16_t;
using int32 = int32_t;
using std::min;
int cap_value(int value, int low, int high) { return std::clamp(value, low, high); }
constexpr int W_KATAR = 1, RC_ALL = 1, SC_CAMOUFLAGE = 1, SC_SLEEP = 2;
struct Status { int16 cri; uint16_t luk = 0; int race = 0; };
struct Player {
  struct { int weapon; } status;
  struct { int critaddrace[2] = {}; } indexed_bonus;
  struct { int arrow_cri = 0, critical_rangeatk = 0; } bonus;
};
struct Effect { int val3 = 10; };
struct Changes {
  bool sleeping = false;
  Effect effect;
  Effect* getSCE(int kind) { return sleeping && kind == SC_SLEEP ? &effect : nullptr; }
};
bool is_skill_using_arrow(void*, int) { return false; }
int weapon_critical(int initial, Player* sd) {
  Status data{static_cast<int16>(initial)};
  auto* status = &data;
  ${katar}
  return status->cri;
}
int attack_critical(int initial, int target_luk, int bonus, bool sleep) {
  Status attacker{static_cast<int16>(initial)}, target{0, static_cast<uint16_t>(target_luk)};
  auto* sstatus = &attacker;
  auto* tstatus = &target;
  Player player{};
  player.indexed_bonus.critaddrace[0] = bonus;
  auto* sd = &player;
  Player* tsd = nullptr;
  Changes effects{sleep};
  Changes* sc = nullptr;
  auto* tsc = &effects;
  void* src = nullptr;
  int skill_id = 0;
  ${modifiers}
  return cri;
}
int main() {
  Player bare{}, katar{{W_KATAR}};
  assert(weapon_critical(100, &bare) == 100);
  assert(weapon_critical(100, &katar) == 200);
  assert(weapon_critical(16383, &katar) == 32766);
  for (int value : {16384, 32676, 32767}) {
    assert(weapon_critical(value, &katar) == SHRT_MAX);
    assert(weapon_critical(value, &bare) == value);
    assert(weapon_critical(value, nullptr) == value);
  }
  assert(attack_critical(200, 10, 30, false) == 210);
  assert(attack_critical(SHRT_MAX, 10, 100, false) == 32847);
  assert(attack_critical(SHRT_MAX, 10, 0, true) == 65494);
  assert(attack_critical(100, 32676, 0, false) == -65252);
  std::cout << "Critical overflow regression cases passed\\n";
}
`;
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
