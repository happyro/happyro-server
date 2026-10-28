import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args = process.argv.slice(2), output = args.find(a => !a.startsWith('--')), plain = args.includes('--no-color');
const color = (n, s) => plain ? s : `\x1b[${n}m${s}\x1b[0m`;
if (!output || args.includes('--help')) {
 console.log(`\n${color('1;36', 'Guild permission refresh regression')}\n\n${color('1;33', 'Usage')}\n ${color('1;32', 'node tests/guild-permission-refresh.test.mjs <output>')} [--no-color]\n\n${color('1;33', 'Example')}\n ${color('36', 'node tests/guild-permission-refresh.test.mjs ../../work/guild-permission-refresh')}\n`);
} else {
 const source = readFileSync(new URL('../src/map/guild.cpp', import.meta.url), 'utf8');
 const extract = name => { const start = source.indexOf(`int32 ${name}(`); return source.slice(start, source.indexOf('\n}', start) + 2); };
 const code = `#include <cassert>
#include <cstring>
using int32=int;
constexpr int GUILD_PERM_STORAGE=256;
struct map_session_data { int id; struct {int storage_flag=0;}state; } a{0},b{1};
struct guild_position { int mode; };
struct mmo_guild { int max_member=3; struct { int position; map_session_data* sd; } member[3]={{19,&a},{19,&b},{19,nullptr}}; guild_position position[20]{}; };
struct MapGuild { mmo_guild guild; } value;
int refresh[2]={}, names[2]={}, memberNotice=0, rankNotice=0;
MapGuild* guild_search(int id){return id==1?&value:nullptr;}
void clif_guild_memberpositionchanged(mmo_guild&,int){memberNotice++;}
void clif_guild_positionchanged(mmo_guild&,int){rankNotice++;}
void clif_guild_position_selected(map_session_data& sd){names[sd.id]++;}
void clif_guild_belonginfo(map_session_data& sd){refresh[sd.id]++;}
int closes=0;
void storage_guild_storageclose(map_session_data* sd){closes++;sd->state.storage_flag=0;}
${extract('guild_memberposition_changed')}
${extract('guild_position_changed')}
int main(){
 a.state.storage_flag=2;
 guild_memberposition_changed(value.guild,0,1);
 assert(closes==1 && a.state.storage_flag==0);
 assert(value.guild.member[0].position==1);assert(memberNotice==1);assert(refresh[0]==1&&refresh[1]==0);
 guild_position p{17};guild_position_changed(1,1,&p);
 assert(value.guild.position[1].mode==17);assert(rankNotice==1);assert(refresh[0]==2&&refresh[1]==0);
 a.state.storage_flag=2; p.mode=GUILD_PERM_STORAGE;guild_position_changed(1,1,&p);assert(closes==1 && a.state.storage_flag==2);refresh[0]--;names[0]--;
 p.mode=0;guild_position_changed(1,1,&p);assert(value.guild.position[1].mode==0);assert(refresh[0]==3);assert(closes==2 && a.state.storage_flag==0);
 guild_position_changed(1,19,&p);assert(refresh[1]==1);assert(names[0]==3&&names[1]==1);
 guild_position_changed(999,19,&p);assert(refresh[1]==1);
 }`;
 const binary = resolve(output);
 const compile = spawnSync('c++', ['-std=c++17', '-x', 'c++', '-', '-o', binary], { input: code, encoding: 'utf8' });
 if (compile.status !== 0) throw Error(compile.stderr);
 if (spawnSync(binary, { stdio: 'inherit' }).status !== 0) throw Error('Regression failed');
 console.log('PASS: member position changes and permission grants/revocations refresh affected online members only');
}
