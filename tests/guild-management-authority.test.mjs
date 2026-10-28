import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args = process.argv.slice(2), output = args.find(a => !a.startsWith('--')), plain = args.includes('--no-color');
const color = (n, s) => plain ? s : `\x1b[${n}m${s}\x1b[0m`;
if (!output || args.includes('--help')) {
 console.log(`\n${color('1;36', 'Guild management authority regression')}\n\n${color('1;33', 'Usage')}\n ${color('1;32', 'node tests/guild-management-authority.test.mjs <output>')} [--no-color]\n\n${color('1;33', 'Example')}\n ${color('36', 'node tests/guild-management-authority.test.mjs ../../work/guild-management-authority')}\n`);
} else {
 const source = readFileSync(new URL('../src/map/guild.cpp', import.meta.url), 'utf8');
 const extract = (type, name) => { const start = source.indexOf(`${type} ${name}(`); return source.slice(start, source.indexOf('\n}', start) + 2); };
 const code = `#include <cassert>
using int32=int;using uint32=unsigned;
constexpr int MF_GUILDLOCK=1,MAX_GUILDALLIANCE=4;
#define nullpo_ret(p) if(!(p))return 0
struct Guild { int instance_id=0; struct { struct{int guild_id=0,opposition=0;}alliance[4]; }guild; } ga,gb;
struct map_session_data { Guild* guild=nullptr; struct{int account_id=0,char_id=0,guild_id=0;}status; struct{bool gmaster_flag=false;}state; int m=0,fd=1,bg_id=0,guild_alliance=0;uint32 guild_alliance_account=0; } inviter,receiver;
struct {bool instance_block_leave=false,guild_alliance_onlygm=true;int max_guild_alliance=4;}battle_config;
int leaves=0,alliances=0,acks=0,messages=0;bool siege=false,connected=true;bool is_agit_start(){return siege;}
bool map_getmapflag(int,int){return false;}bool map_flag_gvg2(int){return false;}
const char* msg_txt(map_session_data*,int){return "message";}void clif_displaymessage(int,const char*){messages++;}
void guild_trade_bound_cancel(map_session_data&){}
bool intif_guild_leave(int,int,int,int,const char*){leaves++;return true;}
map_session_data* map_id2sd(uint32 aid){return connected&&aid==10?&inviter:nullptr;}
void clif_guild_allianceack(map_session_data&,int){acks++;}
template<class T>int guild_get_alliance_count(T&,int){return 0;}
void intif_guild_alliance(int,int,int,int,int flag){assert(flag==0);alliances++;}
${extract('bool','guild_leave')}
${extract('int32','guild_reply_reqalliance')}
void prepare(){inviter.guild=&ga;inviter.status={10,100,1};inviter.state.gmaster_flag=true;receiver.guild=&gb;receiver.status={20,200,2};receiver.state.gmaster_flag=true;receiver.guild_alliance=1;receiver.guild_alliance_account=10;}
int main(){
 prepare();assert(!guild_leave(inviter,1,10,100,""));assert(leaves==0&&messages==1);
 inviter.state.gmaster_flag=false;assert(!guild_leave(inviter,1,20,200,""));assert(leaves==0);
 assert(guild_leave(inviter,1,10,100,""));assert(leaves==1);
 prepare();guild_reply_reqalliance(&receiver,10,1);assert(alliances==1);
 prepare();receiver.guild_alliance=0;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1);
 prepare();receiver.guild_alliance_account=11;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1);
 prepare();inviter.state.gmaster_flag=false;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1&&receiver.guild_alliance==0);
 prepare();receiver.state.gmaster_flag=false;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1&&receiver.guild_alliance==0);
 prepare();guild_reply_reqalliance(&receiver,10,2);assert(alliances==1);
 prepare();guild_reply_reqalliance(&receiver,10,0);assert(alliances==1&&receiver.guild_alliance==0);
 prepare();siege=true;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1&&receiver.guild_alliance==0);
 prepare();guild_reply_reqalliance(&receiver,10,0);assert(receiver.guild_alliance==0);siege=false;
 prepare();connected=false;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1&&receiver.guild_alliance==0);connected=true;
 prepare();receiver.status.guild_id=1;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1&&receiver.guild_alliance==0);
 prepare();receiver.status.guild_id=0;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1&&receiver.guild_alliance==0);
 prepare();inviter.status.guild_id=3;guild_reply_reqalliance(&receiver,10,1);assert(alliances==1&&receiver.guild_alliance==0);
 prepare();battle_config.guild_alliance_onlygm=false;receiver.state.gmaster_flag=false;guild_reply_reqalliance(&receiver,10,1);assert(alliances==2);
 }`;
 const binary = resolve(output), compile = spawnSync('c++', ['-std=c++17', '-x', 'c++', '-', '-o', binary], { input: code, encoding: 'utf8' });
 if (compile.status !== 0) throw Error(compile.stderr);
 if (spawnSync(binary, { stdio: 'inherit' }).status !== 0) throw Error('Regression failed');
 console.log('PASS: guild leader cannot leave; alliance replies require exact pending inviter and current authority');
}
