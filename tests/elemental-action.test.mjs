import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO elemental action regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/elemental-action.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/elemental-action.test.mjs /tmp/elemental-action-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/elemental.cpp'), 'utf8');
  const extract = (signature) => {
    const start = source.indexOf(signature);
    const end = source.indexOf('\n}', start);
    if (start < 0 || end < 0) throw new Error(`Missing production function: ${signature}`);
    return source.slice(start, end + 2);
  };
  const unit = readFileSync(resolve(root, 'src/map/unit.cpp'), 'utf8');
  const forcedStart = unit.indexOf('\t\t\tif( src->type == BL_ELEM )', unit.indexOf('case EL_TIDAL_WEAPON:'));
  const forcedEnd = unit.indexOf('\n\t\t\tbreak;', forcedStart);
  if (forcedStart < 0 || forcedEnd < 0) throw new Error('Missing forced elemental cast handling');
  const code = `
#include <cassert>
#include <algorithm>
#include <cstdint>
#include <memory>
#include <unordered_map>
#include <iostream>
using int32=int32_t;using uint16=uint16_t;using t_tick=int64_t;
constexpr int INVALID_TIMER=-1,EL_SKILLMODE_AGGRESSIVE=1,INF_GROUND_SKILL=2,BCT_ENEMY=1,USW_FIXPOS=1,BL_ELEM=1;
#define nullpo_ret(p) if(!(p)) return 0
#define DIFF_TICK(a,b) ((a)-(b))
struct FreeBlockLock {};
struct block_list { int id=1,m=0,x=0,y=0,type=BL_ELEM;void* prev=this;bool dead=false; };
struct map_session_data : block_list { int skill_id_old=0; };
struct s_elemental_skill { uint16 id=1,lv=1; };
struct Database { std::unordered_map<int,std::shared_ptr<s_elemental_skill>> skill; };
struct s_elemental_data : block_list {
 map_session_data* master=nullptr;std::shared_ptr<Database> db=std::make_shared<Database>();
 struct { int skilltimer=INVALID_TIMER,walktimer=INVALID_TIMER; t_tick canact_tick=0; } ud;
 int target_id=0,action_target_id=0,hp=100,sp=100; bool action_forced=false;
 t_tick last_thinktime=0;
};
namespace util { template<class M> auto umap_find(M& m,int key) { auto i=m.find(key);return i==m.end()?typename M::mapped_type{}:i->second; } }
struct s_skill_condition { int hp=0,sp=20; };
bool ranged=true,walkable=true,allowed=true,hostile=true,ground=false,blocked=false;
int casts=0,charges=0,walks=0,last_casttime=0;block_list* current_target=nullptr;
bool status_isdead(block_list& b) {return b.dead;}
bool elemental_skillnotok(int,s_elemental_data&) {return blocked;}
bool status_check_skilluse(block_list*,block_list*,int,int) {return allowed;}
int battle_check_target(block_list*,block_list*,int) {return hostile?1:0;}
int status_get_hp(s_elemental_data* ed){return ed->hp;}
int status_get_sp(s_elemental_data* ed){return ed->sp;}
s_skill_condition elemental_skill_get_requirements(int,int){return {};}
int skill_get_range(int,int){return 3;}
int skill_get_inf(int){return ground?INF_GROUND_SKILL:0;}
bool battle_check_range(block_list*,block_list*,int){return ranged;}
int unit_walktobl(s_elemental_data* ed,block_list*,int,int){walks++;if(walkable)ed->ud.walktimer=10;return walkable;}
void unit_stop_attack(s_elemental_data*){}
void unit_stop_walking(s_elemental_data* ed,int){ed->ud.walktimer=INVALID_TIMER;}
block_list* map_id2bl(int id){return current_target&&current_target->id==id?current_target:nullptr;}
void status_zap(s_elemental_data* ed,int hp,int sp){charges++;ed->hp=std::max(0,ed->hp-hp);ed->sp=std::max(0,ed->sp-sp);}
int unit_skilluse_id(s_elemental_data* ed,int,int,int){
 auto*src=static_cast<block_list*>(ed);int casttime=1000;
 ${unit.slice(forcedStart,forcedEnd)}
 last_casttime=casttime;casts++;return 1;
}
int unit_skilluse_pos(s_elemental_data* ed,int,int,int skill,int lv){return unit_skilluse_id(ed,0,skill,lv);}
${extract('int32 elemental_unlocktarget(')}
${extract('int32 elemental_action(')}
${extract('static bool elemental_resume_action(')}
void reset(s_elemental_data& ed,map_session_data& master,block_list& target){
 ed=s_elemental_data{};ed.master=&master;ed.db->skill[EL_SKILLMODE_AGGRESSIVE]=std::make_shared<s_elemental_skill>();
 target=block_list{};target.id=7;current_target=&target;
 ranged=walkable=allowed=hostile=true;ground=blocked=false;casts=charges=walks=0;
 master.skill_id_old=0;
}
int main(){
 s_elemental_data ed;map_session_data master;block_list target;
 for(bool positional:{false,true})for(bool forced:{false,true}){
  reset(ed,master,target);ground=positional;
  assert(elemental_action(&ed,&target,0,forced)==1);
  assert(casts==1&&charges==1&&ed.sp==80&&!ed.action_forced);
  assert(last_casttime==(forced?-1:1000));
  reset(ed,master,target);ground=positional;ranged=false;
  assert(elemental_action(&ed,&target,0,forced)==1);
  assert(ed.action_target_id==target.id&&casts==0&&charges==0&&ed.ud.skilltimer==INVALID_TIMER);
  assert(elemental_resume_action(&ed,100)&&walks==1&&casts==0);
  ranged=true;assert(elemental_resume_action(&ed,200));
  assert(casts==1&&charges==1&&ed.sp==80&&ed.action_target_id==0&&!ed.action_forced);
  assert(!elemental_resume_action(&ed,300)&&casts==1);
  assert(last_casttime==(forced?-1:1000));
 }
 // Resource exhaustion while walking prevents an automatic cast, but not an explicit command.
 for(bool forced:{false,true}){
  reset(ed,master,target);ranged=false;elemental_action(&ed,&target,0,forced);
  ed.sp=0;ranged=true;elemental_resume_action(&ed,200);
  assert(casts==(forced?1:0)&&charges==(forced?1:0)&&!ed.action_target_id&&!ed.action_forced);
  assert(elemental_action(&ed,&target,300,false)==0); // No forced flag leaks to the next AI attack.
 }
 for(int invalid=0;invalid<5;invalid++){
  reset(ed,master,target);ranged=false;elemental_action(&ed,&target,0,true);
  if(invalid==0)current_target=nullptr;
  if(invalid==1)target.m++;
  if(invalid==2)target.dead=true;
  if(invalid==3)hostile=false;
  if(invalid==4)allowed=false;
  assert(elemental_resume_action(&ed,100)&&!ed.action_target_id&&!ed.action_forced&&casts==0&&charges==0);
 }
 reset(ed,master,target);ranged=false;walkable=false;
 assert(elemental_action(&ed,&target,0,true)==0&&charges==0&&!ed.action_target_id);
 reset(ed,master,target);ranged=false;elemental_action(&ed,&target,0,true);
 elemental_unlocktarget(&ed);ranged=true;
 assert(!elemental_resume_action(&ed,100)&&casts==0&&!ed.action_forced);
 reset(ed,master,target);ed.sp=0;ranged=false;
 assert(elemental_action(&ed,&target,0,false)==0&&walks==0);
 reset(ed,master,target);blocked=true;
 assert(elemental_action(&ed,&target,0,true)==0&&charges==0&&casts==0);
 reset(ed,master,target);ed.ud.skilltimer=123;
 assert(elemental_action(&ed,&target,0,true)==0&&charges==0&&casts==0);
 reset(ed,master,target);ed.ud.canact_tick=100;
 assert(elemental_action(&ed,&target,0,true)==0&&charges==0&&casts==0);
 std::cout<<"Elemental immediate/pursued attacks, resource rechecks, cancellation and forced-cast isolation passed\\n";
}
`;
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || 'Compiler failed');
  const run = spawnSync(output, [], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
  process.stdout.write(run.stdout);
}
