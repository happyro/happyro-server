import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const args=process.argv.slice(2), plain=args.includes('--no-color'), options=args.filter(x=>x!=='--no-color');
if(!options.length || options[0]==='--help') {
 const c=(code,text)=>plain?text:`\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${c('1;36','HappyRO registration error tests')}\n\n${c('1;33','Usage')}\n  ${c('1;32','node tests/registration-errors.test.mjs <artifact-path>')} [--no-color]\n\n${c('1;33','Example')}\n  ${c('36','node tests/registration-errors.test.mjs ../../work/registration-errors/test --no-color')}\n`);
} else {
 if(options.length!==1||options[0].startsWith('-')) throw Error('Expected one artifact path');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const source=readFileSync(resolve(root,'src/login/login.cpp'),'utf8');
 const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);if(a<0||b<0)throw Error('Missing registration function');return source.slice(a,b);};
 const code=`#include <cassert>
#include <cstring>
#include <ctime>
#include <cctype>
#include <iostream>
#include "registration.hpp"
using int32=int; using t_tick=long long;
t_tick now=1000; t_tick gettick(){return now;}
#define DIFF_TICK(a,b) ((a)-(b))
#define ShowNotice(...) ((void)0)
#define MIN_CHARS 9
#define NAME_LENGTH 24
#define TOUPPER(c) std::toupper(c)
struct Config {int allowed_regs=1,acc_name_min_length=6,password_min_length=6,start_limited_time=-1,time_allowed=60;bool new_account_flag=true;} login_config;
struct mmo_account {int account_id,char_slots; char sex; char userid[24],pass[33],email[40],lastlogin[24],last_ip[24],birthdate[24],pincode[24]; time_t expiration_time,pincode_change;};
void safestrncpy(char* dst,const char* src,size_t n){std::strncpy(dst,src,n);dst[n-1]=0;}
bool exists=false,can_create=true;int creation_count=0;
struct AccountDB { bool (*load_str)(AccountDB*,mmo_account*,const char*); bool (*create)(AccountDB*,mmo_account*);};
AccountDB db{[](AccountDB*,mmo_account*,const char*){return exists;},[](AccountDB*,mmo_account*){++creation_count;return can_create;}};auto* accounts=&db;
struct login_session_data {char userid[24],passwd[33];int passwdenc;};
`+extract('int32 login_mmo_auth_new(', '\n/**')+
`int registration_request(login_session_data* sd){bool isServer=false;size_t len=strnlen(sd->userid,NAME_LENGTH);const char* ip="127.0.0.1";\n`+
extract('\t// Recognize registration intent', '\n\tif( !accounts->load_str')+'return -1;\n}\n'+readFileSync(resolve(root,'tests/registration-errors-cases.hpp'),'utf8');
 const output=resolve(options[0]);
 const build=spawnSync('c++',['-std=c++17','-O1','-fsanitize=address,undefined','-I',resolve(root,'src/login'),'-x','c++','-','-o',output],{input:code,stdio:['pipe','inherit','inherit']});
 if(build.status!==0)process.exit(build.status||1);
 const run=spawnSync(output,[],{stdio:'inherit'});process.exit(run.status||(run.signal?1:0));
}
