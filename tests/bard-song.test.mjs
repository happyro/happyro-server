import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Bard combat regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/bard-song.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/bard-song.test.mjs /tmp/bard-song-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const read = name => readFileSync(resolve(root, name), 'utf8');
 const status = read('src/map/status.cpp');
 const tarot = read('src/map/skills/archer/tarotcardoffate.cpp');
 const fail = tarot.match(/if \((rnd\(\) % 100 [^|\n]+) \|\|/)[1];
 const curse = tarot.slice(tarot.indexOf('case 11:')).match(/sc_start\(src, target, SC_CURSE,[^;]+;/)[0];
 const mana = status.match(/status_heal\(bl, 0, ([^;]+), 1\);\n\s*val3 = 50 \* val1;/)[1];
 const sleep = status.match(/status_heal\(bl, ([^\n]+), 2\);\n\s*sc_timer_next\(2000 \+ tick\);/)[1];
 const names = ['SkillMusicalInterlude','SkillJawaiiSerenade','SkillPronMarch','SkillSongOfMana'];
 const files = ['musicalinterlude','jawaiiserenade','pronmarch','songofmana'];
 const methods=files.map((file,i)=>{const s=read('src/map/skills/archer/'+file+'.cpp');return s.slice(s.indexOf('void '+names[i]+'::castendNoDamageId'));});
 const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
using int32=int32_t;using int64=int64_t;using uint16=uint16_t;using t_tick=int64;using sc_type=int;
constexpr int BL_PC=1,BCT_PARTY=16,AREA_SIZE=14,WM_LESSON=1,SC_CURSE=2;
struct status_change { bool active=false; bool getSCE(int) { return active; } };
struct block_list { bool player=true; int applied=0,notices=0,bonus=0;status_change sc; };
struct map_session_data: block_list { struct { int party_id=0; } status; int skill_id_song=0,skill_lv_song=0; };
#define BL_CAST(kind,b) ((b)->player?static_cast<map_session_data*>(b):nullptr)
status_change* status_get_sc(block_list* b){return &b->sc;}
int skill_get_sc(int id){return id;}
int skill_get_time(int,int){return 10000;}
int skill_get_time2(int,int){return 5000;}
int skill_get_splash(int,int){return 7;}
int pc_checkskill(map_session_data*,int){return 10;}
int partners=0;
int skill_check_pc_partner(map_session_data*,int,uint16*,int,int){return partners;}
void clif_skill_nodamage(block_list*,block_list& b,int,int){b.notices++;}
bool sc_start2(block_list*,block_list* b,int,int,int,int,int){b->sc.active=true;b->applied++;return true;}
bool sc_start4(block_list*,block_list* b,int,int,int,int,int flag,int,int){b->sc.active=true;b->applied++;b->bonus=flag&2;return true;}
int skill_area_sub=0,skill_castend_nodamage_id=0;
block_list member;
void (*dispatch)(block_list*,block_list*,uint16,t_tick,int32&)=nullptr;
void party_foreachsamemap(int,map_session_data* s,int,block_list* src,int,uint16 lv,t_tick tick,int32 flag,int){
 if(!s->status.party_id)return;
 dispatch(src,s,lv,tick,flag);dispatch(src,&member,lv,tick,flag);
}
${names.map((n,i)=>`struct ${n} {int getSkillId() const{return ${i+10};}void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const;};`).join('\n')}
${methods.join('\n')}
int roll=0;int rnd(){return roll;}
int curseRate=0,curseLevel=0;
void sc_start(block_list*,block_list*,int,int rate,int level,int){curseRate=rate;curseLevel=level;}
struct { int getSkill(int){return 1;} } status_db;
int64 healedHp=0,healedSp=0;
void status_heal(block_list*,int64 hp,int64 sp,int){healedHp=hp;healedSp=sp;}
void restore(uint32_t amount,int val1){struct {uint32_t max_hp,max_sp;} data{amount,amount};auto* status=&data;block_list b;auto* bl=&b;
 status_heal(bl,0,${mana},1);assert(healedSp==int64(amount)*(val1<=2?10:val1<=4?15:20)/100);
 status_heal(bl,${sleep},2);assert(healedHp==int64(amount)*3/100 && healedSp==healedHp);
}
int main(){
 for(int skill_lv=1;skill_lv<=5;skill_lv++){
  int success=0;for(roll=0;roll<100;roll++)if(!(${fail}))success++;
  assert(success==skill_lv*8);
  block_list a,b;auto* src=&a;auto* target=&b;int skill_id=1;${curse}
  assert(curseRate==100 && curseLevel==skill_lv);
  for(uint32_t amount:{100u,1000000000u,UINT32_MAX})restore(amount,skill_lv);
 }
 ${names.map((n,i)=>`dispatch=[](block_list* a,block_list* b,uint16 lv,t_tick t,int32& f){${n}{}.castendNoDamageId(a,b,lv,t,f);};
 for(bool party:{false,true})for(int bonus:{0,1}){
 map_session_data s;member=block_list{};s.status.party_id=party;partners=bonus;int32 flag=0;
 dispatch(&s,&s,3,0,flag);
 assert(s.applied==1);
 if(party)assert(member.applied==1);
 ${i<3?`assert(s.notices==1 && s.skill_id_song==${i+10} && s.skill_lv_song==3 && s.bonus==(bonus?2:0));`:''}
 }`).join('\n')}
 std::cout<<"Bard solo/party songs, Tarot probabilities and recovery boundaries passed\\n";
}
`;
 const output=resolve(options[0]);
 const build=spawnSync('c++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',output],{input:code,encoding:'utf8'});
 if(build.status!==0) throw new Error(build.stderr||'Compiler failed');
 const run=spawnSync(output,[],{encoding:'utf8'});
 if(run.status!==0) throw new Error(run.stderr||'Regression failed');
 process.stdout.write(run.stdout);
}
