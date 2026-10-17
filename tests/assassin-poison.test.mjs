import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO Assassin poison regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/assassin-poison.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/assassin-poison.test.mjs /tmp/assassin-poison-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
  const expression = pattern => {
    const match = source.match(pattern);
    if (!match) throw new Error(`Production expression not found: ${pattern}`);
    return match[1];
  };
  const initial = expression(/int32 diff = ([^;]+);\s*if \(status->hp - diff/);
  const periodic = expression(/damage = \(type == SC_DPOISON\) \? 2 \+ status->max_hp \/ 50 : ([^;]+);/);
  const toxin = expression(/status_damage\(bl, bl, 1, ([^,]+), status->dmotion \+ 500/);
  const toxinHeal = expression(/if \(status->sp < status->max_sp\)\s*status_heal\(bl, 0, ([^,]+), 1\);/);
  const mushroom = expression(/case SC_MAGICMUSHROOM:\s*if \(sce->val4 >= 0\) \{\s*bool flag = 0;\s*int64 damage = ([^;]+);/);
  const leech = expression(/case SC_LEECHESEND:\s*if \(sce->val4 >= 0\) \{\s*int64 damage = ([^;]+);/);
  const deathHurt = expression(/case SC_DEATHHURT:\s*if \(sce->val4 >= 0\) \{\s*if \(status->hp < status->max_hp\)\s*status_heal\(bl, ([^,]+), 0, 1\);/);
  const battle = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const hit = battle.match(/if \((\(sce = sc->getSCE\(SC_WEAPONBLOCKING\)\)[^\n]+)\) \{/)[1];
  const miss = battle.match(/if \((attack_type == BF_WEAPON[^\n]+tsce->val2)\) \{/)[1];
  const skillSource = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const menuStart = skillSource.indexOf('void skill_poisoningweapon(');
  const menuEnd = skillSource.indexOf('\n/**', menuStart);
  if (menuStart < 0 || menuEnd < 0) throw new Error('Missing poison selection method');
  const menu = skillSource.slice(menuStart, menuEnd);
  const poisons = [...new Set(menu.match(/ITEMID_[A-Z]+/g))];
  const states = [...new Set(menu.match(/SC_[A-Z]+/g))];
  const requirementStart = skillSource.indexOf('req.hp = skill->require.hp[skill_lv - 1]');
  const requirement = skillSource.slice(skillSource.indexOf('if(hp_rate > 0)', requirementStart), skillSource.indexOf('\n\treq.sp =', requirementStart));
  const condition = skillSource.match(/if\( (require.hp > 0 && status->hp <= \(uint32\)require.hp)\)/)[1];
  const database = readFileSync(resolve(root, 'db/re/skill_db.yml'), 'utf8');
  const hallucination = database.split('Name: GC_HALLUCINATIONWALK')[1].split('  - Id:')[0];
  const hpRate = Number(hallucination.match(/HpRateCost: (-?\d+)/)[1]);
  const hallHeader = readFileSync(resolve(root, 'src/map/skills/thief/hallucinationwalk.hpp'), 'utf8');
  const hallSource = readFileSync(resolve(root, 'src/map/skills/thief/hallucinationwalk.cpp'), 'utf8');
  const code = `
#include <cassert>
#include <algorithm>
#include <cstdint>
#include <climits>
#include <iostream>
#include <cstdio>
using int64=int64_t; using int32=int32_t;
constexpr int BL_PC=1;
struct Status { uint32_t max_hp,max_sp; int vit; uint32_t hp=0; };
struct Block { int type; };
struct Entry { int val1; };
int64 initial_cost(Status* status, Block* bl) { return ${initial}; }
int64 poison_tick(Status* status) { return ${periodic}; }
int64 toxin_cost(Status* status) { return ${toxin}; }
int64 toxin_heal(Status* status) { return ${toxinHeal}; }
int64 mushroom_cost(Status* status) { return ${mushroom}; }
int64 leech_cost(Status* status,Entry* sce) { return ${leech}; }
int64 death_hurt_heal(Status* status) { return ${deathHurt}; }
enum { BF_WEAPON=1,BF_MAGIC=2,BF_MISC=4,BF_SHORT=16,BF_LONG=32,SC_WEAPONBLOCKING=1 };
struct BlockEntry { int val2=20; };
struct Changes { BlockEntry entry; BlockEntry* getSCE(int) { return &entry; } };
int random_value=0;
int rnd() { return random_value; }
bool hit_blocks(int flag) { Changes changes; auto* sc=&changes; BlockEntry* sce=nullptr; return ${hit}; }
bool miss_blocks(int attack_type,int flag) { BlockEntry entry; auto* tsce=&entry; struct { int flag; } d{flag}; return ${miss}; }
using t_itemid=int; using sc_type=int;
enum { ${poisons.join(',')}, ${states.join(',')}, GC_POISONINGWEAPON=100, GC_RESEARCHNEWPOISON, LOG_TYPE_CONSUME, SCSTART_NOAVOID=1, SCSTART_NOICON=2, COLOR_WHITE=0, SELF=0, CHAT_SIZE_MAX=100 };
int color_table[]={0};
struct map_session_data { int menuskill_val=5,learned=5,research=10,owned=10,deleted=0,failed=0,changed=0; bool dead=false,weapon=true; };
int skill_get_weapontype(int) { return 1; }
bool pc_check_weapontype(map_session_data* sd,int) { return sd->weapon; }
bool pc_isdead(map_session_data* sd) { return sd->dead; }
int pc_checkskill(map_session_data* sd,int skill) { return skill==GC_POISONINGWEAPON ? sd->learned : sd->research; }
void clif_skill_fail(map_session_data& sd,int) { sd.failed++; }
int pc_search_inventory(map_session_data* sd,int id) { return sd->owned>0 ? id : -1; }
int pc_delitem(map_session_data* sd,int index,int,int,int,int) { if(index<0) return 1; sd->owned--; sd->deleted++; return 0; }
void status_change_end(map_session_data* sd,int) { sd->changed++; }
int skill_get_time(int,int) { return 30000; }
void sc_start4(map_session_data*,map_session_data*,int,int,int,int,int,int,int) {}
void status_change_start(map_session_data*,map_session_data*,int,int,int,int,int,int,int,int) {}
const char* msg_txt(map_session_data*,int) { return "%s"; }
void clif_messagecolor(map_session_data*,int,char*,bool,int) {}
${menu}
void poison_menu_cases() {
 for (int id : {${poisons.join(',')}}) {
  map_session_data valid;
  skill_poisoningweapon(valid,id);
  assert(valid.owned==9 && valid.deleted==1 && valid.failed==0 && valid.changed==1);
 }
 for (int mode=0;mode<6;mode++) {
  map_session_data rejected;
  int id=ITEMID_TOXIN;
  if(mode==0) rejected.learned=0;
  if(mode==1) rejected.learned=2;
  if(mode==2) rejected.dead=true;
  if(mode==3) id=9999;
  if(mode==4) rejected.owned=0;
  if(mode==5) rejected.weapon=false;
  int before=rejected.owned;
  skill_poisoningweapon(rejected,id);
  assert(rejected.owned==before && rejected.deleted==0 && rejected.failed==1 && rejected.changed==0);
 }
}
using uint32=uint32_t; using uint16=uint16_t; using t_tick=int64;
int64 cap_value(int64 n,int64 lo,int64 hi) { return std::clamp(n,lo,hi); }
int hp_requirement(Status* status,int hp_rate) { struct { int hp=0; } req; ${requirement} return req.hp; }
bool insufficient(Status* status,int cost) { struct { int hp; } require{cost}; return ${condition}; }
using block_list=Status;
constexpr int GC_HALLUCINATIONWALK=2035;
struct StatusSkillImpl {
 StatusSkillImpl(int) {}
 virtual void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32& applied) const { applied++; }
};
${hallHeader.slice(hallHeader.indexOf('class SkillHallucinationWalk'))}
${hallSource.slice(hallSource.indexOf('SkillHallucinationWalk::'))}
void hallucination_cases() {
 for (uint32 maxhp : {uint32(1000),uint32(1000000000),UINT_MAX}) {
  for (uint32 hp : {maxhp,maxhp/2,maxhp/10,maxhp/10+1}) {
   Status state{maxhp,1000,10,hp};
   int cost=hp_requirement(&state,${hpRate});
   assert(cost==maxhp/10);
   int sp=1000; int32 applied=0;
   if (!insufficient(&state,cost)) {
    state.hp-=cost; sp-=100;
    SkillHallucinationWalk{}.castendNoDamageId(&state,&state,5,0,applied);
    assert(state.hp==hp-maxhp/10 && applied==1 && sp==900);
   } else {
    assert(state.hp==hp && sp==1000 && applied==0);
   }
  }
 }
}
int main() {
 hallucination_cases();
 poison_menu_cases();
 for (int attack : {BF_WEAPON,BF_MAGIC,BF_MISC}) {
  for (int distance : {BF_SHORT,BF_LONG}) {
   random_value=0;
   const bool expected=attack==BF_WEAPON && distance==BF_SHORT;
   assert(hit_blocks(attack|distance)==expected);
   assert(miss_blocks(attack,attack|distance)==expected);
   random_value=20;
   assert(!hit_blocks(attack|distance));
   assert(!miss_blocks(attack,attack|distance));
  }
 }
 for (uint32_t hp : {uint32_t(1000),uint32_t(1000000000),uint32_t(INT_MAX),UINT_MAX}) {
  Status state{hp,hp,32767}; Block player{BL_PC},monster{2};
  assert(initial_cost(&state,&player)==int64(hp)*10/100);
  assert(initial_cost(&state,&monster)==int64(hp)*15/100);
  assert(poison_tick(&state)==2+int64(hp)*3/200);
  assert(toxin_cost(&state)==int64(hp)*3/100);
  assert(toxin_heal(&state)==hp/100);
  assert(mushroom_cost(&state)==int64(hp)*3/100);
  assert(death_hurt_heal(&state)==hp/100);
  for (int level=9;level<=10;level++) {
   Entry effect{level};
   assert(leech_cost(&state,&effect)==int64(32767)*(level-3)+hp/100);
  }
 }
 std::cout << "Assassin poison resources and melee-only blocking passed\\n";
}
`;
  const artifact = resolve(options[0]);
  const built = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', artifact], { input: code, encoding: 'utf8' });
  if (built.status !== 0) throw new Error(built.stderr || built.error?.message || 'Build failed');
  const run = spawnSync(artifact, [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
