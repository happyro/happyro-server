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
  console.log(`\n${color('1;36', 'HappyRO Epiclesis regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/epiclesis.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/epiclesis.test.mjs /tmp/happyro-epiclesis-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const methodStart = source.indexOf('int32 skill_unit_onplace_timer(');
  const start = source.indexOf('\t\tcase UNT_EPICLESIS:', methodStart);
  const end = source.indexOf('\n\t\tcase UNT_DIMENSIONDOOR:', start);
  if (methodStart < 0 || start < 0 || end < 0) throw new Error('Missing production Epiclesis timer');
  const code = `
#include <algorithm>
#include <cassert>
#include <climits>
#include <cstdint>
#include <map>
#include <vector>
#include <iostream>
using int32=int32_t; using int64=int64_t; using t_tick=int64_t;
enum { UNT_EPICLESIS=1, BL_PC, BL_MOB, RC_DEMON, RC_UNDEAD, SC_AKAITSUKI, SC_HIDING, SC_CLOAKING, SC_CLOAKINGEXCEED, SC_CAMOUFLAGE, SC_NEWMOON, SC__SHADOWFORM, AL_HEAL, MG_SRECOVERY };
struct State { int val1=1; };
struct status_change { std::map<int,State> entries; State* getSCE(int id) { return entries.count(id) ? &entries.at(id) : nullptr; } };
struct status_data { int race=0,def_ele=0; uint32_t hp=1,sp=1,max_hp=1000,max_sp=500; };
struct block_list { int type=BL_PC; status_data status; status_change changes; int heals=0,reveals=0,last_hp=0,last_sp=0,buffs=0; t_tick next=0; };
struct Group { t_tick tick=10000; int interval=1000,skill_lv=5,val1=0; };
int64 cap_value(int64 v,int64 lo,int64 hi) { return std::clamp(v,lo,hi); }
#define DIFF_TICK(a,b) ((a)-(b))
bool battle_check_undead(int race,int) { return race==RC_UNDEAD; }
void clif_skill_nodamage(block_list*,block_list&,int,int) {}
void status_heal(block_list* bl,int hp,int sp,int) { bl->heals++; bl->last_hp=hp; bl->last_sp=sp; }
void status_change_end(block_list* bl,int type) { if(type==SC_HIDING) bl->reveals++; bl->changes.entries.erase(type); }
int rnd() { return 0; }
void sc_start(block_list*,block_list* bl,int,int,int,int) { bl->buffs++; }
void pulse(Group& field,block_list& target,t_tick tick) {
 // Model the per-target 1000 ms gate surrounding the extracted switch arm.
 if(tick<target.next) return;
 target.next=tick+field.interval;
 auto* sg=&field; auto* bl=&target; auto* tstatus=&target.status; auto* tsc=&target.changes;
 block_list caster, ground; auto* ss=&caster; auto* unit=&ground; int type=0;
 switch(UNT_EPICLESIS) { ${source.slice(start,end)} }
}
void population_case(int population) {
 Group field; std::vector<block_list> players(population);
 for(int ms=0;ms<=15000;ms+=100) for(auto& player:players) pulse(field,player,field.tick+ms);
 for(auto& player:players) { assert(player.heals==5 && player.reveals==3); assert(player.last_hp==50 && player.last_sp==20); }
}
int main() {
 for(int count: {1,2,3,5,12}) population_case(count);
 Group field; block_list fixed,entrant,departing,monster,undead;
 monster.type=BL_MOB; undead.status.race=RC_UNDEAD;
 for(int ms=0;ms<=15000;ms+=100) {
  pulse(field,fixed,field.tick+ms);
  pulse(field,monster,field.tick+ms); pulse(field,undead,field.tick+ms);
  if(ms>=1500) pulse(field,entrant,field.tick+ms);
  if(ms<=3500 || ms>=8500) pulse(field,departing,field.tick+ms);
 }
 assert(fixed.heals==5 && fixed.reveals==3);
 assert(entrant.heals==4 && entrant.reveals==2);
 assert(departing.heals==3 && departing.reveals==1);
 assert(monster.heals==0 && undead.heals==0 && monster.buffs==0 && undead.buffs==0);
 block_list high; high.status.max_hp=2000000000; high.status.max_sp=UINT_MAX;
 pulse(field,high,field.tick+3000); assert(high.last_hp==100000000 && high.last_sp==171798691);
 high.changes.entries[SC_AKAITSUKI]={}; pulse(field,high,field.tick+6000); assert(high.last_hp==-100000000);
 std::cout << "Epiclesis population, arrival/departure and high HP/SP cases passed\\n";
}
`;
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', resolve(output)], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.error?.message || 'C++ build failed');
  const run = spawnSync(resolve(output), [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
