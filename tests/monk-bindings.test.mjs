import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const plain = process.argv.includes('--no-color');
const args = process.argv.slice(2).filter(value => value !== '--no-color');
if (!args.length || args[0] === '--help') {
 const color = (code, value) => plain ? value : `\x1b[${code}m${value}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Monk binding regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/monk-bindings.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/monk-bindings.test.mjs /tmp/monk-bindings-test')}\n`);
} else {
 if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/skills/acolyte/cursedcircle.cpp'), 'utf8').split('\n').filter(line => !line.startsWith('#include')).join('\n');
 const npcSource = readFileSync(resolve(root, 'src/map/skills/npc/npccursedcircle.cpp'), 'utf8').split('\n').filter(line => !line.startsWith('#include')).join('\n');
 const shared = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
 const areaStart = shared.indexOf('int32 skill_area_sub(block_list *bl, va_list ap)');
 const area = shared.slice(areaStart, shared.indexOf('static int32 skill_check_unit_range_sub', areaStart));
 if (areaStart < 0) throw new Error('Missing skill area dispatcher');
 const code = `
#include <cassert>
#include <cstdarg>
#include <cstdint>
#include <algorithm>
#include <vector>
#include <iostream>
using int32=int32_t;using uint16=uint16_t;using t_tick=int64_t;using sc_type=int;using e_skill=int;
using std::min;using std::max;
constexpr int BL_PC=1,BL_MOB=2,BL_CHAR=3,CLASS_BOSS=1,BCT_ENEMY=4,SD_PREAMBLE=8,SD_SPLASH=16,DMGVAL_IGNORE=-1,DMG_SINGLE=0,SR_CURSEDCIRCLE=2334,NPC_SR_CURSEDCIRCLE=9999,SC_CURSEDCIRCLE_ATKER=1,SKILL_NOCONSUME_REQ=32;
struct block_list { int id=1,type=BL_MOB,cls=0,bound=0,atker_count=0;bool enemy=true,dead=false,immune=false; };
struct map_session_data : block_list { int spiritball=0,spiritball_old=0;map_session_data(){type=BL_PC;} };
struct mob_data : block_list {};using TBL_MOB=mob_data;
#define BL_CAST(kind,ptr) ((ptr)->type==kind?static_cast<map_session_data*>(ptr):nullptr)
#define nullpo_ret(ptr) if(!(ptr)) return 0
std::vector<block_list*> targets;
int skill_area_temp[3]={},bound_packets=0,success=0,expected_rate=100;
int status_get_class_(block_list* target) { return target->cls; }
bool status_isdead(block_list& target) { return target.dead; }
int battle_check_target(block_list*,block_list* target,int) { return target->enemy?1:0; }
int skill_get_sc(int) { return 2; }
int skill_get_time(int,int) { return 5000; }
int skill_get_splash(int,int) { return 3; }
int gettick() { return 0; }
int status_get_amotion(block_list*) { return 0; }
bool sc_start2(block_list*,block_list* target,int type,int rate,int,int count,int) {
 if(type==SC_CURSEDCIRCLE_ATKER) { assert(rate==100);target->atker_count=count;return true; }
 assert(rate==expected_rate);if(target->immune)return false;target->bound++;return true;
}
void mob_unlocktarget(mob_data*,int) {}
void clif_bladestop(block_list&,int,bool) { bound_packets++; }
void pc_delspiritball(map_session_data* sd,int count,int) { sd->spiritball-=std::min(sd->spiritball,count); }
void clif_skill_nodamage(block_list*,block_list&,int,int,bool ok) { success=ok; }
template<typename... T> void clif_skill_damage(T...) {}
struct SkillImpl { int id;SkillImpl(int id):id(id){}int getSkillId() const {return id;} };
struct SkillCursedCircle : SkillImpl { const int32 binding_rate;SkillCursedCircle(e_skill skill_id=SR_CURSEDCIRCLE,int32 binding_rate=100);void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
using SkillFunc=int32(*)(block_list*,block_list*,uint16,uint16,t_tick,int32);
int32 skill_castend_nodamage_id(block_list* src,block_list* target,uint16,uint16 lv,t_tick tick,int32 flag) {
 SkillCursedCircle{}.castendNoDamageId(src,target,lv,tick,flag);
 return 0; // Successful generic no-damage dispatch returns zero in skill.cpp.
}
${area}
int32 map_forcountinrange(int32(*func)(block_list*,va_list),const block_list*,int,int limit,int type,...) {
 int count=0;va_list args;va_start(args,type);
 for(auto* target:targets) { va_list copy;va_copy(copy,args);count+=func(target,copy);va_end(copy);if(limit && count>=limit)break; }
 va_end(args);return count;
}
${source}
struct SkillNpcCursedCircle : SkillCursedCircle { SkillNpcCursedCircle(); };
${npcSource}
int main() {
 for(int available : {0,1,2,5,15}) {
  map_session_data source;source.spiritball=available;source.spiritball_old=15;
  std::vector<mob_data> mobs(22);targets.clear();bound_packets=success=0;
  mobs[0].cls=CLASS_BOSS;mobs[1].immune=true;mobs[2].dead=true;mobs[3].enemy=false;
  for(auto& mob:mobs)targets.push_back(&mob);
  int32 flag=0;SkillCursedCircle{}.castendNoDamageId(&source,&source,5,0,flag);
  int bound=0;for(const auto& mob:mobs)bound+=mob.bound;
  assert(bound==available && bound_packets==available && source.spiritball==0 && source.atker_count==available);
  assert(!mobs[0].bound && !mobs[1].bound && !mobs[2].bound && !mobs[3].bound);
  assert(bool(success)==(available>0));
 }
 for(bool immune : {false,true}) {
  map_session_data source;source.spiritball=source.spiritball_old=5;mob_data target;target.immune=immune;targets={&target};bound_packets=success=0;
  int32 flag=0;SkillCursedCircle{}.castendNoDamageId(&source,&source,5,0,flag);
  assert(source.spiritball==(immune?5:4) && source.atker_count==(immune?0:1));
  assert(bool(success)==!immune);
 }
 expected_rate=50;mob_data npc;std::vector<mob_data> mobs(25);targets.clear();bound_packets=success=0;
 for(auto& target:mobs)targets.push_back(&target);mobs[0].immune=true;
 int32 flag=0;SkillNpcCursedCircle{}.castendNoDamageId(&npc,&npc,5,0,flag);
 int bound=0;for(const auto& target:mobs)bound+=target.bound;
 assert(bound==15 && bound_packets==15 && npc.atker_count==15 && success && !mobs[0].bound);
 std::cout<<"Cursed Circle successful-target limits, immunity and spirit costs passed\\n";
}
`;
 const output=resolve(args[0]);
 const build=spawnSync('c++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',output],{input:code,encoding:'utf8'});
 if(build.status!==0)throw new Error(build.stderr||'Build failed');
 const run=spawnSync(output,[],{encoding:'utf8'});process.stdout.write(run.stdout||'');
 if(run.status!==0)throw new Error(run.stderr||'Regression failed');
}
