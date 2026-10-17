import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO Sorcerer resource regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/sorcerer-resources.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/sorcerer-resources.test.mjs /tmp/sorcerer-resources-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const skill = readFileSync(resolve(root, 'src/map/skills/mage/spiritrecovery.cpp'), 'utf8');
  const recovery = skill.slice(skill.indexOf('void SkillSpiritRecovery::castendNoDamageId'));
  const elem = readFileSync(resolve(root, 'src/map/elemental.cpp'), 'utf8');
  const start = elem.indexOf('int32 i = db->status.size+1;');
  const summon = elem.slice(start, elem.indexOf('ele.life_time = lifetime;', start));
  const status = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
  const statusStart = status.indexOf('status->max_hp = ele->max_hp;', status.indexOf('int32 status_calc_elemental_'));
  const transfer = status.slice(statusStart, status.indexOf('if (ed->master)', statusStart));
  const mmo = readFileSync(resolve(root, 'src/common/mmo.hpp'), 'utf8');
  const record = mmo.match(/struct s_elemental \{[\s\S]*?\n\};/)[0];
  if (start < 0 || statusStart < 0 || !recovery.startsWith('void')) throw new Error('Missing production code');
  const sharedSkill = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const analysisStart = sharedSkill.indexOf('int32 skill_elementalanalysis(');
  const analysis = sharedSkill.slice(analysisStart, sharedSkill.indexOf('int32 skill_changematerial(', analysisStart));
  const clif = readFileSync(resolve(root, 'src/map/clif.cpp'), 'utf8');
  const clifStart = clif.indexOf('void clif_parse_ItemListWindowSelected(');
  const selection = clif.slice(clifStart, clif.indexOf('/*====', clifStart));
  const autoStart = sharedSkill.indexOf('std::vector<uint16> skill_get_autospell_skills(');
  const autoSpell = sharedSkill.slice(autoStart, sharedSkill.indexOf('/**', autoStart));
  const warmerStart = status.indexOf('case SC_WARMER: {');
  const warmer = status.slice(status.indexOf('if (ssc &&', warmerStart), status.indexOf('if (status->hp', warmerStart));
  const timer = status.slice(status.indexOf('TIMER_FUNC(status_change_timer)'));
  const crystalStart = timer.indexOf('case SC_CRYSTALIZE:');
  const crystalEnd = timer.indexOf('case SC_FORCEOFVANGUARD:', crystalStart);
  const battle = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const burnStart = battle.indexOf('case PF_SOULBURN:');
  const burnEnd = battle.indexOf('case AB_RENOVATIO:', burnStart);
  if (crystalStart < 0 || crystalEnd < 0 || burnStart < 0 || burnEnd < 0) throw new Error('Missing resource-damage branch');
  const code = `
#include <cassert>
#include <algorithm>
#include <cstdint>
#include <climits>
#include <iostream>
#include <cstring>
#include <vector>
using int16=int16_t; using int32=int32_t; using int64=int64_t; using uint32=uint32_t; using uint16=uint16_t; using t_tick=int64;
using std::max;
int64 cap_value(int64 x,int64 lo,int64 hi) { return std::clamp(x,lo,hi); }
${record}
constexpr int ELEMENTALID_AGNI_S=1,ELEMENTALID_AGNI_M=2,ELEMENTALID_AGNI_L=3;
constexpr int ELEMENTALID_AQUA_S=4,ELEMENTALID_AQUA_M=5,ELEMENTALID_AQUA_L=6;
constexpr int ELEMENTALID_VENTUS_S=7,ELEMENTALID_VENTUS_M=8,ELEMENTALID_VENTUS_L=9;
constexpr int ELEMENTALID_TERA_S=10,ELEMENTALID_TERA_M=11,ELEMENTALID_TERA_L=12;
constexpr int ELEMENTALID_DILUVIO=13,ELEMENTALID_ARDOR=14,ELEMENTALID_PROCELLA=15,ELEMENTALID_TERREMOTUS=16,ELEMENTALID_SERPENS=17;
constexpr int SO_EL_SYMPATHY=1,EM_ELEMENTAL_SPIRIT_M=2,BL_PC=1,DEFTYPE_MIN=SHRT_MIN,DEFTYPE_MAX=SHRT_MAX;
struct Stats { uint32 hp=9000,sp=3600,max_hp=9000,max_sp=3600; uint16 int_=100,dex=80,matk_min=0; int16 hit=100,flee=100,def=100,mdef=100; struct { uint16 atk=0,atk2=0; } rhw; };
struct block_list { bool player=true; int healed_hp=0,healed_sp=0; };
struct s_elemental_data : block_list {};
struct map_session_data : block_list { Stats battle_status; struct { int base_level=100,job_level=50; } status; int sympathy=5,mastery=10,failed=0; s_elemental_data* ed=nullptr; };
int pc_checkskill(map_session_data* sd,int id) { return id==SO_EL_SYMPATHY ? sd->sympathy : sd->mastery; }
s_elemental create(map_session_data* sd,int cls,int size) {
 struct { int class_; struct { int size; } status; } data{cls,{size}}; auto* db=&data;
 s_elemental ele{};
 ${summon}
 return ele;
}
Stats apply(s_elemental value) {
 Stats result; result.def=result.mdef=100; result.matk_min=50;
 auto* status=&result; auto* ele=&value;
 ${transfer}
 return result;
}
#define BL_CAST(kind,ptr) ((ptr)->player ? static_cast<map_session_data*>(ptr) : nullptr)
bool status_charge(map_session_data* sd,int hp,int sp) { if(hp>=sd->battle_status.hp || sp>sd->battle_status.sp) return false; sd->battle_status.hp-=hp; sd->battle_status.sp-=sp; return true; }
void clif_skill_fail(map_session_data& sd,int) { sd.failed++; }
void status_heal(block_list* b,int hp,int sp,int) { b->healed_hp=hp; b->healed_sp=sp; }
void clif_skill_nodamage(block_list*,block_list&,int,int) {}
struct SkillSpiritRecovery { int getSkillId() const { return 1; } void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
${recovery}

namespace analysis_test {
using t_itemid=uint32;
constexpr int MAX_INVENTORY=10,MAX_AMOUNT=30000,SO_EL_ANALYSIS=1,GN_CHANGEMATERIAL=2,LOG_TYPE_CONSUME=1;
constexpr int ITEMID_FLAME_HEART=10,ITEMID_MISTIC_FROZEN=11,ITEMID_ROUGH_WIND=12,ITEMID_GREAT_NATURE=13;
constexpr int ITEMID_BLOODY_RED=20,ITEMID_CRYSTAL_BLUE=21,ITEMID_WIND_OF_VERDURE=22,ITEMID_YELLOW_LIVE=23;
struct item { t_itemid nameid=0; int16 amount=0; int identify=0; };
struct map_session_data {
 struct { struct { item items_inventory[MAX_INVENTORY]; } u; } inventory;
 struct { bool trading=false; } state;
 int npc_shopid=0,menuskill_id=SO_EL_ANALYSIS,menuskill_val=1,m=0,x=0,y=0;
 int deleted=0,added=0,product=0,failed=0,cleared=0,changed=0;
};
#define nullpo_ret(ptr) if(!(ptr)) return 0
int random_value=99;
int rnd() { return random_value; }
void clif_skill_fail(map_session_data& sd,int) { sd.failed++; }
int pc_delitem(map_session_data* sd,int idx,int amount,int,int,int) {
 if(amount<=0 || sd->inventory.u.items_inventory[idx].amount<amount) return 1;
 sd->inventory.u.items_inventory[idx].amount-=amount; sd->deleted+=amount; return 0;
}
unsigned char pc_additem(map_session_data* sd,item* value,int amount,int) {
 assert(amount>0 && amount<=MAX_AMOUNT); sd->added+=amount; sd->product=value->nameid; return 0;
}
struct { bool skill_drop_items_full=false; } battle_config;
void clif_additem(map_session_data*,int,int,int) {}
void map_addflooritem(item*,int,int,int,int,int,int,int,int,int) {}
${analysis}
void skill_changematerial(map_session_data* sd,int,uint16*) { sd->changed++; }
void clif_menuskill_clear(map_session_data* sd) { sd->cleared++; sd->menuskill_id=sd->menuskill_val=0; }
struct s_packet_db { int pos[4]={2,4,8,12}; } packet_db[1];
alignas(4) unsigned char bytes[16];
uint16 word(int pos) { uint16 value; memcpy(&value,bytes+pos,2); return value; }
int32 longword(int pos) { int32 value; memcpy(&value,bytes+pos,4); return value; }
#define RFIFOW(fd,pos) word(pos)
#define RFIFOL(fd,pos) longword(pos)
#define RFIFOP(fd,pos) (bytes+pos)
${selection}
void send(map_session_data& sd,int type,int count) {
 uint16 packet[8]={0,16,static_cast<uint16>(type),0,1,0,2,static_cast<uint16>(count)};
 memcpy(bytes,packet,16); clif_parse_ItemListWindowSelected(0,&sd);
}
void run() {
 for(int direction : {1,2}) for(int elem=0;elem<4;elem++) {
  map_session_data sd; sd.menuskill_val=direction;
  sd.inventory.u.items_inventory[0]={uint32((direction==1?10:20)+elem),20,1};
  send(sd,direction,direction==1?2:20);
  assert(sd.deleted==(direction==1?2:20) && sd.added==(direction==1?18:2));
  assert(sd.product==(direction==1?20:10)+elem && sd.cleared==1);
 }
 for(int direction : {1,2}) {
  map_session_data sd; sd.menuskill_val=direction;
  sd.inventory.u.items_inventory[0]={uint32(direction==1?20:10),20,1};
  send(sd,direction,20);
  assert(sd.failed==1 && sd.deleted==0 && sd.added==0);
 }
 for(int menu : {SO_EL_ANALYSIS,GN_CHANGEMATERIAL,99}) for(int type : {0,1,2,3}) {
  if((menu==SO_EL_ANALYSIS && type==1) || (menu==GN_CHANGEMATERIAL && type==0)) continue;
  map_session_data sd; sd.menuskill_id=menu;
  sd.inventory.u.items_inventory[0]={ITEMID_FLAME_HEART,20,1};
  send(sd,type,2);
  assert(sd.cleared==1 && sd.deleted==0 && sd.added==0 && sd.changed==0);
 }
 for(int count : {0,4000,30000}) {
  map_session_data sd; sd.inventory.u.items_inventory[0]={ITEMID_FLAME_HEART,30000,1};
  send(sd,1,count);
  assert(sd.deleted==0 && sd.added==0 && sd.failed==1);
 }
 map_session_data sd; sd.menuskill_val=2; sd.inventory.u.items_inventory[0]={ITEMID_BLOODY_RED,20,1};
 random_value=0; send(sd,2,20);
 assert(sd.deleted==20 && sd.added==0 && sd.failed==1);
}
}


namespace autospell_test {
using std::min;
constexpr int MG_FIREBOLT=1,MG_COLDBOLT=2,MG_LIGHTNINGBOLT=3,MG_SOULSTRIKE=4,MG_FIREBALL=5,WZ_EARTHSPIKE=6,MG_FROSTDIVER=7,MG_THUNDERSTORM=8,WZ_HEAVENDRIVE=9,MG_NAPALMBEAT=10,SA_AUTOSPELL=20,SC_SPIRIT=1,SL_SAGE=2,SC_AUTOSPELL=3;
struct Status { struct { int val2=SL_SAGE; } entry; bool linked=false; auto* getSCE(int) { return linked ? &entry : nullptr; } };
struct map_session_data { uint16 menuskill_val=1,learned=10; Status sc; int called=0,selected=0,level=0; };
struct { int get_index(int,bool,const char*,const char*,int) { return 1; } } skill_db;
#define SKILL_CHK_GUILD(id) false
int pc_checkskill(map_session_data* sd,int) { return sd->learned; }
int skill_get_time(int,int) { return 1000; }
void sc_start4(map_session_data* sd,map_session_data*,int,int,int,int skill,int level,int,int) { sd->called++; sd->selected=skill; sd->level=level; }
#define RENEWAL
${autoSpell}
void run() {
 for(int level=1;level<=10;level++) for(int id=1;id<=11;id++) {
  map_session_data sd; sd.menuskill_val=level;
  skill_autospell(&sd,id);
  bool allowed=id<=3 || (id<=5 && level>=4) || (id<=7 && level>=7) || (id<=9 && level>=10);
  assert(sd.called==int(allowed));
  if(allowed) assert(sd.level==std::max(1,level/2));
 }
 map_session_data sd; sd.sc.linked=true;
 skill_autospell(&sd,MG_FIREBOLT); assert(sd.level==10);
 sd.learned=3; skill_autospell(&sd,MG_FIREBOLT); assert(sd.level==3);
 sd.called=0; sd.learned=0; skill_autospell(&sd,MG_FIREBOLT); assert(sd.called==0);
}
}

int warmer_heal(uint32 maxhp,int level,bool heater,bool reversed) {
 struct Entry { int val1; } entry{level}; auto* sce=&entry;
 struct State { bool active; bool getSCE(int) { return active; } } source{heater},target{reversed};
 auto* ssc=&source; auto* sc=&target;
 struct { uint32 max_hp; } st{maxhp}; auto* status=&st;
 constexpr int SC_HEATER_OPTION=1,SC_AKAITSUKI=2;
 int32 hp=0;
 ${warmer}
 return hp;
}
namespace resource_damage_test {
constexpr int SC_CRYSTALIZE=1,PF_SOULBURN=2;
struct Status { uint32 max_hp,max_sp,sp; };
struct Entry { int val4; };
int64 hp_cost=0,sp_cost=0,next=0; int calls=0; bool enough=true;
bool status_charge(void*,int64 hp,int64 sp) { hp_cost=hp;sp_cost=sp;calls++;return enough; }
#define sc_timer_next(value) (next=(value))
int crystal(Status* status,Entry* sce) { void* bl=nullptr; int64 tick=5000;
 switch(SC_CRYSTALIZE) { ${timer.slice(crystalStart, crystalEnd)} }
 return 1;
}
#undef sc_timer_next
int64 burn(uint32 sp) { Status value{0,0,sp};auto* tstatus=&value;struct { int64 damage=0; } ad;
 switch(PF_SOULBURN) { ${battle.slice(burnStart, burnEnd)} }
 return ad.damage;
}
void run() {
 for(uint32 amount:{0u,1u,99u,100u,1000000u,1000000000u,2147483648u,UINT_MAX}) {
  Status status{amount,amount,amount};Entry entry{2};calls=0;next=0;enough=true;
  assert(crystal(&status,&entry)==0);
  assert(hp_cost==int64(amount)*2/100 && sp_cost==amount/100 && calls==1 && next==6000);
  assert(crystal(&status,&entry)==0 && calls==2 && entry.val4==0);
  next=0;assert(crystal(&status,&entry)==1 && calls==2 && next==0);
  assert(burn(amount)==int64(amount)*2);
 }
 Status status{1000,1000,1000};Entry entry{2};enough=false;next=0;
 assert(crystal(&status,&entry)==1 && next==0);
}
}
int main() {
 resource_damage_test::run();
 for(uint32 hp : {uint32(1000),uint32(1000000000),UINT_MAX}) for(int lv=1;lv<=5;lv++) for(bool heater : {false,true}) for(bool reversed : {false,true}) {
  int64 expected=int64(hp)*(heater?3:1)*lv/100;
  assert(warmer_heal(hp,lv,heater,reversed)==(reversed?-expected:expected));
 }

 autospell_test::run();
 analysis_test::run();
 map_session_data sd;
 auto ordinary=create(&sd,ELEMENTALID_AGNI_L,2);
 assert(ordinary.max_hp==6250 && ordinary.max_sp==1125 && ordinary.atk==685 && ordinary.atk2==785);
 assert(ordinary.hit==230 && ordinary.matk==335 && ordinary.def==150 && ordinary.flee==150 && ordinary.mdef==150);
 auto normal=apply(ordinary);
 assert(normal.rhw.atk==685 && normal.rhw.atk2==785 && normal.matk_min==385 && normal.def==250 && normal.mdef==250);
 sd.battle_status.hp=sd.battle_status.max_hp=UINT_MAX;
 sd.battle_status.sp=sd.battle_status.max_sp=UINT_MAX;
 sd.battle_status.int_=sd.battle_status.dex=32767;
 sd.battle_status.hit=sd.battle_status.flee=sd.battle_status.def=sd.battle_status.mdef=SHRT_MAX;
 for(int cls=1;cls<=17;cls++) for(int size=0;size<=2;size++) {
  auto high=create(&sd,cls,size);
  int64 hp=int64(UINT_MAX)/3+32767*10+1000;
  hp+=hp*25/100;
  int64 sp=int64(UINT_MAX)/4; sp+=sp*25/100;
  if(cls>=ELEMENTALID_DILUVIO) { hp+=40000; sp+=1000; }
  assert(high.max_hp==hp && high.hp==hp && high.max_sp==sp && high.sp==sp);
  assert(high.hit==SHRT_MAX && high.flee==SHRT_MAX && high.def==SHRT_MAX && high.mdef==SHRT_MAX);
  auto battle=apply(high);
  assert(battle.rhw.atk==USHRT_MAX && battle.rhw.atk2==USHRT_MAX);
  assert(battle.def==SHRT_MAX && battle.mdef==SHRT_MAX);
  assert(battle.matk_min==std::min(50+high.matk,USHRT_MAX));
 }
 sd.sympathy=sd.mastery=0; sd.battle_status.max_sp=0;
 auto low=create(&sd,ELEMENTALID_AQUA_S,0);
 assert(low.atk==0 && apply(low).rhw.atk==0);
 int32 flag=0; s_elemental_data spirit;
 for(uint32 amount : {uint32(1000),uint32(1000000000),UINT_MAX}) {
  sd.battle_status.hp=sd.battle_status.sp=amount; sd.ed=&spirit;
  SkillSpiritRecovery{}.castendNoDamageId(&sd,&sd,1,0,flag);
  assert(spirit.healed_hp==int64(amount)*10/100 && spirit.healed_sp==int64(amount)*10/100);
  assert(sd.battle_status.hp==amount-amount/10 && sd.battle_status.sp==amount-amount/10);
 }
 sd.ed=nullptr; sd.battle_status.hp=1000;
 SkillSpiritRecovery{}.castendNoDamageId(&sd,&sd,1,0,flag);
 assert(sd.battle_status.hp==1000);
 std::cout << "Sorcerer recovery, summon, stat-transfer, conversion, Crystalize and Soul Burn boundaries passed\\n";
}
`;
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.error?.message || 'Build failed');
  const run = spawnSync(output, [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
