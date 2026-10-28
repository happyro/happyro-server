import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args = process.argv.slice(2), output = args.find(a => !a.startsWith('--')), plain = args.includes('--no-color');
const color = (n, s) => plain ? s : `\x1b[${n}m${s}\x1b[0m`;
if (!output || args.includes('--help')) {
 console.log(`\n${color('1;36', 'Guild membership persistence regression')}\n\n${color('1;33', 'Usage')}\n ${color('1;32', 'node tests/guild-membership-persistence.test.mjs <output>')} [--no-color]\n\n${color('1;33', 'Example')}\n ${color('36', 'node tests/guild-membership-persistence.test.mjs ../../work/guild-persistence')}\n`);
} else {
 const source = readFileSync(new URL('../src/char/int_guild.cpp', import.meta.url), 'utf8');
 const extract = name => {const start=source.indexOf(`int32 ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);};
 const memberStart=source.indexOf('\tif (flag&GS_MEMBER)');
 const memberSave=source.slice(memberStart,source.indexOf('\tif (flag&GS_POSITION)',memberStart));
 const code=`#include <cassert>
#include <cstring>
#include <cstdint>
#include <cinttypes>
#include <cstdarg>
#include <ctime>
#include <memory>
#include <unordered_map>
#include <algorithm>
using int32=int;using int16=short;using uint32=unsigned;using t_exp=uint64_t;
constexpr int GS_MEMBER_UNMODIFIED=0,GS_MEMBER_MODIFIED=1,GS_MEMBER_NEW=2,GS_MEMBER=4,GS_LEVEL=8,GS_BASIC=16,NAME_LENGTH=24;
constexpr int GMI_POSITION=1,GMI_EXP=2,GMI_HAIR=3,GMI_HAIR_COLOR=4,GMI_GENDER=5,GMI_CLASS=6,GMI_LEVEL=7,GBI_EXP=8,SQL_ERROR=-1;
constexpr t_exp MAX_GUILD_EXP=2147483647;
struct guild_member {int account_id=0,char_id=0,position=0,modified=0,hair=0,hair_color=0,gender=0,class_=0,lv=0; t_exp exp=0;char name[24]{};};
struct mmo_guild {int guild_id=6,max_member=2;guild_member member[2];char master[24]{},name[24]{};time_t last_leader_change=0;t_exp exp=0;};
struct CharGuild {mmo_guild guild;int save_flag=0;};auto fixture=std::make_shared<CharGuild>();
struct mmo_charstatus {int guild_id=6;};std::unordered_map<unsigned,std::shared_ptr<mmo_charstatus>> chars;
auto& char_get_chardb(){return chars;}
namespace util {template<class M,class K> auto umap_find(M& m,K k)->typename M::mapped_type {auto i=m.find(k);return i==m.end()?nullptr:i->second;} template<class T>T safe_addition_cap(T a,T b,T cap){return std::min(a+b,cap);}}
auto inter_guild_fromsql(int id){return id==6?fixture:nullptr;}
struct {const char* guild_member_db="members";const char* char_db="chars";}schema_config;
struct {int guild_exp_rate=100;}charserv_config;
int sql_handle=0,sqlGuild=6;bool fail=false;
int Sql_Query(int,const char* format,...){if(fail)return SQL_ERROR;va_list a;va_start(a,format);const char* table=va_arg(a,const char*);(void)table;if(strstr(format,"UPDATE")){if(strstr(format,"'0'"))sqlGuild=0;else sqlGuild=va_arg(a,int);}va_end(a);return 0;}
void Sql_ShowDebug(int){}
#define ShowWarning(...) ((void)0)
#define ShowError(...) ((void)0)
#define ShowInfo(...) ((void)0)
void safestrncpy(char* d,const char* s,int n){if(n){std::strncpy(d,s,n);d[n-1]=0;}}
void mapif_guild_memberinfochanged(int,uint32,uint32,int,const void*,int){}
void mapif_guild_basicinfochanged(int,int,const void*,int){}
int guild_calcinfo(std::shared_ptr<CharGuild>){return 0;}
int mapif_guild_master_changed(mmo_guild&,int,int,time_t){return 0;}
${extract('inter_guild_removemember_tosql')}
${extract('mapif_parse_GuildMemberInfoChange')}
${extract('mapif_parse_GuildMasterChange')}
void saveMembers(mmo_guild& g){int flag=GS_MEMBER,i=0,new_guild=0;char t_info[64]{};${memberSave}}
int main(){
 chars[2]=std::make_shared<mmo_charstatus>();
 fail=true;assert(inter_guild_removemember_tosql(2)==-1);assert(chars[2]->guild_id==6);fail=false;
 assert(inter_guild_removemember_tosql(2)==0);assert(sqlGuild==0);assert(chars[2]->guild_id==0);
 auto& g=fixture->guild;g.member[0].account_id=1;g.member[0].char_id=1;strcpy(g.member[0].name,"Leader");
 g.member[1].account_id=2;g.member[1].char_id=2;g.member[1].modified=GS_MEMBER_NEW|GS_MEMBER_MODIFIED;strcpy(g.member[1].name,"NewMaster");
 short rank=19;mapif_parse_GuildMemberInfoChange(0,6,2,2,GMI_POSITION,(char*)&rank,sizeof(rank));assert(g.member[1].modified&GS_MEMBER_NEW);
 mapif_parse_GuildMasterChange(0,6,"NewMaster",10);assert(g.member[0].char_id==2);assert(g.member[0].modified&GS_MEMBER_NEW);
 t_exp exp=10;mapif_parse_GuildMemberInfoChange(0,6,2,2,GMI_EXP,(char*)&exp,sizeof(exp));assert(g.member[0].modified&GS_MEMBER_NEW);
 saveMembers(g);assert(sqlGuild==6);assert(g.member[0].modified==GS_MEMBER_UNMODIFIED);
}`;
 const binary=resolve(output),compiled=spawnSync('c++',['-std=c++17','-x','c++','-','-o',binary],{input:code,encoding:'utf8'});
 if(compiled.status!==0)throw Error(compiled.stderr);
 if(spawnSync(binary,{stdio:'inherit'}).status!==0)throw Error('Persistence regression failed');
 console.log('PASS: leave updates the character cache; position, experience and leadership changes retain new membership until SQL persistence');
}
