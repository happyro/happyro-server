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
  console.log(`\n${color('1;36', 'HappyRO Priest healing regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/priest-healing.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/priest-healing.test.mjs /tmp/happyro-priest-healing-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const skills = [ ['heal', 'SkillHeal'], ['highnessheal', 'SkillHighnessHeal'], ['coluceoheal', 'SkillColuceoHeal'], ['resurrection', 'SkillResurrection'], ['redemptio', 'SkillRedemptio'] ];
  const methods = skills.map(([file, name]) => {
    const source = readFileSync(resolve(root, `src/map/skills/acolyte/${file}.cpp`), 'utf8');
    const start = source.indexOf(`void ${name}::castendNoDamageId(`);
    const end = source.indexOf('\nvoid ', start + 1);
    if (start < 0) throw new Error(`Missing production method: ${name}`);
    return source.slice(start, end < 0 ? undefined : end);
  });
  const statusSource = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
  const renovatioStart = statusSource.indexOf('case SC_RENOVATIO:', statusSource.indexOf('case SC_RENOVATIO:') + 1);
  const renovatio = statusSource.slice(renovatioStart).match(/int32 heal = [^;]+;/)?.[0];
  if (!renovatio) throw new Error('Missing production Renovatio healing');
  const cures = ['laudaagnus', 'laudaramus'].map(file => {
    const source = readFileSync(resolve(root, `src/map/skills/acolyte/${file}.cpp`), 'utf8');
    const gate = source.match(/if\( rnd\(\)%100 [^\n]+return;/)?.[0];
    if (!gate) throw new Error(`Missing production cure chance: ${file}`);
    return `void ${file}(int roll, int skill_lv, int& successes) { auto rnd = [&]() { return roll; }; ${gate} successes++; }`;
  }).join('\n');
  const skillSource = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const partnerStart = skillSource.indexOf('case PR_BENEDICTIO: {', skillSource.indexOf('int32 skill_check_condition_char_sub'));
  const partnerEnd = skillSource.indexOf('case AB_ADORAMUS:', partnerStart);
  if (partnerStart < 0 || partnerEnd < 0) throw new Error('Missing Benedictio partner check');
  const partnerCheck = skillSource.slice(partnerStart, partnerEnd);
  const battleSource = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const turnUndead = battleSource.match(/i = 10 \* skill_lv \+ sstatus->luk[\s\S]*?;/)?.[0];
  if (!turnUndead) throw new Error('Missing production Turn Undead chance');
  const declarations = skills.map(([, name]) => `struct ${name} { int getSkillId() const { return 42; } void castendNoDamageId(block_list*, block_list*, uint16, t_tick, int32&) const; };`).join('\n');
  const code = `
#include <algorithm>
#include <cassert>
#include <climits>
#include <cstdint>
#include <map>
#include <vector>
#include <iostream>
#define RENEWAL
using int32 = int32_t; using int64 = int64_t; using uint16 = uint16_t; using t_tick = int64; using t_exp = uint64_t;
enum { BL_PC=1, BL_MOB, SC_KAITE, SC_BERSERK, SC_SATURDAYNIGHTFEVER, SC_AKAITSUKI, SC_BITESCAR, SC_HELLPOWER, MD_STATUSIMMUNE, MOBID_EMPERIUM, CLASS_BATTLEFIELD, AL_HEAL, ALL_RESURRECTION, MF_BATTLEGROUND, MF_PVP, BCT_PARTY=256 };
struct State { int val2=1; };
struct status_change { std::map<int,State> values; bool empty() { return values.empty(); } State* getSCE(int k) { return values.count(k) ? &values.at(k) : nullptr; } };
struct status_data { int race=0,def_ele=0; };
struct block_list { int type=BL_PC,m=0,hp=100; bool dead=false,revivable=true,immune=false; status_change changes; status_data data; };
struct map_session_data : block_list { struct { int party_id=0,base_level=100,job_level=50; t_exp base_exp=1000000,job_exp=1000000; } status; struct { bool restart_full_recover=false; } special_state; int pvp_point=0; };
struct mob_data : block_list { mob_data() { type=BL_MOB; } };
#define BL_CAST(kind, ptr) ((ptr)->type == kind ? static_cast<std::conditional_t<kind == BL_PC, map_session_data, mob_data>*>(ptr) : nullptr)
struct { int heal_exp=100,resurrection_exp=100; } battle_config;
int skill_area_temp[1], healed=0,failures=0,partycount=1,base_heal=1000;
t_exp base_award=0,job_award=0; block_list* healed_target=nullptr;
std::vector<block_list*> members;
status_change* status_get_sc(block_list* b) { return &b->changes; }
status_data* status_get_status_data(block_list& b) { return &b.data; }
int skill_calc_heal(block_list*,block_list*,int,int,bool) { return base_heal; }
bool status_isimmune(block_list* b) { return b->immune; }
int status_get_class(block_list*) { return 0; } int status_get_class_(block_list*) { return 0; }
bool status_has_mode(status_data*,int) { return false; }
void status_change_end(block_list* b,int k) { b->changes.values.erase(k); }
void clif_skill_nodamage(block_list*,block_list&,int,int) {}
int status_heal(block_list* b,int hp,int,int) { healed=hp; healed_target=b; return std::max(hp,0); }
void pc_gainexp(map_session_data*,block_list*,t_exp b,t_exp j,int) { base_award+=b;job_award+=j; }
void clif_skill_fail(map_session_data&,int) { failures++; }
bool map_flag_gvg2(int m) { return m==1; } bool map_getmapflag(int m,int f) { return m==f; }
bool status_isdead(block_list& b) { return b.dead; }
bool status_revive(block_list* b,int,int) { if(!b->dead || !b->revivable) return false; b->dead=false; return true; }
t_exp pc_nextbaseexp(map_session_data*) { return 1000000; } t_exp pc_nextjobexp(map_session_data*) { return 1000000; }
void status_set_hp(block_list* b,int hp,int) { b->hp=hp; }
bool battle_check_undead(int,int) { return false; } bool pc_ismadogear(map_session_data*) { return false; }
int pc_checkskill(map_session_data*,int) { return 10; } int skill_get_splash(int,int) { return 10; }
int64 cap_value(int64 value,int64 low,int64 high) { return std::clamp(value,low,high); }
constexpr int party_sub_count=1,skill_area_sub=2,skill_castend_nodamage_id=3;
int party_foreachsamemap(int,map_session_data*,int) { return partycount; }
int party_foreachsamemap(int,map_session_data*,int,block_list*,int,uint16,t_tick,int,int);
${declarations}
${methods.join('\n')}
int party_foreachsamemap(int,map_session_data*,int,block_list* src,int,uint16 level,t_tick tick,int flag,int) {
 for(auto* member:members) SkillRedemptio{}.castendNoDamageId(src,member,level,tick,flag);
 return members.size();
}
void reset() { healed=failures=0; base_award=job_award=0; healed_target=nullptr; base_heal=1000; }
template<class Skill> void healing_cases() {
 map_session_data caster,target; mob_data monster; int32 flag=0;
 reset(); Skill{}.castendNoDamageId(&caster,&target,10,0,flag);
 assert(healed==1000 && job_award==1000 && healed_target==&target);
 reset(); Skill{}.castendNoDamageId(&caster,&caster,10,0,flag); assert(job_award==0);
 reset(); Skill{}.castendNoDamageId(&caster,&monster,10,0,flag); assert(job_award==0);
 reset(); target.changes.values[SC_KAITE].val2=2; target.changes.values[SC_AKAITSUKI]={};
 Skill{}.castendNoDamageId(&caster,&target,10,0,flag);
 assert(healed_target==&caster && healed==1000 && job_award==0);
 reset(); target.changes.values.erase(SC_AKAITSUKI); caster.changes.values[SC_AKAITSUKI]={};
 Skill{}.castendNoDamageId(&caster,&target,10,0,flag); assert(healed==-1000 && healed_target==&caster);
}
template<class Skill> void resurrection_cases() {
 map_session_data caster,target; int32 flag=1;
 for(int base_level : {90,100,110}) {
  reset(); target.dead=true; target.status.base_level=base_level; target.status.job_level=55;
  Skill{}.castendNoDamageId(&caster,&target,4,0,flag);
  assert(!target.dead && job_award==500 && base_award==(base_level>100 ? 1000 : 0));
 }
 reset(); target.dead=true; target.status.base_level=110; target.status.job_level=45;
 Skill{}.castendNoDamageId(&caster,&target,4,0,flag); assert(job_award==0 && base_award==1000);
}
${cures}
int renovatio_heal(uint32_t hp,int level) {
 struct { uint32_t max_hp; } data{hp}; auto* status=&data;
 struct { int val1; } state{level}; auto* sce=&state;
 ${renovatio}
 return heal;
}
int benedictio_partner(int current_sp,int saved_sp,int caster_sp) {
 enum { PR_BENEDICTIO=1, MAPID_FIRSTMASK=255, MAPID_ACOLYTE=4 };
 struct Partner { int class_=4,id=10,x=0,y=0; struct { int sp; } status,battle_status; } caster,partner;
 auto* sd=&caster; auto* tsd=&partner; sd->status.sp=caster_sp; tsd->status.sp=saved_sp; tsd->battle_status.sp=current_sp;
 auto map_calc_dir=[](Partner*,int,int) { return 2; }; auto unit_getdir=[](Partner*) { return 0; };
 using uint8=uint8_t; int count=0; auto* c=&count; int p_sd[2]={};
 auto check=[&]() { switch(PR_BENEDICTIO) { ${partnerCheck} } return 0; };
 check(); return count;
}
int turn_undead_chance(uint32_t hp,uint32_t max_hp) {
 struct { int luk=10,int_=20; } source; auto* sstatus=&source; auto* src=&source;
 struct { uint32_t hp,max_hp; } target{hp,max_hp}; auto* tstatus=&target;
 auto status_get_lv=[](auto*) { return 100; }; int skill_lv=10,i=0;
 ${turnUndead}
 return i;
}
int main() {
 assert(turn_undead_chance(2000000000,2000000000)==230);
 assert(turn_undead_chance(1000000000,2000000000)==380);
 assert(turn_undead_chance(UINT_MAX,UINT_MAX)==230);
 assert(benedictio_partner(9,100,100)==0);
 assert(benedictio_partner(10,0,100)==1);
 assert(benedictio_partner(10,100,0)==1);
 assert(renovatio_heal(1000,1)==50);
 assert(renovatio_heal(2000000000,4)==160000000);
 assert(renovatio_heal(UINT_MAX,4)==343597383);
 for(int level=1;level<=4;level++) {
  int a=0,b=0;
  for(int roll=0;roll<100;roll++) { laudaagnus(roll,level,a); laudaramus(roll,level,b); }
  assert(a==60+10*level && b==a);
 }
 healing_cases<SkillHeal>(); healing_cases<SkillHighnessHeal>();
 resurrection_cases<SkillResurrection>(); resurrection_cases<SkillRedemptio>();
 map_session_data caster,target; int32 flag=1; caster.status.party_id=1;
 for(int count : {1,2,12}) {
  reset(); partycount=count; base_heal=INT_MAX;
  SkillColuceoHeal{}.castendNoDamageId(&caster,&target,3,0,flag); assert(healed==INT_MAX);
 }
 reset(); partycount=12; SkillColuceoHeal{}.castendNoDamageId(&caster,&target,3,0,flag); assert(healed==1300);
 map_session_data blocked,failed,valid; blocked.dead=failed.dead=valid.dead=true;
 blocked.changes.values[SC_HELLPOWER]={}; failed.revivable=false;
 members={&blocked,&failed}; flag=0; reset();
 SkillRedemptio{}.castendNoDamageId(&caster,&caster,1,0,flag);
 assert(skill_area_temp[0]==0 && caster.hp==100 && failures==1);
 members.push_back(&valid); reset();
 SkillRedemptio{}.castendNoDamageId(&caster,&caster,1,0,flag);
 assert(skill_area_temp[0]==1 && caster.hp==1 && !valid.dead && blocked.dead && failed.dead);
 std::cout << "Priest healing, reflection, experience and revival cases passed\\n";
}
`;
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', resolve(output)], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.error?.message || 'C++ build failed');
  const run = spawnSync(resolve(output), [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
