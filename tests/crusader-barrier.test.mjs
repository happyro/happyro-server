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
  console.log(`\n${color('1;36', 'HappyRO Crusader barrier regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/crusader-barrier.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/crusader-barrier.test.mjs /tmp/happyro-crusader-barrier-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const status = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
  const battle = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const between = (source, first, last, from = 0) => {
    const start = source.indexOf(first, from), end = source.indexOf(last, start);
    if (start < 0 || end < 0) throw new Error(`Missing production code: ${first}`);
    return source.slice(start, end);
  };
  const guardian = between(status, 'case SC_GUARDIAN_S:', 'case SC_REBOUND_S:');
  const impact = between(battle, 'if ((sce = sc->getSCE(SC_GUARDIAN_S)) && damage > 0)', '// Weapon Blocking');
  const timerStart = status.indexOf('case SC_INSPIRATION:', status.indexOf('TIMER_FUNC(status_change_timer)'));
  if (timerStart < 0) throw new Error('Missing status timer');
  const inspiration = between(status, 'case SC_INSPIRATION:', 'case SC_SHIELDSPELL_HP:', timerStart);
  const shieldHp = between(status, 'case SC_SHIELDSPELL_HP:', 'case SC_SHIELDSPELL_SP:', timerStart);
  const shieldSp = between(status, 'case SC_SHIELDSPELL_SP:', 'case SC_TROPIC:', timerStart);
  const sacrifice = battle.match(/status_zap\(src, [^;]+;\/\/Damage to self is always 9%/)?.[0];
  if (!sacrifice) throw new Error('Missing production Sacrifice HP cost');
  const ultimateSource = readFileSync(resolve(root, 'src/map/skills/swordman/ultimatesacrifice.cpp'), 'utf8');
  const ultimateStart = ultimateSource.indexOf('void SkillUltimateSacrifice::castendNoDamageId');
  if (ultimateStart < 0) throw new Error('Missing Ultimate Sacrifice method');
  const ultimate = ultimateSource.slice(ultimateStart);
  const statusDb = readFileSync(resolve(root, 'db/re/status.yml'), 'utf8');
  const stanceEntry = between(statusDb, '  - Status: Attack_Stance\n', '  - Status: Guardian_S\n');
  const stanceFlags = between(stanceEntry, '    CalcFlags:', '    Flags:');
  const patkFunction = between(status, 'static int16 status_calc_patk(block_list *bl', '/**', status.indexOf('static int16 status_calc_patk(block_list *bl'));
  const smatkFunction = between(status, 'static int16 status_calc_smatk(block_list *bl', '/**', status.indexOf('static int16 status_calc_smatk(block_list *bl'));
  const modifiers = [...new Set((patkFunction + smatkFunction).match(/SC_[A-Z_]+/g))];
  const stanceFunctions = (patkFunction + smatkFunction).replaceAll('status_change', 'StanceChanges');
  const code = `
#include <algorithm>
#include <cassert>
#include <climits>
#include <cstdint>
#include <iostream>
using int32=int32_t; using int64=int64_t; using uint32=uint32_t;
using std::min; using std::max;
int64 cap_value(int64 n,int64 lo,int64 hi) { return std::clamp(n,lo,hi); }
enum { SC_GUARDIAN_S=1, SC_INSPIRATION, SC_SHIELDSPELL_HP, SC_SHIELDSPELL_SP, BF_WEAPON=32, EF_GUARD3=1, AREA=0 };
struct State { int val1=5,val2=100,val4=3; };
struct Status { uint32 hp=1,sp=1,max_hp=1000,max_sp=1000; int sta=100; };
struct Changes { State value; bool active=true; State* getSCE(int) { return active ? &value : nullptr; } };
void clif_specialeffect(Changes*,int,int) {}
void status_change_end(Changes* target,int) { target->active=false; }
int64 healhp=0,healsp=0,chargehp=0,chargesp=0;
void status_heal(Status*,int hp,int sp,int) { healhp=hp; healsp=sp; }
bool status_charge(Status*,int64 hp,int64 sp) { chargehp=hp; chargesp=sp; return true; }
void sc_timer_next(int64) {}
int shield_capacity(Status* status,int val1) {
 int val2=0; switch(SC_GUARDIAN_S) { ${guardian} } return val2;
}
int64 damage_after(Changes& changes,int64 damage,int flag) {
 auto* sc=&changes; auto* target=&changes; State* sce=nullptr;
 ${impact}
 return damage;
}
int timer(Status* status,State* sce,int type) {
 auto* bl=status; int64 tick=1000;
 switch(type) { ${inspiration} ${shieldHp} ${shieldSp} }
 return 0;
}
int64 sacrifice_cost(uint32 hp) {
 Status data; data.max_hp=hp; auto* sstatus=&data; auto* src=&data; int64 cost=0;
 auto status_zap=[&](Status*,int64 value,int) { cost=value; };
 ${sacrifice}
 return cost;
}
using uint16=uint16_t; using t_tick=int64;
struct block_list { int hp=1000,marks=0; };
struct map_session_data : block_list { struct { int party_id=0; } status; };
#define BL_CAST(kind,ptr) static_cast<map_session_data*>(ptr)
constexpr int BL_PC=1,BCT_PARTY=256,skill_area_sub=1,skill_castend_nodamage_id=1;
int skill_get_sc(int) { return 1; } int skill_get_time(int,int) { return 30000; } int skill_get_splash(int,int) { return 9; }
void status_set_hp(block_list* b,int hp,int) { b->hp=hp; }
bool sc_start(block_list*,block_list* target,int,int,int,int) { target->marks++; return true; }
void clif_skill_nodamage(block_list*,block_list&,int,int,bool) {}
map_session_data companion;
void party_foreachsamemap(int,map_session_data*,int,block_list*,int,uint16,int64,int,int);
struct SkillUltimateSacrifice { int getSkillId() const { return 5261; } void castendNoDamageId(block_list*,block_list*,uint16,int64,int32&) const; };
${ultimate}
void party_foreachsamemap(int,map_session_data* sd,int,block_list* src,int,uint16 lv,int64 tick,int flag,int) {
 SkillUltimateSacrifice{}.castendNoDamageId(src,sd,lv,tick,flag);
 SkillUltimateSacrifice{}.castendNoDamageId(src,&companion,lv,tick,flag);
}
using int16=int16_t;
enum { ${modifiers.join(',')} };
struct StanceEntry { int val2=0,val3=15; };
struct StanceChanges {
 bool active=true; StanceEntry value;
 bool empty() { return !active; }
 StanceEntry* getSCE(int type) { return active && type==SC_ATTACK_STANCE ? &value : nullptr; }
};
${stanceFunctions}
void stance_cases() {
 block_list actor; StanceChanges stance;
 int patk=20,smatk=30;
 for (bool active : {true,false,true,false}) {
  stance.active=active;
  if (${/      Patk: true/.test(stanceFlags)}) patk=status_calc_patk(&actor,&stance,20);
  if (${/      Smatk: true/.test(stanceFlags)}) smatk=status_calc_smatk(&actor,&stance,30);
  assert(patk==20+(active?15:0));
  assert(smatk==30+(active?15:0));
 }
}
void ultimate_cases() {
 map_session_data solo,party; int32 flag=0;
 SkillUltimateSacrifice{}.castendNoDamageId(&solo,&solo,5,0,flag);
 assert(solo.hp==1 && solo.marks==1);
 party.status.party_id=1;
 SkillUltimateSacrifice{}.castendNoDamageId(&party,&party,5,0,flag);
 assert(party.hp==1 && party.marks==1);
 assert(companion.hp==1000 && companion.marks==1);
}
int main() {
 ultimate_cases();
 stance_cases();
 assert(sacrifice_cost(1000)==90);
 assert(sacrifice_cost(1000000000)==90000000);
 assert(sacrifice_cost(UINT_MAX)==386547056);
 Status status;
 assert(shield_capacity(&status,1)==1575);
 status.max_hp=2000000000; status.sta=32767;
 assert(shield_capacity(&status,5)==750491505);
 status.max_hp=UINT_MAX;
 assert(shield_capacity(&status,5)==1611104240);
 for(int64 damage : {int64(1),int64(100),int64(101),int64(INT_MAX),int64(INT_MAX)+5000,int64(10000000000)}) {
  Changes physical,magic;
  assert(damage_after(physical,damage,BF_WEAPON)==max<int64>(damage-100,0));
  assert(physical.active==(damage<100));
  assert(damage_after(magic,damage,0)==damage);
  assert(magic.active==(damage<100));
 }
 Changes repeated;
 assert(damage_after(repeated,60,BF_WEAPON)==0 && repeated.value.val2==40);
 assert(damage_after(repeated,60,BF_WEAPON)==20 && !repeated.active);
 State state; status.max_hp=2000000000; status.max_sp=UINT_MAX;
 state.val2=5; timer(&status,&state,SC_SHIELDSPELL_HP); assert(healhp==100000000);
 state.val2=3; timer(&status,&state,SC_SHIELDSPELL_SP); assert(healsp==128849018);
 state.val1=1; timer(&status,&state,SC_INSPIRATION); assert(chargehp==60000000 && chargesp==171798691);
 state.val1=5; timer(&status,&state,SC_INSPIRATION); assert(chargehp==20000000 && chargesp==85899345);
 std::cout << "Crusader barrier capacity, overflow damage and periodic resources passed\\n";
}
`;
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', resolve(output)], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.error?.message || 'C++ build failed');
  const run = spawnSync(resolve(output), [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
