import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO Mechanic resource regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/mechanic-resources.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/mechanic-resources.test.mjs /tmp/mechanic-resources-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/skills/merchant/repair.cpp'), 'utf8');
  const method = source.slice(source.indexOf('void SkillRepair::castendNoDamageId'));
  if (!method.startsWith('void')) throw new Error('Missing repair method');
  const battle = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const start = battle.indexOf('case NC_SELFDESTRUCTION: {');
  const end = battle.indexOf('ATK_ADD(', start);
  if (start < 0 || end < 0) throw new Error('Missing self-destruction damage');
  const damage = battle.slice(battle.indexOf('{', start) + 1, end);
  const statusSource = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
  const abrStart = statusSource.indexOf('status->max_hp =', statusSource.indexOf('// Custom formulas for ABR'));
  const abrEnd = statusSource.indexOf('\n\t\t\t\t\t}', abrStart);
  if (abrStart < 0 || abrEnd < 0) throw new Error('Missing ABR stat calculations');
  const abr = statusSource.slice(abrStart, abrEnd);
  const cartSource = readFileSync(resolve(root, 'src/map/skills/merchant/carttermination.cpp'), 'utf8');
  const cartMatch = cartSource.match(/base_skillratio \+= (static_cast<int64>\(sd->cart_weight\)[^;]+);/);
  if (!cartMatch) throw new Error('Missing cart termination ratio');
  const skillSource = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const magmaMatch = skillSource.match(/case UNT_MAGMA_ERUPTION:([\s\S]*?)break;/);
  if (!magmaMatch) throw new Error('Missing magma periodic dispatch');
  const decoyStart = skillSource.indexOf('void skill_magicdecoy(');
  const decoy = skillSource.slice(decoyStart, skillSource.indexOf('/**', decoyStart));
  if (!decoy.startsWith('void')) throw new Error('Missing decoy method');
  const selectorStart = statusSource.indexOf('// Different levels of HP according to skill level');
  const selectorEnd = statusSource.indexOf('case AM_SPHEREMINE:', selectorStart);
  const selector = statusSource.slice(selectorStart, selectorEnd);
  const decoyStatsStart = statusSource.indexOf('case NC_MAGICDECOY:', selectorEnd);
  const decoyStatsEnd = statusSource.indexOf('case MT_SUMMON_ABR_BATTLE_WARIOR:', decoyStatsStart);
  const decoyStats = statusSource.slice(decoyStatsStart, decoyStatsEnd);
  if (selectorStart < 0 || decoyStatsStart < 0 || decoyStatsEnd < 0) throw new Error('Missing decoy stat path');
  const stealth = statusSource.match(/case SC_STEALTHFIELD_MASTER:\n\t\tif \(--\(sce->val4\) >= 0\) \{[\s\S]*?\n\t\tbreak;/)?.[0];
  if (!stealth) throw new Error('Missing stealth field timer');
  const summonFiles=['fawsilversniper','abrbattlewarior','abrdualcannon','abrmothernet','abrinfinity'];
  const summonMethods=summonFiles.map(file=>{
    const text=readFileSync(resolve(root, 'src/map/skills/merchant/'+file+'.cpp'),'utf8');
    const name=text.match(/void (Skill\w+)::castend/)[1];
    const id=text.match(/SkillImpl\((\w+)\)/)[1];
    const method=text.slice(text.indexOf('void '+name+'::castend'));
    return {name,id,method};
  });
  const silverStart=statusSource.indexOf('case NC_SILVERSNIPER:',selectorEnd);
  const abrCaseEnd=statusSource.indexOf('case BO_WOODENWARRIOR:',decoyStatsEnd);
  const summonStats=statusSource.slice(silverStart,abrCaseEnd);
  const code = `
#include <cassert>
#include <algorithm>
#include <cstdint>
#include <climits>
#include <iostream>
using int32=int32_t; using int64=int64_t; using uint16=uint16_t;using uint8=uint8_t; using t_tick=int64;
struct block_list { bool player=true; uint32_t max_hp=2000,sp=1000,hp=1000; int vit=100,level=100,healed=0; };
struct map_session_data : block_list { struct { uint32_t max_hp=1000; } status; bool mado=true; int failed=0; };
#define BL_CAST(kind,ptr) ((ptr)->player ? static_cast<map_session_data*>(ptr) : nullptr)
constexpr int BL_PC=1,USESKILL_FAIL_TOTARGET=1,NC_MAINFRAME=1;
uint32_t status_get_max_hp(block_list* b) { return b->max_hp; }
uint32_t status_get_sp(block_list* b) { return b->sp; }
int status_get_lv(block_list* b) { return b->level; }
bool pc_ismadogear(map_session_data* sd) { return sd->mado; }
int pc_checkskill(map_session_data*,int) { return 4; }
void clif_skill_fail(map_session_data& sd,int,int) { sd.failed++; }
void status_heal(block_list* b,int hp,int,int) { b->healed=hp; }
void clif_skill_nodamage(block_list*,block_list&,int,int,bool) {}
struct SkillRepair { int getSkillId() const { return 2275; } void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
${method}
int64 self_destruction(map_session_data* sd,int skill_lv) {
 auto* src=sd; auto* sstatus=sd;
 ${damage}
 return damagevalue;
}
constexpr int DEFTYPE_MIN=SHRT_MIN,DEFTYPE_MAX=SHRT_MAX,MT_SUMMON_ABR_INFINITY=1;
int64 cap_value(int64 n,int64 lo,int64 hi) { return std::clamp(n,lo,hi); }
struct AbrStats { int matk_min=0,matk_max=0; uint32_t max_hp=1; uint16_t vit=100,speed=150; int32 batk=100; int16_t def=100,mdef=100,hit=100,flee=100; struct { uint16_t atk=0,atk2=0; } rhw; };
AbrStats summon(AbrStats master,int abr_mastery,bool infinity) {
 AbrStats result; auto* status=&result; auto* mstatus=&master;
 struct { int skill_id; } unit{infinity?MT_SUMMON_ABR_INFINITY:0}; auto* ud=&unit;const int summon_skill_id=unit.skill_id;
 ${abr}
 return result;
}
void cart_cases() {
 struct { int cart_weight; } cart; auto* sd=&cart;
 struct { int max_cart_weight; } battle_config;
 for(int capacity : {80000,1000000,10000000}) {
  battle_config.max_cart_weight=capacity;
  for(int weight : {0,capacity/2,capacity}) {
   cart.cart_weight=weight;
   for(int level=1;level<=10;level++) {
    int i=10*(16-level);
    int ratio=${cartMatch[1]};
    assert(ratio==int64(weight)/i*80000/capacity-100);
   }
  }
 }
}
void abr_cases() {
 AbrStats master;
 auto normal=summon(master,1,false);
 assert(normal.max_hp==45000 && normal.rhw.atk==700 && normal.rhw.atk2==1000);
 assert(normal.def==120 && normal.mdef==104 && normal.hit==102 && normal.flee==110);
 auto infinity=summon(master,1,true);
 assert(infinity.max_hp==65000 && infinity.rhw.atk==2100 && infinity.rhw.atk2==3000);
 master.vit=32767; master.batk=INT_MAX; master.def=master.mdef=master.hit=master.flee=SHRT_MAX;
 for (bool infinite : {false,true}) {
  auto high=summon(master,10,infinite);
  assert(high.max_hp==int64(405000)*32767/100+(infinite?20000:0));
  assert(high.rhw.atk==USHRT_MAX && high.rhw.atk2==USHRT_MAX);
  assert(high.def==SHRT_MAX && high.mdef==SHRT_MAX && high.hit==SHRT_MAX && high.flee==SHRT_MAX);
 }
}
namespace decoy_test {
using t_itemid=uint32_t;
constexpr int NC_SILVERSNIPER=2281,MT_ABR_M=5301,MT_SUMMON_ABR_BATTLE_WARIOR=5302,MT_SUMMON_ABR_DUAL_CANNON=5303,MT_SUMMON_ABR_MOTHER_NET=5304,MT_SUMMON_ABR_INFINITY=5305;
constexpr int MOBID_SILVERSNIPER=20,MOBID_ABR_BATTLE_WARIOR=21,MOBID_ABR_DUAL_CANNON=22,MOBID_ABR_MOTHER_NET=23,MOBID_ABR_INFINITY=24,AI_ABR=2;
constexpr int IG_ELEMENT=1,LOG_TYPE_CONSUME=1,NC_MAGICDECOY=2282,SZ_SMALL=0,AI_NONE=0,AI_FAW=1,INVALID_TIMER=-1;
constexpr int ITEMID_SCARLET_PTS=1,ITEMID_INDIGO_PTS=2,ITEMID_YELLOW_WISH_PTS=3,ITEMID_LIME_GREEN_PTS=4;
constexpr int MOBID_MAGICDECOY_FIRE=10,MOBID_MAGICDECOY_WATER=11,MOBID_MAGICDECOY_WIND=12,MOBID_MAGICDECOY_EARTH=13;
struct unit_data { int skill_id=0,skill_lv=0; } unit;
struct map_session_data { bool player=true;unit_data ud;int x=7,y=8,hp=3000,vit=100,batk=100,def=100,mdef=100,hit=100,flee=100,speed=150;uint32_t sp=1000; int level=100,menuskill_id=NC_MAGICDECOY,menuskill_val=5,m=1,id=1,amount=2,failed=0,deletes=0; bool deletion_fails=false; struct { int comet_x=7,comet_y=8; } sc; struct { const char* name="test"; } status; };
using block_list=map_session_data;using TBL_PC=map_session_data;using status_data=map_session_data;
map_session_data* master=nullptr;
struct mob_data { AbrStats stats; int summon_skill_id=0,summon_skill_lv=0,master_id=0,deletetimer=-1,id=2; struct { int ai=0; } special_state; } mob;
int spawned=0,spawn_class=0;
struct { bool item_exists(int,int id) { return id>=1 && id<=5; } } itemdb_group;
int pc_search_inventory(map_session_data* sd,int) { return sd->amount>0 ? 0 : -1; }
int pc_delitem(map_session_data* sd,int,int amount,int,int,int) { sd->deletes++; if(sd->deletion_fails || sd->amount<amount) return 1; sd->amount-=amount; return 0; }
void clif_skill_fail(map_session_data& sd,int) { sd.failed++; }
mob_data* mob_once_spawn_sub(map_session_data* sd,int,int x,int y,const char*,int cls,const char*,int,int) { assert(x==7 && y==8); spawn_class=cls; master=sd; mob={}; return &mob; }
unit_data* unit_bl2ud(mob_data*) { return &unit; }
void mob_timer_delete() {}
void delete_timer(int,void(*)()) {}
int add_timer(int,void(*)(),int,int) { return 1; }
int gettick() { return 0; }
int skill_get_time(int,int) { return 1000; }
const char*status_get_name(map_session_data&){return "test";}
void clif_skill_nodamage(block_list*,block_list&,int,int){}
int skill_get_sc(int id){return id;}
void sc_start(block_list*,block_list*,int,int,int,int){}
int pc_checkskill(map_session_data*,int){return 1;}
status_data*status_get_status_data(map_session_data&sd){return &sd;}
int status_get_lv(map_session_data*sd){return sd->level;}
void calculate_stats(mob_data*md){
 auto*mbl=master;auto*ud=&master->ud;auto*status=&md->stats;
 ${selector}
 ${summonStats}
 }
}
void mob_spawn(mob_data*md) { spawned++; calculate_stats(md); }
${decoy}
${summonMethods.map(({name,id,method})=>`struct ${name}{int getSkillId()const{return ${id};}void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&)const;void castendPos2(block_list*,int32,int32,uint16,t_tick,int32&)const;};\n${method}`).join('\n')}
void summon_context_cases(){
 ${summonMethods.map(({name,id})=>`for(int level=1;level<=${id==='NC_SILVERSNIPER'?5:4};level++){
  map_session_data sd;sd.ud.skill_id=${id};sd.ud.skill_lv=level;int32 flags=0;
  ${name}{}.${id==='NC_SILVERSNIPER'?'castendPos2(&sd,7,8,level,0,flags)':'castendNoDamageId(&sd,&sd,level,0,flags)'};
  assert(mob.summon_skill_id==${id} && mob.summon_skill_lv==level);
  auto expected=mob.stats;
  assert(expected.max_hp==${id==='NC_SILVERSNIPER'?'1000*level+2200':id==='MT_SUMMON_ABR_INFINITY'?'65000':'45000'});
  sd.ud.skill_id=999;sd.ud.skill_lv=0;sd.menuskill_id=0;unit.skill_id=888;
  mob.stats={};calculate_stats(&mob);
  assert(mob.stats.max_hp==expected.max_hp && mob.stats.rhw.atk==expected.rhw.atk && mob.stats.batk==expected.batk);
 }`).join('\n')}
}
void run() {
 for(int id=1;id<=4;id++) for(int count : {1,2,10}) for(int level=1;level<=5;level++) for(uint32_t sp : {0u,1000u,1000000000u,UINT_MAX}) {
  map_session_data sd; sd.amount=count; sd.menuskill_val=level;sd.sp=sp;spawned=0;
  skill_magicdecoy(sd,id);
  assert(sd.deletes==1 && sd.amount==count-1 && sd.failed==0 && spawned==1);
  assert(sd.menuskill_val==0 && sd.sc.comet_x==0 && sd.sc.comet_y==0);
  const auto expected_hp=cap_value(1000LL*level+4LL*sp+1200,1,UINT_MAX);
  assert(mob.stats.max_hp==expected_hp && mob.stats.matk_min==250+50*level && mob.stats.matk_max==250+50*level);
  assert(spawn_class==id+9 && mob.summon_skill_id==NC_MAGICDECOY && mob.summon_skill_lv==level && mob.master_id==sd.id);
  assert(sd.ud.skill_id==0 && sd.ud.skill_lv==0);
  sd.ud.skill_id=999;sd.ud.skill_lv=10;sd.menuskill_val=7;unit.skill_id=999;
  mob.stats={};calculate_stats(&mob);
  assert(mob.stats.max_hp==expected_hp && mob.stats.matk_min==250+50*level && sd.ud.skill_id==999);
 }
 for(int id : {0,5,99}) {
  map_session_data sd; spawned=0;
  skill_magicdecoy(sd,id);
  assert(sd.deletes==0 && sd.amount==2 && sd.failed==1 && spawned==0);
 }
 for(bool failure : {false,true}) {
  map_session_data sd; sd.amount=failure?2:0; sd.deletion_fails=failure; spawned=0;
  skill_magicdecoy(sd,1);
  assert(sd.failed==1 && spawned==0 && sd.amount==(failure?2:0));
 }
 map_session_data sd; sd.menuskill_val=0; spawned=0;
 skill_magicdecoy(sd,1);
 assert(sd.deletes==0 && sd.failed==1 && spawned==0);
}
}
namespace magma_test {
constexpr int NC_MAGMA_ERUPTION=1, NPC_MAGMA_ERUPTION=2, NC_MAGMA_ERUPTION_DOTDAMAGE=3, NPC_MAGMA_ERUPTION_DOTDAMAGE=4;
int calls=0, last=0;
int skill_get_type(int id) { return id; }
void skill_attack(int,int,int,int,int id,int,int,int) { calls++; last=id; }
void run() {
 for(int parent : {NC_MAGMA_ERUPTION,NPC_MAGMA_ERUPTION}) {
  struct { int skill_id,skill_lv; } group{parent,5}; auto* sg=&group;
  int ss=1,unit=2,bl=3,tick=100; calls=0; last=0;
  ${magmaMatch[1]}
  assert(calls==1);
  assert(last==(parent==NC_MAGMA_ERUPTION?NC_MAGMA_ERUPTION_DOTDAMAGE:NPC_MAGMA_ERUPTION_DOTDAMAGE));
 }
}
}
namespace stealth_test {
constexpr int SC_STEALTHFIELD_MASTER=1;
struct Status{uint32_t max_sp;};struct Entry{int val4=1,val3=3000;};
int64 charged=0;bool enough=true;int next=0;
bool status_charge(int,int,int64 amount){charged=amount;return enough;}
void sc_timer_next(int tick){next=tick;}
int timer(Status*status,Entry*sce){int bl=1,tick=100;switch(SC_STEALTHFIELD_MASTER){${stealth}}return -1;}
void run(){
 for(uint32_t sp:{0u,1000u,1431655765u,1431655766u,2000000000u,UINT_MAX})for(bool funds:{false,true}){
  Status status{sp};Entry entry;charged=0;next=0;enough=funds;
  assert(timer(&status,&entry)==(funds?0:-1));assert(charged==int64(sp)*3/100);assert(next==(funds?3100:0));
 }
 Status status{1000};Entry entry;entry.val4=0;charged=0;assert(timer(&status,&entry)==-1 && charged==0);
}
}
int main() {
 decoy_test::run();
 decoy_test::summon_context_cases();
 stealth_test::run();
 magma_test::run();
 abr_cases();
 cart_cases();
 int32 flags=0; map_session_data caster,target;
 int rates[]={4,7,13,17,23};
 for (uint32_t maxhp : {uint32_t(500),uint32_t(2000),uint32_t(1000000000),UINT_MAX}) {
  target.max_hp=maxhp;
  for(int lv=1;lv<=5;lv++) {
   SkillRepair{}.castendNoDamageId(&caster,&target,lv,0,flags);
   assert(target.healed==int64(maxhp)*rates[lv-1]/100);
  }
 }
 target.healed=0; target.mado=false;
 SkillRepair{}.castendNoDamageId(&caster,&target,5,0,flags);
 assert(caster.failed==1 && target.healed==0);
 target.player=false;
 SkillRepair{}.castendNoDamageId(&caster,&target,5,0,flags);
 assert(caster.failed==2 && target.healed==0);
 for(uint32_t sp : {uint32_t(1000),uint32_t(1000000000),UINT_MAX}) {
  caster.sp=sp; caster.vit=32767; caster.hp=1000000000;
  for(int level : {99,100,250,275}) {
   caster.level=level;
   for(int skill=1;skill<=3;skill++) {
    int64 expected=int64(skill+1)*12*(int64(sp)+32767);
    if(level>100) expected=expected*level/100;
    assert(self_destruction(&caster,skill)==expected+1000000000);
   }
  }
 }
 std::cout << "Mechanic repair, self-destruction, ABR, cart and decoy boundaries passed\\n";
}
`;
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.error?.message || 'Build failed');
  const run = spawnSync(output, [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
