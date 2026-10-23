import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const args = process.argv.slice(2), plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
if (!options.length || options[0] === '--help') {
 console.log(`\n${color('1;36', 'Job change riding regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/job-change-riding.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/job-change-riding.test.mjs /tmp/job-change-riding')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw Error('Expected artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const read = file => readFileSync(resolve(root, file), 'utf8');
 const source = read('src/map/pc.cpp'), map = read('src/map/map.hpp'), status = read('src/map/status.hpp');
 const cleanup = source.slice(source.indexOf('\t// Cross-tree changes'), source.indexOf('\n\tif (sd->sc.getSCE(SC_SPRITEMABLE)', source.indexOf('\t// Cross-tree changes')));
 const optionStart = source.indexOf('\tif( (type&OPTION_RIDING', source.indexOf('void pc_setoption('));
 const optionEnd = source.indexOf('\n\tif (type&OPTION_FLYING', optionStart);
 const code = `#include <cassert>
#include <cstdint>
#include <map>
#include <set>
#include <vector>
#include <iostream>
using uint64=uint64_t; using uint32=uint32_t; using uint16=uint16_t;
${map.slice(map.indexOf('#define JOBL_2_1'), map.indexOf('//Max size for inputs'))}
${status.slice(status.indexOf('enum e_option :'), status.indexOf('///Defines for the manner'))}
enum {KN_RIDING,HT_FALCON,RK_DRAGONTRAINING,RA_WUGMASTERY,RA_WUGRIDER,MC_PUSHCART,AM_CALLHOMUN,WH_HAWK_M,SC_PUSH_CART,SC_MADOGEAR,EFST_RIDING,EFST_FALCON,EFST_WUGRIDER,SCO_NONE,HOM_ST_ACTIVE,INFINITE_TICK};
struct Tree {std::map<int,int> skills;};
struct Trees {std::map<int,Tree> values; Tree* find(int job){auto it=values.find(job);return it==values.end()?nullptr:&it->second;}} skill_tree_db;
struct State {int option=0;bool cart=false,mado=false;bool getSCE(int id){return id==SC_PUSH_CART?cart:mado;}};
struct Player {uint64 class_=0;struct {int class_=0;} status;State sc;std::set<int> skills;bool hd=false;int cart_items=4;std::vector<std::pair<int,int>> icons;};
int pc_checkskill(Player* sd,int skill){return sd->skills.count(skill);}
void clif_status_load(Player* sd,int icon,int enabled){sd->icons.emplace_back(icon,enabled);}
void status_calc_pc(Player*,int){}
void clif_cartlist(Player*){} void clif_updatestatus(Player&,int){} void clif_clearcart(int){}
void sc_start(Player* sd,Player*,int,int,int,int){sd->sc.mado=true;}
void status_change_end(Player* sd,int){sd->sc.mado=false;}
void pc_setoption(Player* sd,int type){int p_type=sd->sc.option,subtype=0;sd->sc.option=type;
${source.slice(optionStart,optionEnd)}
}
void pc_setcart(Player* sd,int type){sd->sc.cart=type;}
bool hom_is_active(bool hd){return hd;}
void hom_vaporize(Player* sd,int){sd->hd=false;}
void cleanup(Player* sd){int i;
${cleanup}
}
Player player(int job,int option,std::initializer_list<int> learned){Player p;p.class_=p.status.class_=job;p.sc.option=option;p.skills=learned;return p;}
void tree(int job,std::initializer_list<int> skills){for(int skill:skills)skill_tree_db.values[job].skills[skill]=1;}
int main(){
 tree(MAPID_KNIGHT,{KN_RIDING});tree(MAPID_LORD_KNIGHT,{KN_RIDING});tree(MAPID_RUNE_KNIGHT,{RK_DRAGONTRAINING,KN_RIDING});tree(MAPID_ROYAL_GUARD,{KN_RIDING});
 tree(MAPID_HUNTER,{HT_FALCON});tree(MAPID_WINDHAWK,{WH_HAWK_M,HT_FALCON,RA_WUGMASTERY,RA_WUGRIDER});tree(MAPID_RANGER,{RA_WUGMASTERY,RA_WUGRIDER,HT_FALCON});
 tree(MAPID_MERCHANT,{MC_PUSHCART});tree(MAPID_MECHANIC,{MC_PUSHCART});
 // Old or GM-granted skills do not grant the new class a mount or follower.
 for(int option:{OPTION_RIDING,OPTION_DRAGON1,OPTION_DRAGON5,OPTION_FALCON,OPTION_WUG,OPTION_WUGRIDER,OPTION_MADOGEAR}){
  auto p=player(MAPID_ACOLYTE,option|OPTION_INVISIBLE,{KN_RIDING,RK_DRAGONTRAINING,HT_FALCON,RA_WUGMASTERY,RA_WUGRIDER,MC_PUSHCART,AM_CALLHOMUN});p.sc.cart=true;p.hd=true;p.sc.mado=true;
  cleanup(&p);assert(p.sc.option==OPTION_INVISIBLE);assert(!p.sc.cart);assert(!p.hd);assert(p.cart_items==4);
 }
 // Valid related classes retain usable attachments; dragons do not become pecos.
 for(int job:{MAPID_KNIGHT,MAPID_LORD_KNIGHT,MAPID_ROYAL_GUARD}){auto p=player(job,OPTION_RIDING,{KN_RIDING});cleanup(&p);assert(p.sc.option==OPTION_RIDING);}
 auto dragon=player(MAPID_RUNE_KNIGHT,OPTION_DRAGON5,{RK_DRAGONTRAINING});cleanup(&dragon);assert(dragon.sc.option==OPTION_DRAGON5);
 auto peco=player(MAPID_RUNE_KNIGHT,OPTION_RIDING,{KN_RIDING,RK_DRAGONTRAINING});cleanup(&peco);assert(!peco.sc.option);
 auto wolf=player(MAPID_RANGER,OPTION_WUGRIDER|OPTION_WUG,{RA_WUGMASTERY});cleanup(&wolf);assert(wolf.sc.option==OPTION_WUG);
 auto hawk=player(MAPID_WINDHAWK,OPTION_FALCON,{WH_HAWK_M});cleanup(&hawk);assert(hawk.sc.option==OPTION_FALCON);
 auto missing=player(MAPID_WINDHAWK,OPTION_FALCON,{HT_FALCON});cleanup(&missing);assert(!missing.sc.option);
 auto cart=player(MAPID_MECHANIC,OPTION_MADOGEAR,{MC_PUSHCART});cart.sc.cart=true;cart.sc.mado=true;cleanup(&cart);assert(cart.sc.cart&&!cart.sc.mado&&cart.cart_items==4);
 // Dismount notifications must survive removal of the prerequisite skill.
 for(int option:{OPTION_RIDING,OPTION_DRAGON1,OPTION_DRAGON5,OPTION_FALCON,OPTION_WUGRIDER}){
  auto p=player(MAPID_ACOLYTE,option,{});cleanup(&p);assert(!p.sc.option);
  int icon=option==OPTION_FALCON?EFST_FALCON:option==OPTION_WUGRIDER?EFST_WUGRIDER:EFST_RIDING;
  assert((p.icons==std::vector<std::pair<int,int>>{{icon,0}}));
 }
 std::cout<<"PASS: cross-job attachments, preserved valid mounts/cart contents, missing skills and status removal packets\\n";
}
`;
 const build=spawnSync('g++',['-std=c++17','-DNEW_CARTS','-fsanitize=address,undefined','-x','c++','-','-o',resolve(options[0])],{input:code,stdio:['pipe','inherit','inherit']});
 if(build.status!==0)process.exit(build.status||1);
 const run=spawnSync(resolve(options[0]),[],{stdio:'inherit'});process.exit(run.status||(run.signal?1:0));
}
