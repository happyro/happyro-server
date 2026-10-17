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
  console.log(`\n${color('1;36', 'HappyRO Spellbook regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/spellbook.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/spellbook.test.mjs /tmp/happyro-spellbook-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const skill = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const start = skill.indexOf('\tuint16 points = spell->points;', skill.indexOf('void skill_spellbook('));
  const end = skill.indexOf('\n\tif (sc && sc->getSCE(SC_FREEZE_SP)) {', start);
  if (start < 0 || end < 0) throw new Error('Missing production spellbook capacity check');
  const capacity = skill.slice(start, end);
  const releaseSource = readFileSync(resolve(root, 'src/map/skills/mage/release.cpp'), 'utf8');
  const release = releaseSource.slice(releaseSource.indexOf('void SkillRelease::castendDamageId'));
  const code = `
#include <algorithm>
#include <cassert>
#include <cstdint>
#include <cstdlib>
#include <map>
#include <iostream>
#define RENEWAL
using int32 = int32_t; using int64 = int64_t; using uint16 = uint16_t; using t_tick = int64;
using sc_type = int;
constexpr int SC_FREEZE_SP = 1, SC_SPELLBOOK1 = 10, SC_MAXSPELLBOOK = 16, SC_SPHERE_1 = 20, SC_SPHERE_5 = 24;
constexpr int WL_FREEZE_SP = 1, WL_READING_SB = 2, WL_RELEASE = 3, WLS_FIRE = 68;
constexpr int USESKILL_FAIL_SPELLBOOK = 51, USESKILL_FAIL_SPELLBOOK_PRESERVATION_POINT = 53;
constexpr int CAST_GROUND = 0, CAST_NODAMAGE = 1, CAST_DAMAGE = 2, EFST_POSTDELAY = 0, BF_MAGIC = 0, SD_LEVEL = 0, BL_PC = 0;
struct State { int val1 = 0, val2 = 0, val3 = 0; };
struct status_change { std::map<int, State> values; State* getSCE(int k) { return values.count(k) ? &values.at(k) : nullptr; } };
struct block_list { int x = 0, y = 0, id = 1; };
struct map_session_data : block_list {
 struct { int base_level = 100; } status;
 struct { int64 canact_tick = 0; } ud;
 int intelligence = 100, freeze_level = 0;
 status_change changes;
};
#define BL_CAST(type, ptr) static_cast<map_session_data*>(ptr)
int failure = 0, consumed = 0, casts = 0; bool allowed = true;
status_change* status_get_sc(block_list* b) { return &static_cast<map_session_data*>(b)->changes; }
int pc_checkskill(map_session_data* p, int) { return p->freeze_level; }
int status_get_int(map_session_data* p) { return p->intelligence; }
void clif_skill_fail(map_session_data&, int, int reason) { failure = reason; }
void status_change_end(block_list* p, int k) { status_get_sc(p)->values.erase(k); }
bool skill_check_condition_castbegin(map_session_data&, int, int) { if (!allowed) failure = 99; return allowed; }
void skill_consume_requirement(map_session_data*, int, int, int) { consumed++; }
int skill_get_casttype(int) { return CAST_DAMAGE; }
void skill_castend_pos2(block_list*,int,int,int,int,int64,int) { casts++; }
void skill_castend_nodamage_id(block_list*,block_list*,int,int,int64,int) { casts++; }
void skill_castend_damage_id(block_list*,block_list*,int,int,int64,int) { casts++; }
int skill_delayfix(block_list*,int,int) { return 0; }
int64 i64max(int64 a,int64 b) { return std::max(a,b); }
void clif_status_change(block_list*,int,int,int,int,int,int) {}
int pc_get_skillcooldown(map_session_data*,int,int) { return 0; }
void skill_blockpc_start(map_session_data&,int,int) {}
int status_get_adelay(block_list*) { return 100; }
void skill_addtimerskill(block_list*,int64,int,int,int,int,int,int,int) {}
void clif_skill_nodamage(block_list*,block_list&,int,int) {}
struct SkillRelease { int getSkillId() const { return WL_RELEASE; } void castendDamageId(block_list*,block_list*,uint16,int64,int32&) const; };
${release}
void can_preserve(map_session_data& sd, int points_needed, bool& result) {
 struct Book { uint16 points; } book{static_cast<uint16>(points_needed)};
 auto* spell = &book; auto* sc = &sd.changes;
 ${capacity}
 result = true;
}
void capacity_case(int existing, int points, bool expected) {
 map_session_data sd;
 if (existing) sd.changes.values[SC_FREEZE_SP].val2 = existing;
 failure = 0; bool ok = false; can_preserve(sd, points, ok);
 assert(ok == expected);
 assert(failure == (expected ? 0 : USESKILL_FAIL_SPELLBOOK_PRESERVATION_POINT));
}
int main() {
 capacity_case(0, 20, true); capacity_case(0, 21, false);
 capacity_case(10, 10, true); capacity_case(10, 11, false);
 map_session_data sd, target; int32 flag = 0;
 sd.changes.values[SC_FREEZE_SP].val2 = 20;
 sd.changes.values[SC_MAXSPELLBOOK] = {123, 5, 20};
 allowed = false;
 SkillRelease{}.castendDamageId(&sd, &target, 1, 0, flag);
 assert(sd.changes.getSCE(SC_MAXSPELLBOOK));
 assert(sd.changes.getSCE(SC_FREEZE_SP)->val2 == 20);
 assert(consumed == 0 && casts == 0 && failure == 99);
 allowed = true; failure = 0;
 SkillRelease{}.castendDamageId(&sd, &target, 1, 0, flag);
 assert(!sd.changes.getSCE(SC_MAXSPELLBOOK) && !sd.changes.getSCE(SC_FREEZE_SP));
 assert(consumed == 1 && casts == 1);
 failure = 0;
 SkillRelease{}.castendDamageId(&sd, &target, 1, 0, flag);
 assert(failure == USESKILL_FAIL_SPELLBOOK);
 std::cout << "Spellbook capacity and failed-release regression cases passed\\n";
}
`;
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
