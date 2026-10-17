import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Monk combat regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/monk-combat.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/monk-combat.test.mjs /tmp/monk-combat-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const read = name => readFileSync(resolve(root, name), 'utf8');
 const shared = read('src/map/skill.cpp');
 const battle = read('src/map/battle.cpp');
 const castSource = read('src/map/skills/acolyte/knucklearrow.cpp');
 const cast = castSource.slice(castSource.indexOf('void SkillKnuckleArrow::castendDamageId'));
 const timerStart = shared.indexOf('case SR_KNUCKLEARROW:', shared.indexOf('TIMER_FUNC(skill_timerskill)'));
 const timer = shared.slice(timerStart, shared.indexOf('case CH_PALMSTRIKE:', timerStart));
 const blowStart = shared.indexOf('case SR_KNUCKLEARROW:', shared.indexOf('void skill_attack_blow'));
 const blow = shared.slice(blowStart, shared.indexOf('case RL_R_TRIP:', blowStart));
 const bonusStart = battle.indexOf('case SR_GATEOFHELL: {');
 const bonus = battle.slice(bonusStart, battle.indexOf('case MH_TINDER_BREAKER:', bonusStart));
 if (timerStart < 0 || blowStart < 0 || bonusStart < 0 || !cast.startsWith('void ') || /\bdir_ka\b/.test(shared + castSource)) throw new Error('Missing production combat paths');
 if (!shared.includes('skill_attack_blow(src, dsrc, bl, (uint8)dmg.blewcount, skill_id, skill_lv, damage, tick, flag, knockback_direction);')) throw new Error('Attack does not forward per-strike knockback direction');
 const status = read('src/map/status.cpp');
 const releaseStart = status.indexOf('case SC_CURSEDCIRCLE_TARGET:', status.indexOf('int32 status_change_end( '));
 const release = status.slice(releaseStart, status.indexOf('case SC_SITDOWN_FORCE:', releaseStart));
 if (releaseStart < 0 || status.includes('clif_bladestop( *bl, tsc->getSCE(SC_CURSEDCIRCLE_TARGET)->val2, false );')) throw new Error('Cursed Circle release must be centralized');
 const tigerSource = read('src/map/skills/acolyte/tigercannon.cpp');
 const tiger = tigerSource.slice(tigerSource.indexOf('void SkillTigerCannon::castendDamageId'));
 const code = `
#include <cassert>
#include <cstdint>
#include <climits>
#include <vector>
#include <iostream>
using int8=int8_t; using int16=int16_t; using int32=int32_t; using int64=int64_t; using uint16=uint16_t; using t_tick=int64;
constexpr int SR_KNUCKLEARROW=1,SR_GATEOFHELL=2,SR_FALLENEMPIRE=3,SC_COMBO=1,BF_WEAPON=1,SD_LEVEL=0x1000;
enum e_skill_blown { BLOWN_NONE=0,BLOWN_IGNORE_NO_KNOCKBACK=1,BLOWN_NO_KNOCKBACK_MAP=2,BLOWN_MD_KNOCKBACK_IMMUNE=4,BLOWN_TARGET_NO_KNOCKBACK=8,BLOWN_TARGET_BASILICA=16 };
struct Stats { uint32_t max_hp=10000,hp=8000,max_sp=999,sp=333; };
using status_data=Stats;
struct block_list { int id=0,x=0,y=0,level=200; bool wall=false; Stats stats; };
struct Entry { int val1=SR_FALLENEMPIRE,val2=0; };
struct status_change { bool active=false; Entry e; Entry* getSCE(int) { return active?&e:nullptr; } };
struct Damage { int64 damage=100,damage2=200; };
Stats* status_get_status_data(block_list& b) { return &b.stats; }
int status_get_lv(block_list* b) { return b->level; }
#define ATK_ADD(a,b,v) do { int64 amount=(v); (a)+=amount; (b)+=amount; } while(false)
Damage gate(block_list* src, int skill_lv, bool combo) { Damage wd; status_change state; state.active=combo; auto* sc=&state;
 switch(SR_GATEOFHELL) { ${bonus} }
 return wd;
}
struct Timer { block_list* src; int target_id,x,y,skill_id,skill_lv,type,flag; t_tick tick; };
std::vector<Timer> timers;
std::vector<int> blown;
int map_calc_dir(block_list* target,int x,int y) { if(x<target->x)return 6; if(x>target->x)return 2; return y<target->y?0:4; }
bool skill_check_unit_movepos(int,block_list* src,int x,int y,int,int) { src->x=x;src->y=y;return true; }
int skill_blown(block_list* src,block_list* target,int count,int dir,e_skill_blown) {
 if(src==target) return count; blown.push_back(dir); return target->wall?count-1:count;
}
void skill_addtimerskill(block_list* src,t_tick tick,int target_id,int x,int y,int skill_id,int skill_lv,int type,int flag) { timers.push_back({src,target_id,x,y,skill_id,skill_lv,type,flag,tick}); }
struct SkillKnuckleArrow { int getSkillId() const {return SR_KNUCKLEARROW;} void castendDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
${cast}
void skill_attack(int,block_list* src,block_list* dsrc,block_list* target,int skill_id,int skill_lv,t_tick tick,int flag,int8 dir) {
 if(flag&4)return;
 int blewcount=3;
 switch(skill_id) { ${blow} }
}
void fire(Timer task,block_list* target) { auto* skl=&task;auto* src=task.src;auto tick=task.tick;
 switch(skl->skill_id) { ${timer} }
}
constexpr int SC_CURSEDCIRCLE_TARGET=10,SC_CURSEDCIRCLE_ATKER=11;
block_list master{50}; status_change masterState;
std::vector<int> released;int masterEnded=0;bool masterExists=true;
block_list* map_id2bl(int id) { return masterExists && id==master.id?&master:nullptr; }
status_change* status_get_sc(block_list* b) { return b==&master?&masterState:nullptr; }
void clif_bladestop(block_list& b,int owner,bool state) { assert(owner==master.id && !state); released.push_back(b.id); }
void status_change_end(block_list* b,int type) { assert(b==&master && type==SC_CURSEDCIRCLE_ATKER);++masterEnded;masterState.active=false; }
void releaseVictim(block_list* bl,int val2) { switch(SC_CURSEDCIRCLE_TARGET) { ${release} } }
using map_session_data=block_list;
#define BL_CAST(kind,ptr) (ptr)
constexpr int BL_PC=1,BL_CHAR=1,BL_SKILL=2,SD_ANIMATION=0x2000,SD_SPLASH=0x4000,BCT_ENEMY=1,SC_FLASHCOMBO=2;
int activations=0,splashes=0,hits=0;
void clif_skill_nodamage(block_list* src,block_list& dest,int,int) { assert(src==&dest);++activations; }
int skill_get_splash(int,int) { return 3; }
int skill_area_sub=0;
void skill_castend_damage_id(block_list*,block_list*,int,int,t_tick,int);
void map_foreachinrange(int,block_list*,int,int,block_list*,int,int,t_tick,int,decltype(&skill_castend_damage_id)) { ++splashes; }
struct WeaponSkillImpl { void castendDamageId(block_list*,block_list*,uint16,t_tick,int32&) const {++hits;} };
struct SkillTigerCannon:WeaponSkillImpl {
 int getSkillId() const{return 99;}
 void castendDamageId(block_list*,block_list*,uint16,t_tick,int32&) const;
 void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const;
};
${tiger}
void skill_castend_damage_id(block_list* src,block_list* target,int,int level,t_tick tick,int flag) { SkillTigerCannon().castendDamageId(src,target,level,tick,flag); }
int main() {
 for(int level=1;level<=10;++level) for(uint32_t sp : {0u,333u,999u,1000000u,UINT_MAX}) for(bool combo:{false,true}) {
  block_list src;src.stats.max_sp=sp;src.stats.sp=sp/3;
  Damage result=gate(&src,level,combo);
  int64 expected=2000+static_cast<int64>(combo?sp:sp/3)*(100+20*level)/100+(combo?40:10)*src.level;
  assert(result.damage==100+expected && result.damage2==200+expected);
 }
 masterState.active=true;masterState.e.val2=2;block_list v1{60},v2{61};
 releaseVictim(&v1,50);assert((released==std::vector<int>{60}) && masterEnded==0 && masterState.e.val2==1);
 releaseVictim(&v2,50);assert((released==std::vector<int>{60,61}) && masterEnded==1);
 masterExists=false;releaseVictim(&v1,50);assert(released.size()==3 && masterEnded==1);
 SkillTigerCannon tigerSkill;block_list monk{70},mob{71};int32 tigerFlag=0;
 tigerSkill.castendDamageId(&monk,&mob,5,1000,tigerFlag);assert(activations==1 && splashes==1);
 tigerFlag=1;tigerSkill.castendDamageId(&monk,&mob,5,1000,tigerFlag);assert(activations==1 && hits==1);
 tigerFlag=0;tigerSkill.castendNoDamageId(&monk,&monk,5,2000,tigerFlag);assert(activations==2 && splashes==2);
 SkillKnuckleArrow skill;int32 flag=0;block_list a{1,0,0},b{2,20,0},victim{3,10,0};
 skill.castendDamageId(&a,&victim,5,1000,flag);
 skill.castendDamageId(&b,&victim,5,1010,flag);
 assert(timers.size()==2 && timers[0].x==6 && timers[1].x==2);
 // Another cast or movement must not change either queued approach direction.
 a.x=50;b.x=-50;victim.wall=true;
 auto first=timers[0],second=timers[1];fire(second,&victim);fire(first,&victim);
 assert((blown==std::vector<int>{2,6}));assert(timers.size()==4);
 assert(timers[2].flag&4);assert(timers[3].flag&4);
 fire(timers[2],&victim);fire(timers[3],&victim);assert(blown.size()==2);
 std::cout<<"Monk SP bonus, delayed knockback and Cursed Circle release checks passed\\n";
}
`;
 const output=resolve(options[0]);
 const build=spawnSync('c++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',output],{input:code,encoding:'utf8'});
 if(build.status!==0) throw new Error(build.stderr||'Compiler failed');
 const run=spawnSync(output,[],{encoding:'utf8'});
 if(run.status!==0) throw new Error(run.stderr||'Regression failed');
 process.stdout.write(run.stdout);
}
