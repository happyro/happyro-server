import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO homunculus casting regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/homunculus-casting.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/homunculus-casting.test.mjs /tmp/homunculus-casting-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const skill = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const clif = readFileSync(resolve(root, 'src/map/clif.cpp'), 'utf8');
  function method(source, signature) {
    const start = source.indexOf(signature);
    if (start < 0) throw new Error('Missing production method: ' + signature);
    const body = source.indexOf('{', start);
    let depth = 1, end = body + 1;
    for (; depth && end < source.length; end++) {
      if (source[end] === '{') depth++;
      else if (source[end] === '}') depth--;
    }
    if (depth) throw new Error('Unclosed production method');
    return source.slice(start, end);
  }
  const gate = method(skill, 'bool skill_isNotOk_hom(');
  const cost = method(skill, 'static int32 skill_check_condition_mercenary(');
  const requestId = method(clif, 'static void clif_parse_UseSkillToId_homun(');
  const requestPos = method(clif, 'static void clif_parse_UseSkillToPos_homun(');
  const pos = method(skill, 'TIMER_FUNC(skill_castend_pos)');
  const cooldownStart = pos.indexOf('\t\tif (src->type == BL_HOM) {');
  // The baseline has no ground homunculus cooldown branch; keep an empty body so the behavioral assertion fails.
  const cooldown = cooldownStart < 0 ? '' : method(pos.slice(cooldownStart), 'if (src->type == BL_HOM)');
  const constants = [...new Set((gate + cost + requestId + requestPos).match(/\b(?:MH_|HFLI_|HVAN_|SC_|USESKILL_|HOMGRADE_|SA_|SO_|ET_|ST_)[A-Z0-9_]+\b/g))];
  const magmaSource = readFileSync(resolve(root, 'src/map/skills/homunculus/homunculus_magmaflow.cpp'), 'utf8');
  const battle = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const magmaTrigger = battle.match(/if\( \(sce=tsc->getSCE\(SC_MAGMA_FLOW\)\)[^\n]+\n[^\n]+;/)?.[0];
  if (!magmaTrigger) throw new Error('Missing magma flow trigger');
  const magmaOverride = magmaSource.includes('void SkillMagmaFlow::castendDamageId(') ? method(magmaSource, 'void SkillMagmaFlow::castendDamageId(') : '';
  const code = `
#include <cassert>
#include <algorithm>
#include <cstdint>
#include <climits>
#include <memory>
#include <map>
#include <set>
#include <iostream>
using int8=int8_t; using int16=int16_t; using int32=int32_t; using int64=int64_t; using uint16=uint16_t; using uint32=uint32_t; using t_tick=int64; using t_itemid=int;
#define RENEWAL
#define ARRAYLENGTH(a) (sizeof(a)/sizeof((a)[0]))
#define nullpo_retr(value,p) if(!(p)) return value
#define DIFF_TICK(a,b) ((a)-(b))
constexpr int MAX_SKILL_ITEM_REQUIRE=2,MAX_SKILL_LEVEL=20,BL_HOM=1,BL_MER=2,INF_SELF_SKILL=1,INVALID_TIMER=-1,LOG_TYPE_CONSUME=0;
enum { ${constants.join(',')} };
int64 cap_value(int64 x,int64 a,int64 b) { return std::clamp(x,a,b); }
struct Entry { int val1=0; };
struct status_change { std::map<int,Entry> entries; bool empty() { return entries.empty(); } Entry* getSCE(int id) { auto i=entries.find(id);return i==entries.end()?nullptr:&i->second; } };
struct status_data { uint32 hp=1000,sp=1000,max_hp=1000,max_sp=1000; };
struct block_list { int type=BL_HOM,id=1; status_data stats; };
struct map_session_data { struct { struct { struct { int amount=10; } items_inventory[2]; } u; } inventory; int failed=0; };
struct Unit { int skilltimer=INVALID_TIMER; t_tick canact_tick=0; int skill_id=0,skill_lv=1; };
struct homun_data : block_list { map_session_data* master=nullptr; status_change sc; std::set<int> scd; Unit ud; struct { int spiritball=5; uint32 intimacy=100000; } homunculus; };
struct TBL_MER : block_list { map_session_data* master=nullptr; }; using TBL_HOM=homun_data;
struct s_skill_db { struct { int itemid[2]={},amount[2]={};int hp[20]={},sp[20]={},hp_rate[20]={},sp_rate[20]={},mhp[20]={}; int state=0; } require; };
struct { std::shared_ptr<s_skill_db> value=std::make_shared<s_skill_db>(); std::shared_ptr<s_skill_db> find(int) { return value; } } skill_db;
struct { uint32 hvan_explosion_intimate=500; } battle_config;
int required_balls=2,learned=5,cost_calls=0,cast_calls=0; bool forbidden=false,missing_item=false,valid_target=true;
namespace util { template<typename C> bool umap_exists(C& c,int id) { return c.count(id); } }
status_change* status_get_sc(homun_data* hd) { return &hd->sc; }
status_data* status_get_status_data(block_list& b) { return &b.stats; }
int hom_get_intimacy_grade(homun_data*) { return 1000; }
int skill_get_spiritball(int,int) { return required_balls; }
template<typename... T> void clif_skill_fail(map_session_data& sd,T...) { sd.failed++; }
void hom_delspiritball(homun_data* hd,int n,int) { hd->homunculus.spiritball-=n; cost_calls++; }
bool skill_isNotOk(int,map_session_data&) { return forbidden; }
bool unit_can_move(block_list*) { return true; }
int pc_search_inventory(map_session_data*,int) { return missing_item?-1:0; }
void pc_delitem(map_session_data* sd,int index,int amount,int,int,int) { sd->inventory.u.items_inventory[index].amount-=amount; }
void skill_consume_hpspap(block_list* bl,int,int hp,int sp,int) { bl->stats.hp-=hp;bl->stats.sp-=sp; }
${gate}
${cost}
int hom_checkskill(homun_data*,int) { return learned; }
int skill_get_inf(int) { return 0; }
void clif_emotion(homun_data&,int) {}
void unit_skilluse_id(homun_data* hd,int,int id,int lv) { cast_calls++; if(valid_target) skill_check_condition_mercenary(hd,id,lv,1); }
void unit_skilluse_pos(homun_data* hd,int,int,int id,int lv) { unit_skilluse_id(hd,0,id,lv); }
${requestId}
${requestPos}
int skill_get_cooldown(int,int) { return 3000; }
int skill_get_delay(int,int) { return 1000; }
int cooldown_calls=0,cooldown_ms=0;
void skill_blockhomun_start(homun_data& hd,int id,int ms) { hd.scd.insert(id);cooldown_calls++;cooldown_ms=ms; }
void finish_ground(homun_data& hd,int id) { block_list* src=&hd;auto* ud=&hd.ud;ud->skill_id=id; ${cooldown} }
namespace magma_test {
constexpr int SC_MAGMA_FLOW=1,MH_MAGMA_FLOW=8039;
struct Entry { int val1=0,val2=0; };
struct Status { Entry entry; Entry* getSCE(int) { return &entry; } } status;
int roll=0,random_calls=0,hits=0,activations=0;
int rnd() { return random_calls++==0?roll:99; }
int gettick() { return 0; }
struct SkillImplRecursiveDamageSplash {
 virtual void castendDamageId(block_list* src,block_list* target,uint16 skill_lv,t_tick tick,int32& flag) const {
  if(flag&1) { hits++; return; }
  activations++;
  for(int i=0;i<3;i++) { int32 recursive=1;this->castendDamageId(src,target,skill_lv,tick,recursive); }
 }
};
struct SkillMagmaFlow : SkillImplRecursiveDamageSplash {
 ${magmaOverride ? 'void castendDamageId(block_list*,block_list*,uint16,t_tick,int32&) const override;' : ''}
};
${magmaOverride}
void skill_castend_damage_id(block_list* src,block_list* target,int,uint16 lv,t_tick tick,int32 flag) { SkillMagmaFlow{}.castendDamageId(src,target,lv,tick,flag); }
void run() {
 for(int level=1;level<=5;level++) {
  activations=hits=0;
  for(roll=0;roll<100;roll++) {
   status.entry={level,3*level};auto* tsc=&status;Entry* sce=nullptr;block_list source,target;auto* bl=&target;auto* src=&source;random_calls=0;
   ${magmaTrigger}
   assert(random_calls==1);
  }
  assert(activations==3*level && hits==activations*3);
 }
}
}
int main() {
 magma_test::run();
 for(bool ground : {false,true}) for(int failure=0;failure<8;failure++) {
  map_session_data sd; homun_data hd;hd.master=&sd; learned=5;forbidden=false;missing_item=false;valid_target=true;cost_calls=cast_calls=0;
  skill_db.value=std::make_shared<s_skill_db>();skill_db.value->require.sp[0]=100;
  int skill_id=999;
  if(failure==0) forbidden=true;
  if(failure==1) hd.ud.skilltimer=3;
  if(failure==2) hd.ud.canact_tick=100;
  if(failure==3) learned=0;
  if(failure==4) hd.stats.sp=1;
  if(failure==5) { skill_db.value->require.itemid[0]=1; missing_item=true; }
  if(failure==6) valid_target=false;
  if(failure==7) hd.scd.insert(skill_id);
  if(ground) clif_parse_UseSkillToPos_homun(&hd,&sd,0,skill_id,1,1,1,0);
  else clif_parse_UseSkillToId_homun(&hd,&sd,0,skill_id,1,2);
  assert(hd.homunculus.spiritball==5 && cost_calls==0);
  if(failure==3) assert(cast_calls==0);
 }
 learned=5;forbidden=false;missing_item=false;valid_target=true;
 map_session_data sd;homun_data hd;hd.master=&sd;skill_db.value=std::make_shared<s_skill_db>();skill_db.value->require.sp[0]=100;
 cost_calls=0; assert(!skill_isNotOk_hom(&hd,999,1));assert(hd.homunculus.spiritball==5);
 assert(skill_check_condition_mercenary(&hd,999,1,1)==1);assert(hd.homunculus.spiritball==3 && hd.stats.sp==900 && cost_calls==1);
 hd.homunculus.spiritball=1; assert(skill_check_condition_mercenary(&hd,999,1,1)==0);assert(hd.stats.sp==900 && hd.homunculus.spiritball==1);
 hd.homunculus.spiritball=5; assert(skill_check_condition_mercenary(&hd,MH_BLAZING_AND_FURIOUS,1,1)==1);assert(hd.homunculus.spiritball==5);
 hd.stats.sp=100; assert(skill_check_condition_mercenary(&hd,999,1,1)==1);assert(hd.stats.sp==0 && hd.homunculus.spiritball==3);
 hd.stats.sp=99; assert(skill_check_condition_mercenary(&hd,999,1,1)==0);assert(hd.stats.sp==99 && hd.homunculus.spiritball==3);
 TBL_MER merc; merc.type=BL_MER;merc.master=&sd;merc.stats.sp=100;assert(skill_check_condition_mercenary(&merc,999,1,1)==1 && merc.stats.sp==0);
 for(bool ground : {false,true}) {
  homun_data limited;limited.master=&sd;learned=1;cost_calls=0;cast_calls=0;
  if(ground) clif_parse_UseSkillToPos_homun(&limited,&sd,0,999,10,1,1,0);
  else clif_parse_UseSkillToId_homun(&limited,&sd,0,999,10,2);
  assert(cost_calls==1 && cast_calls==1 && limited.stats.sp==900 && limited.homunculus.spiritball==3);
 }
 finish_ground(hd,999);assert(cooldown_calls==1 && cooldown_ms==3000 && skill_isNotOk_hom(&hd,999,1));
 std::cout << "Homunculus rejected casts, spirit/SP costs, ground cooldown and magma checks passed\\n";
}
`;
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.error?.message || 'Build failed');
  const run = spawnSync(output, [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
