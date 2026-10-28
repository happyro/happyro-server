import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args=process.argv.slice(2), output=args.find(a=>!a.startsWith('--')), plain=args.includes('--no-color');
const c=(n,s)=>plain?s:`\x1b[${n}m${s}\x1b[0m`;
if(!output||args.includes('--help')){
 console.log(`\n${c('1;36','Guild membership clearing regression')}\n\n${c('1;33','Usage')}\n ${c('1;32','node tests/guild-membership-clear.test.mjs <output>')} [--no-color]\n\n${c('1;33','Example')}\n ${c('36','node tests/guild-membership-clear.test.mjs ../../work/guild-membership-clear')}\n`);
}else{
 const source=readFileSync(new URL('../src/map/guild.cpp',import.meta.url),'utf8');
 const extract=(type,name)=>{const start=source.indexOf(`${type} ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);};
 const code=`#include <cassert>
#include <cstring>
#define RENEWAL
using int32=int;
struct Guild;
struct map_session_data {struct{int guild_id=2,account_id=1,char_id=1;char name[24]="member";}status;struct{int gmaster_flag=0;}state;Guild* guild=nullptr;int guild_alliance=4,guild_alliance_account=10;} users[2];
using TBL_PC=map_session_data;
struct Guild{struct{char master[24]="master";struct{map_session_data* sd=nullptr;}member[2];}guild;}current;
struct s_mapiterator{int index=0;}iterator;
s_mapiterator* mapit_getallusers(){iterator.index=0;return &iterator;}
void* mapit_first(s_mapiterator*){return &users[0];}bool mapit_exists(s_mapiterator* i){return i->index<2;}
void* mapit_next(s_mapiterator* i){return ++i->index<2?&users[i->index]:nullptr;}void mapit_free(s_mapiterator*){}
Guild* guild_search(int id){return id==2?&current:nullptr;}
void guild_request_info(int){}int memberIndex=0;template<class T>int guild_getindex(T&,int,int){return memberIndex;}
void clif_name_area(map_session_data*){}void channel_gjoin(map_session_data*,int){}
constexpr int CHAN_OPT_AUTOJOIN=1;struct{struct{char name[1]={0};int opt=0;}ally_tmpl;}channel_config;
${extract('int32','guild_recv_noinfo')}
${extract('void','guild_member_joined')}
int main(){
 users[1].status.guild_id=3;guild_recv_noinfo(2);
 assert(users[0].status.guild_id==0&&users[0].guild_alliance==0&&users[0].guild_alliance_account==0);
 assert(users[1].status.guild_id==3&&users[1].guild_alliance==4&&users[1].guild_alliance_account==10);
 users[0]=map_session_data{};guild_member_joined(&users[0]);
 assert(users[0].status.guild_id==2&&users[0].guild==&current&&users[0].guild_alliance==4);
 assert(current.guild.member[0].sd==&users[0]);
 memberIndex=-1;guild_member_joined(&users[0]);assert(users[0].status.guild_id==0&&users[0].guild_alliance==0&&users[0].guild_alliance_account==0);
 }`;
 const binary=resolve(output),compile=spawnSync('c++',['-std=c++17','-x','c++','-','-o',binary],{input:code,encoding:'utf8'});
 if(compile.status!==0)throw Error(compile.stderr);
 if(spawnSync(binary,{stdio:'inherit'}).status!==0)throw Error('Regression failed');
 console.log('PASS: unrelated guild members and valid joins retain membership; only removed memberships clear pending alliances');
}
