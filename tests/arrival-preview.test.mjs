import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2), plain=args.includes('--no-color');
const options=args.filter(a=>a!=='--no-color');
if(!options.length || options[0]==='--help') {
 const color=(code,text)=>plain?text:`\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36','HappyRO arrival preview regression')}\n\n${color('1;33','Usage')}\n  ${color('1;32','node tests/arrival-preview.test.mjs <output>')} [--no-color]\n\n${color('1;33','Example')}\n  ${color('36','node tests/arrival-preview.test.mjs ../../work/arrival-preview-test')}\n`);
} else {
 if(options.length!==1 || options[0].startsWith('-'))throw Error('Expected one output path');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const read=name=>readFileSync(resolve(root,name),'utf8');
 const source=read('src/map/happyro_navigation.cpp');
 const header=read('src/map/happyro_navigation.hpp');
 const helpers=source.slice(source.indexOf('static bool happyro_safe_arrival_cell('),source.indexOf('HappyroNavigationResult happyro_npc_teleport('));
 const destination=source.slice(source.indexOf('static HappyroNavigationResult happyro_map_destination('));
 const stubs=read('tests/city-arrival-stubs.hpp').replace('struct map_session_data {};',`struct map_session_data {
 long long navigation_preview_tick=0,navigation_teleport_tick=0;
 int mapindex=1,m=0,x=20,y=20;
 struct {int class_=0;} status;
 };`);
 const code=stubs+read('src/map/happyro_default_arrivals.hpp')+`
 using uint16=uint16_t;using uint32=uint32_t;using t_tick=long long;
 `+header.slice(header.indexOf('enum e_happyro_map_teleport_result'),header.indexOf('bool happyro_navigation_teleport_allowed'))+`
 struct { bool navigation_map_channels_enabled=true,navigation_teleport_cross_map=true;int navigation_teleport_cooldown=10; } battle_config;
 constexpr int MAP_NAME_LENGTH_EXT=16,MF_NOWARPTO=1,MF_NOWARP=2,PC_PERM_WARP_ANYWHERE=1,CLR_TELEPORT=0,SETPOS_OK=0,CHAT_SIZE_MAX=256;
 enum e_job { NOVICE=0 };
 bool allowed=true,forbidden=false,can_enter=true;int moves=0,logs=0; t_tick clock_tick=10000;
 t_tick gettick(){return clock_tick;}
 t_tick DIFF_TICK(t_tick a,t_tick b){return a-b;}
 bool happyro_navigation_teleport_allowed(const map_session_data*){return allowed;}
 void safestrncpy(char* d,const char* s,size_t n){std::strncpy(d,s,n);d[n-1]=0;}
 void map_channel_normalize_name(char*,size_t){}
 uint16 mapindex_name2idx(const char* map,void*){return std::strcmp(map,"invalid")==0?0:1;}
 int16 map_mapindex2mapid(uint16){return 0;}
 bool map_getmapflag(int,int){return forbidden;}
 bool pc_has_permission(map_session_data*,int){return false;}
 bool pc_job_can_entermap(e_job,int,int){return can_enter;}
 int pc_get_group_level(map_session_data*){return 0;}
 int pc_setpos(map_session_data* sd,int map,int x,int y,int){++moves;sd->mapindex=map;sd->x=x;sd->y=y;return SETPOS_OK;}
 char atcommand_symbol='@';
 #define safesnprintf std::snprintf
 void log_atcommand(map_session_data*,const char*){++logs;}
 `+helpers+destination+`
 int main(){
 clear_cells();data.xs=data.ys=400;map_session_data sd;sd.navigation_teleport_tick=9999;
 auto result=happyro_map_arrival_preview(&sd,"prt_fild08");assert(result.code==0 && result.x==168 && result.y==373);
 assert(sd.x==20 && sd.y==20 && moves==0 && logs==0 && sd.navigation_teleport_tick==9999);
 assert(happyro_map_arrival_preview(&sd,"prt_fild08").code==HAPPYRO_MAP_TELEPORT_COOLDOWN);
 clock_tick+=500;occupied[373][168]=true;result=happyro_map_arrival_preview(&sd,"prt_fild08");assert(result.code==0 && (result.x!=168 || result.y!=373));
 clock_tick+=500;allowed=false;assert(happyro_map_arrival_preview(&sd,"prt_fild08").code==HAPPYRO_MAP_TELEPORT_DISABLED);allowed=true;
 clock_tick+=500;forbidden=true;assert(happyro_map_arrival_preview(&sd,"prt_fild08").code==HAPPYRO_MAP_TELEPORT_MAP_FORBIDDEN);forbidden=false;
 clock_tick+=500;can_enter=false;assert(happyro_map_arrival_preview(&sd,"prt_fild08").code==HAPPYRO_MAP_TELEPORT_MAP_FORBIDDEN);can_enter=true;
 clock_tick+=500;assert(happyro_map_arrival_preview(&sd,"invalid").code==HAPPYRO_MAP_TELEPORT_INVALID_MAP);
 clock_tick+=500;battle_config.navigation_teleport_cross_map=false;sd.mapindex=2;assert(happyro_map_arrival_preview(&sd,"prt_fild08").code==HAPPYRO_MAP_TELEPORT_CROSS_MAP_DISABLED);battle_config.navigation_teleport_cross_map=true;sd.mapindex=1;
 clock_tick+=500;auto latest=happyro_map_arrival_preview(&sd,"prt_fild08");assert(latest.code==0);
 clock_tick+=20000;occupied[latest.y][latest.x]=true;auto warped=happyro_map_teleport(&sd,"prt_fild08",0,0);assert(warped.code==0 && (warped.x!=latest.x || warped.y!=latest.y));assert(moves==1 && logs==1 && sd.navigation_teleport_tick==clock_tick);
 assert(happyro_safe_arrival_cell(0,sd.x,sd.y));
 std::cout<<"preview permissions, rate limit, no side effects and teleport revalidation passed\\n";
 }
 `;
 const output=resolve(options[0]);
 const build=spawnSync('c++',['-std=c++17','-O1','-fsanitize=address,undefined','-x','c++','-','-o',output],{input:code,stdio:['pipe','inherit','inherit']});
 if(build.status!==0)process.exit(build.status||1);
 const run=spawnSync(output,[],{stdio:'inherit'});process.exit(run.status||(run.signal?1:0));
}
