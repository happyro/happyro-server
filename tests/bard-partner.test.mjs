import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const plain = process.argv.includes('--no-color');
const args = process.argv.slice(2).filter(value => value !== '--no-color');
if (!args.length || args[0] === '--help') {
 const color = (code, value) => plain ? value : `\x1b[${code}m${value}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Bard partner regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/bard-partner.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/bard-partner.test.mjs /tmp/bard-partner-test')}\n`);
} else {
 if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
 const start = source.indexOf('int32 skill_check_pc_partner(');
 const end = source.indexOf('/**', start);
 if (start < 0 || end < 0) throw new Error('Missing partner production function');
 const code = `
#include <cassert>
#include <cstdint>
#include <cstring>
#include <vector>
#include <map>
#include <iostream>
using int32=int32_t;using uint16=uint16_t;
#define RENEWAL
constexpr int MAX_PARTY=12,INF2_ISCHORUS=1,INF2_ISENSEMBLE=2,PC_PERM_SKILL_UNCONDITIONAL=1,BL_PC=1;
enum {PR_BENEDICTIO=10,WM_GREAT_ECHO,AB_ADORAMUS,CG_MOONLIT,CG_SPECIALSINGER,SC_DANCING,SC_ENSEMBLEFATIGUE,TR_GEF_NOCTURN=100,TR_PRON_MARCH=106,BD_SIEGFRIED=200};
struct Entry { int val2=0,val4=0; };
struct Status { Entry entry;bool dancing=false;bool hasSCE(int){return dancing;}Entry* getSCE(int){return dancing?&entry:nullptr;} };
struct map_session_data { int id=0,sp=100,fatigue=0;Status sc;uint16 skill_id_dance=0,skill_lv_dance=0; };
struct { bool player_skill_partner_check=true; } battle_config;
std::map<int,map_session_data*> players;
std::map<int,std::vector<int>> nearby;
bool skill_get_inf2(uint16 skill,int flag) { return flag==INF2_ISCHORUS?skill==WM_GREAT_ECHO:skill==BD_SIEGFRIED||skill==CG_MOONLIT; }
bool pc_has_permission(map_session_data*,int){return false;}
int skill_check_condition_char_sub=0;
int map_foreachinallrange(int,map_session_data* sd,int,int,map_session_data*,int* count,int (*ids)[MAX_PARTY],uint16 skill) {
 int sum=0;for(int id:nearby[sd->id]) { (*ids)[(*count)++]=id;sum+=skill==WM_GREAT_ECHO?1:5; }return sum;
}
map_session_data* map_id2sd(int id){auto it=players.find(id);return it==players.end()?nullptr:it->second;}
bool status_charge(map_session_data* sd,int,int cost){if(sd->sp<cost)return false;sd->sp-=cost;return true;}
int skill_get_sp(uint16,uint16){return 40;}
int skill_get_time(uint16,uint16){return 5000;}
void sc_start(map_session_data*,map_session_data* dst,int,int,int,int){dst->fatigue++;}
void sc_start4(map_session_data*,map_session_data*,int,int,int,int,int,int,int){}
void clif_skill_nodamage(map_session_data*,map_session_data&,uint16,uint16){}
${source.slice(start,end)}
int main(){
 map_session_data a,b,pa,pb;a.id=1;b.id=2;pa.id=3;pb.id=4;
 players={{1,&a},{2,&b},{3,&pa},{4,&pb}};nearby={{1,{3}},{2,{4}}};
 uint16 lv=5;
 assert(skill_check_pc_partner(&a,BD_SIEGFRIED,&lv,1,0)==1);
 assert(skill_check_pc_partner(&b,BD_SIEGFRIED,&lv,1,0)==1);
 assert(skill_check_pc_partner(&a,BD_SIEGFRIED,&lv,3,1)==1);
 assert(a.fatigue==1&&pa.fatigue==1&&pb.fatigue==0&&b.fatigue==0);
 assert(skill_check_pc_partner(&b,BD_SIEGFRIED,&lv,3,1)==1);
 assert(b.fatigue==1&&pb.fatigue==1);
 // Moonlit establishes its caster state before looking for the other performer.
 a.sc.dancing=true;a.sc.entry.val2=77;
 assert(skill_check_pc_partner(&a,CG_MOONLIT,&lv,1,1)==1);
 assert(a.sc.entry.val4==pa.id&&pa.skill_id_dance==CG_MOONLIT&&pa.skill_lv_dance==lv);
 a.sc.dancing=false;
 // Great Echo must find its own current partners even without a preceding search.
 assert(skill_check_pc_partner(&a,WM_GREAT_ECHO,&lv,14,1)==1);
 assert(pa.sp==80&&pb.sp==100);
 // A departing partner must not be charged through a previous cached result.
 nearby[1].clear();
 assert(skill_check_pc_partner(&a,WM_GREAT_ECHO,&lv,14,1)==0);
 assert(pa.sp==80&&pb.sp==100);
 // Shared priest paths must also use the calling character's partners.
 nearby[1]={3};
 assert(skill_check_pc_partner(&a,PR_BENEDICTIO,&lv,1,1)==1);
 assert(pa.sp==70&&pb.sp==100);
 assert(skill_check_pc_partner(&b,AB_ADORAMUS,&lv,1,2)==1);
 assert(pa.sp==70&&pb.sp==90);
 std::cout<<"PASS: independent, current partners for ensemble, chorus and shared costs\\n";
}
`;
 const artifact=resolve(args[0]);
 const build=spawnSync('g++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',artifact],{input:code,encoding:'utf8'});
 if(build.status!==0)throw new Error(build.stderr);
 const result=spawnSync(artifact,[],{encoding:'utf8'});
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
 if(result.status!==0)throw new Error(`Regression failed: ${result.status??result.signal}`);
}
