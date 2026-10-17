import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const plain = process.argv.includes('--no-color');
const args = process.argv.slice(2).filter(value => value !== '--no-color');
if (!args.length || args[0] === '--help') {
 const color = (code, value) => plain ? value : `\x1b[${code}m${value}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Knight servant regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/knight-servant.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/knight-servant.test.mjs /tmp/knight-servant-test')}\n`);
} else {
 if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const pc = readFileSync(resolve(root, 'src/map/pc.cpp'), 'utf8');
 const deathStart = pc.indexOf('\tfor (k = 0; k < MAX_SERVANT_SIGN;', pc.indexOf('int32 pc_dead('));
 const death = pc.slice(deathStart, pc.indexOf('\n\tif(sd->shadowform_id)', deathStart));
 const status = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
 const endStart = status.indexOf('\t\tcase SC_SERVANT_SIGN: {');
 const end = status.slice(endStart, status.indexOf('\n\t\tcase SC_SOUNDBLEND:', endStart));
 if (deathStart < 0 || endStart < 0) throw new Error('Missing production branches');
 const sign = readFileSync(resolve(root, 'src/map/skills/swordman/servantweaponsign.cpp'), 'utf8').split('\n').filter(line => !line.startsWith('#include')).join('\n');
 const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
#include <unordered_map>
#include <algorithm>
using int32=int32_t;using int8=int8_t;using uint16=uint16_t;using t_tick=int64_t;using sc_type=int;
constexpr int BL_PC=1,BL_MOB=2,MAX_SERVANT_SIGN=5,SC_SERVANT_SIGN=1,DK_SERVANT_W_SIGN=2,USESKILL_FAIL=3,SKILL_NOCONSUME_REQ=4;
struct status_change_entry { int val1=0; };
struct block_list;
struct status_change { block_list* bl=nullptr;status_change_entry entry;status_change_entry* getSCE(int); };
struct block_list { int type=BL_MOB,id=0,owner=0,slot=0;bool marked=false,reject=false;status_change sc; };
struct map_session_data:block_list { int servant_sign[MAX_SERVANT_SIGN]={};map_session_data(){type=BL_PC;} };
struct mob_data:block_list {};
status_change_entry* status_change::getSCE(int){entry.val1=bl->owner;return bl->marked?&entry:nullptr;}
status_change* status_get_sc(block_list* bl){bl->sc.bl=bl;return &bl->sc;}
template<int kind> auto cast(block_list* bl){
 if constexpr(kind==BL_PC)return bl->type==kind?static_cast<map_session_data*>(bl):nullptr;
 else return bl->type==kind?static_cast<mob_data*>(bl):nullptr;
}
#define BL_CAST(kind,ptr) cast<kind>(ptr)
#define ARR_FIND(start,end,i,condition) for(i=start;i<end;i++)if(condition)break
struct SkillImpl { int id;SkillImpl(int id):id(id){}int getSkillId()const{return id;} };
struct SkillServantWeaponSign:SkillImpl { SkillServantWeaponSign();void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&)const; };
int failed=0,success=0;
void clif_skill_fail(map_session_data&,int,int){failed++;}
void clif_skill_nodamage(block_list*,block_list&,int,uint16,bool ok=true){success=ok?1:0;}
int skill_get_sc(int){return SC_SERVANT_SIGN;}
int skill_get_time(int,uint16){return 10000;}
bool sc_start4(block_list*,block_list* target,int,int,int owner,int slot,int,int,int){
 if(target->reject)return false;
 target->marked=true;target->owner=owner;target->slot=slot;return true;
}
std::unordered_map<int,block_list*> units;
block_list* map_id2bl(int id){auto it=units.find(id);return it==units.end()?nullptr:it->second;}
map_session_data* map_id2sd(int id){auto bl=map_id2bl(id);return bl&&bl->type==BL_PC?static_cast<map_session_data*>(bl):nullptr;}
void status_change_end(block_list* bl,int type){
 if(!bl||!bl->marked)return;
 const int val1=bl->owner,val2=bl->slot;bl->marked=false;
 switch(type){${end}}
}
${sign}
void die(map_session_data* sd){int k;${death}}
void mark(map_session_data& src,block_list& target,int slot){src.servant_sign[slot]=target.id;target.owner=src.id;target.slot=slot;target.marked=true;}
int main(){
 map_session_data owner,player;mob_data monster,next;
 owner.id=10;player.id=20;monster.id=30;next.id=40;
 for(auto bl:{static_cast<block_list*>(&owner),static_cast<block_list*>(&player),static_cast<block_list*>(&monster),static_cast<block_list*>(&next)})units[bl->id]=bl;
 mark(owner,monster,0);mark(owner,player,1);owner.servant_sign[2]=999;
 die(&owner);
 assert(!monster.marked&&!player.marked);
 for(int id:owner.servant_sign)assert(id==0);
 mark(owner,next,0);
 status_change_end(&monster,SC_SERVANT_SIGN);
 assert(owner.servant_sign[0]==next.id&&next.marked);
 status_change_end(&next,SC_SERVANT_SIGN);
 assert(owner.servant_sign[0]==0);
 die(&owner);
 // A new login has an empty sign array but old target timers can remain alive.
 mark(owner,monster,0);owner.servant_sign[0]=0;mark(owner,next,0);
 status_change_end(&monster,SC_SERVANT_SIGN);
 assert(owner.servant_sign[0]==next.id);
 status_change_end(&next,SC_SERVANT_SIGN);
 SkillServantWeaponSign skill;int32 flag=0;
 monster.reject=true;failed=success=0;
 skill.castendNoDamageId(&owner,&monster,5,0,flag);
 assert(owner.servant_sign[0]==0&&!monster.marked&&success==0);
 monster.reject=false;
 skill.castendNoDamageId(&owner,&monster,5,0,flag);
 assert(owner.servant_sign[0]==monster.id&&monster.marked&&success==1);
 skill.castendNoDamageId(&owner,&monster,5,0,flag);
 assert(owner.servant_sign[0]==monster.id&&owner.servant_sign[1]==0);
 die(&owner);
 std::cout<<"PASS: servant marks handle death, stale timers, rejected application, and refresh\\n";
}
`;
 const artifact=resolve(args[0]);
 const build=spawnSync('g++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',artifact],{input:code,encoding:'utf8'});
 if(build.status!==0)throw new Error(build.stderr);
 const result=spawnSync(artifact,[],{encoding:'utf8'});
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
 if(result.status!==0)throw new Error(`Regression failed: ${result.status??result.signal}`);
}
