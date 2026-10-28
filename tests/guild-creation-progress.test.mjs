import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args=process.argv.slice(2),plain=args.includes('--no-color'),output=args.find(a=>!a.startsWith('--'));
const c=(n,s)=>plain?s:`\x1b[${n}m${s}\x1b[0m`;
if(!output||args.includes('--help')){
 console.log(`\n${c('1;36','Guild creation progression regression')}\n\n${c('1;33','Usage')}\n ${c('1;32','node tests/guild-creation-progress.test.mjs <output>')} [--no-color]\n\n${c('1;33','Example')}\n ${c('36','node tests/guild-creation-progress.test.mjs ../../work/guild-creation-progress')}\n`);
}else{
 const source=readFileSync(new URL('../src/char/int_guild.cpp',import.meta.url),'utf8');
 const begin=source.indexOf('// Initialize progression before persisting');
 const end=source.indexOf('// Create the guild',begin);
 const init=source.slice(begin,end);
 const save=source.slice(end).match(/inter_guild_tosql\([^;]+?\)\)/)[0].slice(0,-1);
 const mapSource=readFileSync(new URL('../src/map/guild.cpp',import.meta.url),'utf8');
 const start=mapSource.indexOf('int32 guild_created(');
 const created=mapSource.slice(start,mapSource.indexOf('\n}',start)+2);
 const code=`#include <cassert>
 constexpr int MAX_GUILDSKILL=20,GD_SKILLBASE=10000,GS_BASIC=1,GS_LEVEL=2,GS_POSITION=4,GS_SKILL=8,GS_MEMBER=16;
 struct Guild{int guild_lv=0,next_exp=0,max_member=0,average_lv=0,connect_member=0,guild_id=0;struct{int id=0;}skill[MAX_GUILDSKILL];};
 struct CharGuild{Guild guild;};struct Master{int lv=99;};
 struct ExpDB{int requested=0;int get_nextexp(int lv){requested=lv;return lv==1?100000:0;}}guild_exp_db;
 int writes=0;Guild saved;
 int inter_guild_tosql(Guild &g,int flags){assert(flags&GS_LEVEL);assert(g.guild_id==-1);saved=g;writes++;return 1;}
 using int32=int;using uint32=unsigned;
 constexpr int ITEMID_EMPERIUM=714,LOG_TYPE_CONSUME=1;
 struct map_session_data{struct{int guild_id=0;}status;}session;
 struct{bool guild_emperium_check=true;}battle_config;
 int inventoryIndex=0,consumed=0;
 map_session_data* map_id2sd(uint32){return &session;}
 void clif_guild_created(map_session_data&,int){}
 int pc_search_inventory(map_session_data*,int){return inventoryIndex;}
 void pc_delitem(map_session_data*,int index,int amount,int,int,int){assert(index>=0);consumed+=amount;}
 ${created}
 int main(){guild_created(1,2);assert(consumed==1);inventoryIndex=5;guild_created(1,2);assert(consumed==2);inventoryIndex=-1;guild_created(1,2);assert(consumed==2);guild_created(1,0);assert(consumed==2);
 CharGuild value;auto g=&value;Master member;auto master=&member;int i;
 ${init}
 assert(g->guild.guild_lv==1);assert(g->guild.next_exp==100000);assert(guild_exp_db.requested==1);
 assert(g->guild.max_member==16);assert(g->guild.average_lv==99);assert(g->guild.connect_member==1);
 ${save};assert(writes==1);assert(saved.guild_lv==1);assert(saved.next_exp==100000);
 }`;
 const binary=resolve(output),compile=spawnSync('c++',['-std=c++17','-x','c++','-','-o',binary],{input:code,encoding:'utf8'});
 if(compile.status!==0)throw Error(compile.stderr);
 if(spawnSync(binary,{stdio:'inherit'}).status!==0)throw Error('Regression failed');
 console.log('PASS: newly created guild has level 1 and database-derived next experience before first save; GS_LEVEL is persisted');
}
