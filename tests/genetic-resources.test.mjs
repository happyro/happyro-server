import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO Genetic resource regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/genetic-resources.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/genetic-resources.test.mjs /tmp/genetic-resources-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/skills/merchant/aidcondensedpotion.cpp'), 'utf8');
  const start = source.indexOf('void SkillAidCondensedPotion::castendNoDamageId');
  const method = source.slice(start, source.indexOf('void SkillAidCondensedPotion::castendPos2'));
  const statSource = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
  const statStart = statSource.indexOf('status->max_hp =', statSource.indexOf('// Custom formulas for bionic'));
  const stats = statSource.slice(statStart, statSource.indexOf('\n\t\t\t\t\t}', statStart));
  if (start < 0 || statStart < 0) throw new Error('Missing production code');
  const homSource = readFileSync(resolve(root, 'src/map/homunculus.cpp'), 'utf8');
  const homStart = homSource.indexOf('static void hom_send_skill_cooldowns(');
  if (homStart < 0 || homSource.match(/hom_send_skill_cooldowns\(\*hd\);/g)?.length !== 2) throw new Error('Missing recall/revive cooldown synchronization');
  const cooldown = homSource.slice(homStart, homSource.indexOf('/**', homStart));
  const shared = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const materialStart = shared.indexOf('int32 skill_changematerial(');
  const material = shared.slice(materialStart, shared.indexOf('/*====', materialStart));
  const outputStart = shared.indexOf('int32 j, k = 0;', shared.indexOf('if (skill_id == GN_CHANGEMATERIAL && tmp_item.amount)'));
  const outputBlock = shared.slice(outputStart, shared.indexOf('} else if (tmp_item.amount)', outputStart));
  if (materialStart < 0 || outputStart < 0) throw new Error('Missing material conversion code');
  const legionSource = readFileSync(resolve(root, 'src/map/skills/homunculus/homunculus_summonlegion.cpp'), 'utf8');
  const legionStart = legionSource.indexOf('void SkillSummonLegion::castendNoDamageId');
  const legion = legionSource.slice(legionStart, legionSource.indexOf('static int32 summon_legion_count_sub(', legionStart));
  const graniteStart = statSource.indexOf('int64 damage =', statSource.indexOf('case SC_GRANITIC_ARMOR:', statSource.indexOf('int32 status_change_end( ')));
  const granite = statSource.slice(graniteStart, statSource.indexOf('status_damage(', graniteStart));
  const cbcStart = statSource.indexOf('int64 hp=0;', statSource.indexOf('case SC_CBC:', statSource.indexOf('TIMER_FUNC(status_change_timer)')));
  const cbc = statSource.slice(cbcStart, statSource.indexOf('if( !status_charge(', cbcStart));
  const potency = source.match(/potion_hp = cap_value\(static_cast<int64>\(potion_hp\) \* \(100\+i_lv\)[^;]+;/)?.[0];
  const hplus = source.match(/potion_hp = cap_value\(static_cast<int64>\(potion_hp\) \+[^;]+;/)?.[0];
  if (legionStart < 0 || graniteStart < 0 || cbcStart < 0 || !potency || !hplus) throw new Error('Missing homunculus or potion production logic');
  const tearGas = statSource.match(/val2 = [^;]+; \/\/ Drain 5% HP/)?.[0];
  if (!tearGas) throw new Error('Missing tear gas damage');
  const selectorStart = statSource.indexOf('const uint16 summon_skill_id =');
  const selector = statSource.slice(selectorStart, statSource.indexOf('case AM_SPHEREMINE:', selectorStart));
  const summonCases = statSource.slice(statSource.indexOf('case AM_SPHEREMINE:', selectorStart), statSource.indexOf('case NC_SILVERSNIPER:', selectorStart));
  const bionicStart = statSource.indexOf('case BO_WOODENWARRIOR:', selectorStart);
  const bionicCases = statSource.slice(bionicStart, statSource.indexOf('\n\t\t\t}', bionicStart));
  const summonNames = ['summonflora', 'summonmarinesphere', 'woodenwarrior', 'woodenfairy', 'creeper', 'helltree'];
  const summonSources = summonNames.map(name => readFileSync(resolve(root, 'src/map/skills/merchant/' + name + '.cpp'), 'utf8'));
  const summonDeclarations = summonSources.map(src => {
    const [, cls, id] = src.match(/(Skill\w+)::\1\(\) : SkillImpl\((\w+)\)/);
    const signature = src.match(/void Skill\w+::(castend\w+)\(([^)]*)\) const/);
    return 'struct ' + cls + ' { int getSkillId() const { return ' + id + '; } void ' + signature[1] + '(' + signature[2] + ') const; };';
  }).join('\n');
  const summonMethods = summonSources.map(src => src.slice(src.indexOf('void Skill'))).join('\n');
  const code = `
#include <cassert>
#include <algorithm>
#include <cstdint>
#include <climits>
#include <iostream>
#include <map>
#include <vector>
#include <bitset>
using int32=int32_t; using int64=int64_t; using uint16=uint16_t; using uint8=uint8_t; using t_tick=int64;
int64 cap_value(int64 x,int64 low,int64 high) { return std::clamp(x,low,high); }
constexpr int BL_PC=1,BL_MOB=2,MOBID_EMPERIUM=1,CLASS_BATTLEFIELD=2,SM_RECOVERY=1,MG_SRECOVERY=2,AL_HEAL=3;
constexpr int SC_WATER_INSIGNIA=0,SC_CRITICALWOUND=1,SC_DEATHHURT=2,SC_NORECOVER_STATE=3;
struct Entry { int val1=0,val2=0,val3=0; };
struct status_change { Entry entries[4]; bool active[4]={}; bool empty() { return false; } Entry* getSCE(int id) { return active[id]?&entries[id]:nullptr; } };
struct status_data { uint16 vit=100,int_=100; };
struct block_list { int type=BL_PC,cls=0,healed_hp=0,healed_sp=0; status_data stats; status_change sc; };
struct map_session_data : block_list { int recovery=0,bonus=0; };
struct mob_data : block_list { int mob_id=0; mob_data() { type=BL_MOB; } };
#define BL_CAST(kind,ptr) ((ptr)->type==(kind) ? static_cast<std::conditional_t<(kind)==BL_PC,map_session_data,mob_data>*>(ptr) : nullptr)
status_data* status_get_status_data(block_list& b) { return &b.stats; }
status_change* status_get_sc(block_list* b) { return &b->sc; }
int status_get_class_(block_list* b) { return b->cls; }
int pc_checkskill(map_session_data* sd,int) { return sd->recovery; }
int pc_skillheal2_bonus(map_session_data* sd,int) { return sd->bonus; }
void clif_skill_nodamage(block_list*,block_list&,int,int) {}
void status_heal(block_list* b,int hp,int sp,int) { b->healed_hp=hp; b->healed_sp=sp; }
int32 potion_hp=0,potion_sp=0;
struct SkillAidCondensedPotion { int getSkillId() const { return 478; } void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
${method}
constexpr int DEFTYPE_MIN=SHRT_MIN,DEFTYPE_MAX=SHRT_MAX,BO_HELLTREE=1;
struct PlantStats { uint32_t max_hp=1; uint16 vit=100,speed=150; int32 batk=100; int16_t def=100,mdef=100,hit=100,flee=100; struct { uint16 atk=0,atk2=0; } rhw; };
PlantStats summon(PlantStats master,int bionic_mastery,bool tree) {
 PlantStats result; auto* status=&result; auto* mstatus=&master;
 struct { int skill_id; } unit{tree?BO_HELLTREE:0}; auto* ud=&unit; const int summon_skill_id=unit.skill_id;
 ${stats}
 return result;
}
namespace cooldown_test {
struct map_session_data {};
struct homun_data { map_session_data* master; std::map<int,int> scd; };
struct TimerData { t_tick tick; };
std::map<int,TimerData> timers;
std::vector<std::pair<int,t_tick>> messages;
struct { bool display_status_timers=true; } battle_config;
t_tick now=50000;
t_tick gettick() { return now; }
#define DIFF_TICK(a,b) ((a)-(b))
const TimerData* get_timer(int id) { auto found=timers.find(id); return found==timers.end()?nullptr:&found->second; }
void clif_skill_cooldown(map_session_data&,int skill,t_tick remain) { messages.emplace_back(skill,remain); }
${cooldown}
void run() {
 map_session_data master; homun_data hd{&master,{{10,999999},{20,2},{30,3},{40,4}}};
 timers={{999999,{now+120000}},{2,{now+3000}},{3,{now-1}}};
 auto original=hd.scd;
 hom_send_skill_cooldowns(hd);
 assert(messages.size()==2 && messages[0].second==120000 && messages[1].second==3000);
 assert(hd.scd==original && timers[999999].tick==170000);
 now+=1000; messages.clear(); hom_send_skill_cooldowns(hd);
 assert(messages[0].second==119000 && messages[1].second==2000 && hd.scd==original);
 messages.clear(); battle_config.display_status_timers=false; hom_send_skill_cooldowns(hd); assert(messages.empty());
 battle_config.display_status_timers=true; hd.master=nullptr; hom_send_skill_cooldowns(hd); assert(messages.empty());
}
}
namespace material_test {
using t_itemid=uint32_t;
constexpr int MAX_PRODUCE_RESOURCE=3,MAX_INVENTORY=8,MAX_SKILL_PRODUCE_DB=2,GN_CHANGEMATERIAL=2494;
constexpr int MSI_SKILL_FAIL_MATERIAL_IDENTITY=1,MSI_SKILL_RECIPE_NOTEXIST=2;
struct Item { int nameid=0,amount=0,identify=1; };
struct map_session_data { struct { struct { Item items_inventory[MAX_INVENTORY]; } u; } inventory; int failed=0,produced=0; };
struct Recipe { int itemlv=26,nameid=999; int mat_id[MAX_PRODUCE_RESOURCE]={10,20,0},mat_amount[MAX_PRODUCE_RESOURCE]={2,3,0}; } skill_produce_db[MAX_SKILL_PRODUCE_DB];
#define nullpo_ret(ptr) if(!(ptr)) return 0
void clif_skill_fail(map_session_data& sd,int) { sd.failed++; }
void clif_msg_skill(map_session_data& sd,int,int) { sd.failed++; }
bool skill_produce_mix(map_session_data* sd,int,int,int,int,int,int qty,int idx) {
 for(int i=0;i<2;i++) assert(sd->inventory.u.items_inventory[i].amount>=qty*skill_produce_db[idx].mat_amount[i]);
 sd->produced=qty; return true;
}
${material}
void run() {
 skill_produce_db[1].itemlv=0;
 for(int count : {1,2,1000}) { map_session_data sd; sd.inventory.u.items_inventory[0]={10,count*2,1};sd.inventory.u.items_inventory[1]={20,count*3,1};
  uint16 input[]={2,uint16(count*2),3,uint16(count*3)}; assert(skill_changematerial(&sd,2,input)==1 && sd.produced==count && sd.failed==0);
 }
 for(int mode=0;mode<6;mode++) { map_session_data sd; sd.inventory.u.items_inventory[0]={10,2,1};sd.inventory.u.items_inventory[1]={20,3,1};
  uint16 input[]={2,2,3,3};
  if(mode==0) input[1]=4;
  if(mode==1) input[1]=0;
  if(mode==2) input[2]=2;
  if(mode==3) input[2]=65535;
  if(mode==4) sd.inventory.u.items_inventory[1].identify=0;
  if(mode==5) sd.inventory.u.items_inventory[1].nameid=0;
  assert(skill_changematerial(&sd,2,input)==0 && sd.produced==0 && sd.failed>0);
 }
}
}
namespace material_output_test {
int64 min(int64 a,int64 b) { return std::min(a,b); }
constexpr int MAX_AMOUNT=30000,MAX_SKILL_CHANGEMATERIAL_DB=1,MAX_SKILL_CHANGEMATERIAL_SET=1,LOG_TYPE_PRODUCE=0,NOTIFYEFFECT_PHARMACY_SUCCESS=0,MSI_SKILL_SUCCESS=0;
struct { int nameid=999; int qty[1]={5},qty_rate[1]={1000}; } skill_changematerial_db[1];
struct Item { int nameid=999; int16_t amount=0; };
struct Player { int m=0,x=0,y=0; };
struct { bool skill_drop_items_full=false; } battle_config;
bool stackable=true,fail=false;
int64 added=0,dropped=0; int calls=0;
int rnd() { return 0; }
bool itemdb_isstackable(int) { return stackable; }
int pc_additem(Player*,Item*,int amount,int) { assert(amount>0 && amount<=MAX_AMOUNT); calls++; if(fail) return 1; added+=amount; return 0; }
void clif_additem(Player*,int,int,int) {}
void map_addflooritem(Item*,int amount,int,int,int,int,int,int,int,int) { dropped+=amount; }
void clif_produceeffect(Player*,int,int) {}
void clif_misceffect(Player&,int) {}
void clif_msg_skill(Player&,int,int) {}
bool output(int qty) {
 Player player; auto* sd=&player; int nameid=999,skill_id=2494,i=0,flag=0; Item tmp_item;
 ${outputBlock}
 return false;
}
void run() {
 for(bool nonstack : {false,true}) for(int qty : {1,6000,15000,30000}) {
  stackable=!nonstack; added=dropped=calls=0; fail=false;
  assert(output(qty) && added==int64(qty)*5 && dropped==0);
  assert(calls==(nonstack?qty*5:(qty*5+29999)/30000));
 }
 stackable=true; fail=true; battle_config.skill_drop_items_full=true; added=dropped=calls=0;
 assert(output(15000) && added==0 && dropped==75000 && calls==3);
}
}
namespace hom_damage_test {
int64 min(int64 a,int64 b) { return std::min(a,b); }
int64 max(int64 a,int64 b) { return std::max(a,b); }
int64 granite_damage(uint32_t maximum,uint32_t current,int val3) {
 struct { uint32_t max_hp,hp; } data{maximum,current}; auto* status=&data;
 ${granite}
 return damage;
}
void run() {
 for(uint32_t maximum : {uint32_t(1000),uint32_t(1000000000),UINT_MAX}) for(int rate=6;rate<=30;rate+=6) {
  int64 full=int64(maximum)*rate/100;
  for(uint32_t hp : {uint32_t(0),uint32_t(1),uint32_t(full),maximum}) assert(granite_damage(maximum,hp,rate)==std::min(full,std::max(int64(hp)-1,int64(0))));
 }
 for(uint32_t spmax : {uint32_t(1000),uint32_t(1000000000),UINT_MAX}) for(int kind : {BL_PC,BL_MOB}) {
  struct { uint32_t max_sp; } state{spmax}; auto* status=&state;
  struct { int val3; } entry{10}; auto* sce=&entry;
  block_list target; target.type=kind; auto* bl=&target;
  ${cbc}
  assert(sp==int64(spmax)/10 && hp==(kind==BL_MOB?sp*10:0));
 }
 for(int initial : {500,1000000,INT_MAX}) for(int bonus : {0,250,30000}) for(int healpower : {0,100,32767}) {
  int32 potion_hp=initial,i_lv=bonus;
  struct { int hplus; } stats{healpower}; auto* sstatus=&stats;
  ${potency}
  int64 expected=std::clamp<int64>(int64(initial)*(100+bonus)/100,0,INT_MAX);
  assert(potion_hp==expected);
  ${hplus}
  expected=std::clamp<int64>(expected+expected*healpower/100,0,INT_MAX); assert(potion_hp==expected);
 }
}
}
namespace legion_test {
constexpr int MOBID_S_HORNET=1,MOBID_S_GIANT_HORNET=2,MOBID_S_LUCIOLA_VESPA=3,BL_MOB=2,SKILL_NOCONSUME_REQ=4,SZ_SMALL=0,AI_ATTACK=0,AI_LEGION=1,INVALID_TIMER=-1,SC_MODECHANGE=1,MD_CANATTACK=1,MD_AGGRESSIVE=2;
constexpr int summon_legion_count_sub=0;
struct block_list { int m=1,x=2,y=3,id=4; };
struct mob_data : block_list { int master_id=0,deletetimer=INVALID_TIMER; uint16 summon_skill_id=0,summon_skill_lv=0; struct { int ai=0; } special_state; } mob;
int existing=0,spawned=0;
void map_foreachinmap(int,int,int,int,int,int* count) { *count=existing; }
const char* status_get_name(block_list&) { return "test"; }
mob_data* mob_once_spawn_sub(block_list*,int,int,int,const char*,int,const char*,int,int) { return &mob; }
void mob_timer_delete() {}
void delete_timer(int,void(*)()) {}
int gettick() { return 0; }
int skill_get_time(int,int) { return 1000; }
int add_timer(int,void(*)(),int,int) { return 1; }
void mob_spawn(mob_data*) { spawned++; }
template<typename... T> void sc_start4(T...) {}
struct SkillSummonLegion { int getSkillId() const { return 1; } void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
${legion}
void run() {
 int limit[]={3,3,4,4,5}; block_list source;
 for(int lv=1;lv<=5;lv++) for(existing=0;existing<=6;existing++) {
  int32 flag=0; spawned=0; SkillSummonLegion{}.castendNoDamageId(&source,&source,lv,0,flag);
  assert(spawned==std::max(0,limit[lv-1]-existing));
  if(spawned) assert(mob.summon_skill_id==1 && mob.summon_skill_lv==lv);
  assert(bool(flag&SKILL_NOCONSUME_REQ)==(existing>=limit[lv-1]));
 }
}
}
namespace summon_test {
#undef BL_CAST
#define BL_CAST(kind,ptr) static_cast<map_session_data*>(ptr)
constexpr int AM_SPHEREMINE=1,AM_CANNIBALIZE=2,MH_SUMMON_LEGION=3,KO_ZANZOU=4,BO_WOODENWARRIOR=5,BO_WOODEN_FAIRY=6,BO_CREEPER=7,BO_HELLTREE=8,BO_BIONICS_M=9;
constexpr int MOBID_G_MANDRAGORA=1,MOBID_G_HYDRA=2,MOBID_G_FLORA=3,MOBID_G_PARASITE=4,MOBID_G_GEOGRAPHER=5,MOBID_MARINE_SPHERE=6;
constexpr int MOBID_BIONIC_WOODENWARRIOR=7,MOBID_BIONIC_WOODEN_FAIRY=8,MOBID_BIONIC_CREEPER=9,MOBID_BIONIC_HELLTREE=10;
constexpr int SZ_SMALL=0,INVALID_TIMER=-1,MD_CANATTACK=1,MD_AGGRESSIVE=2;
enum mob_ai { AI_FLORA,AI_SPHERE,AI_BIONIC }; using e_mode=int;
struct status_data : PlantStats { int mode=0; };
struct block_list { int id=1,m=1,x=1,y=1,level=200; };
struct map_session_data : block_list { status_data stats; };
struct mob_data : block_list { int master_id=0,deletetimer=INVALID_TIMER; uint16 summon_skill_id=0,summon_skill_lv=0; struct { mob_ai ai; } special_state; status_data stats; } mob;
struct Unit { uint16 skill_id=0,skill_lv=0; } unit;
map_session_data master;
status_data* status_get_status_data(block_list&) { return &master.stats; }
int pc_checkskill(map_session_data*,int) { return 1; }
int status_get_lv(block_list* b) { return b->level; }
void calculate() {
 auto* md=&mob; auto* mbl=&master; auto* ud=&unit; auto* status=&mob.stats;
 mob.stats=status_data{};
 ${selector}
 ${summonCases}
 ${bionicCases}
 }
}
const char* status_get_name(block_list&) { return "test"; }
mob_data* mob_once_spawn_sub(block_list*,int,int,int,const char*,int,const char*,int,int) { mob=mob_data{}; return &mob; }
void mob_timer_delete() {}
void delete_timer(int,void(*)()) {}
int gettick() { return 0; }
int skill_get_time(int,int) { return 1000; }
int skill_get_sc(int) { return 0; }
int add_timer(int,void(*)(),int,int) { return 1; }
void mob_spawn(mob_data*) { calculate(); }
void clif_skill_nodamage(block_list*,block_list&,int,int) {}
template<typename... T> void sc_start(T...) {}
${summonDeclarations}
${summonMethods}
void run() {
 for(int id : {AM_CANNIBALIZE,AM_SPHEREMINE,BO_WOODENWARRIOR,BO_WOODEN_FAIRY,BO_CREEPER,BO_HELLTREE}) for(int lv=1;lv<=5;lv++) {
  unit={uint16(id),uint16(lv)}; int32 flag=0;
  switch(id) {
   case AM_CANNIBALIZE: SkillSummonFlora{}.castendPos2(&master,1,1,lv,0,flag); break;
   case AM_SPHEREMINE: SkillSummonMarineSphere{}.castendPos2(&master,1,1,lv,0,flag); break;
   case BO_WOODENWARRIOR: SkillWoodenWarrior{}.castendNoDamageId(&master,&master,lv,0,flag); break;
   case BO_WOODEN_FAIRY: SkillWoodenFairy{}.castendNoDamageId(&master,&master,lv,0,flag); break;
   case BO_CREEPER: SkillCreeper{}.castendNoDamageId(&master,&master,lv,0,flag); break;
   case BO_HELLTREE: SkillHellTree{}.castendNoDamageId(&master,&master,lv,0,flag); break;
  }
  auto initial=mob.stats;
  assert(initial.max_hp>1);
  for(int other : {0,AM_CANNIBALIZE,BO_HELLTREE}) {
   unit={uint16(other),1}; calculate();
   assert(mob.stats.max_hp==initial.max_hp && mob.stats.rhw.atk==initial.rhw.atk && mob.stats.rhw.atk2==initial.rhw.atk2 && mob.stats.mode==initial.mode);
  }
  assert(mob.summon_skill_id==id && mob.summon_skill_lv==lv);
 }
 for(int lv=1;lv<=5;lv++) {
  mob.summon_skill_id=MH_SUMMON_LEGION; mob.summon_skill_lv=lv; unit={0,0}; calculate();
  assert(mob.stats.max_hp==10*(100*(lv+2)+master.level));
  assert(mob.stats.batk==100*(lv+5)/2 && mob.stats.def==10*(100*(lv+2)+master.level));
 }
}
}
namespace teargas_test {
struct block_list { uint32_t max_hp; };
uint32_t status_get_max_hp(block_list* bl) { return bl->max_hp; }
void run() {
 for(uint32_t hp : {100u,1000000u,858993460u,1000000000u,UINT_MAX}) {
  block_list target{hp}; auto* bl=&target; int32 val2=0;
  ${tearGas}
  assert(val2==int64(hp)*5/100);
 }
}
}
int main() {
 summon_test::run(); teargas_test::run();
 hom_damage_test::run(); legion_test::run();
 material_test::run(); material_output_test::run();
 cooldown_test::run();
 for(int amount : {500,1000000,INT_MAX}) for(int stat : {100,32767}) for(int penalty : {0,80,100}) {
  map_session_data src,target; target.stats.vit=target.stats.int_=stat; target.recovery=10;
  target.sc.active[SC_CRITICALWOUND]=true; target.sc.entries[SC_CRITICALWOUND].val2=penalty;
  potion_hp=potion_sp=amount; int32 flag=0;
  SkillAidCondensedPotion{}.castendNoDamageId(&src,&target,10,0,flag);
  int64 expected=int64(amount)*(100+stat*2)/100; expected=expected*200/100; expected-=expected*penalty/100;
  assert(target.healed_hp==std::clamp<int64>(expected,0,INT_MAX)); assert(target.healed_sp==target.healed_hp);
 }
 for(int mob : {MOBID_EMPERIUM,99}) { map_session_data src; mob_data target; target.mob_id=mob; target.cls=CLASS_BATTLEFIELD; int32 flag=0;
  SkillAidCondensedPotion{}.castendNoDamageId(&src,&target,10,0,flag); assert(target.healed_hp==0);
 }
 PlantStats master;
 auto normal=summon(master,1,false); assert(normal.max_hp==45000 && normal.rhw.atk==560 && normal.rhw.atk2==800);
 auto tree=summon(master,1,true); assert(tree.max_hp==65000 && tree.rhw.atk==1960 && tree.rhw.atk2==2800);
 master.vit=32767; master.batk=INT_MAX; master.def=master.mdef=master.hit=master.flee=SHRT_MAX;
 for(int level=1;level<=10;level++) for(bool tree : {false,true}) {
  auto high=summon(master,level,tree);
  assert(high.max_hp==uint32_t((5000LL+40000LL*level)*32767/100+(tree?20000:0)));
  assert(high.rhw.atk==USHRT_MAX && high.rhw.atk2==USHRT_MAX);
  assert(high.def==SHRT_MAX && high.mdef==SHRT_MAX && high.hit==SHRT_MAX && high.flee==SHRT_MAX);
 }
 std::cout << "Genetic summons, tear gas, potion, homunculus and material checks passed\\n";
}
`;
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.error?.message || 'Build failed');
  const run = spawnSync(output, [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
