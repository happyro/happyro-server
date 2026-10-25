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
 void* prev=this;struct {bool active=true,pc_loaded=true,warping=false;} state;
 int npc_id=0;int* st=nullptr;struct {int npc_id=0;} progressbar;
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
 // Closing next/close2 would resume script logic, so an active dialogue must
 // reject the coordinate teleport without moving, logging or starting cooldown.
 clock_tick+=20000;const auto previous_tick=sd.navigation_teleport_tick;
 const auto previous_x=sd.x,previous_y=sd.y;int script_state=1;
 for(int state=0;state<3;++state){
  sd.npc_id=state==0?123:0;sd.st=state==1?&script_state:nullptr;sd.progressbar.npc_id=state==2?123:0;
  auto denied=happyro_map_teleport(&sd,"prt_fild08",168,373);
  assert(denied.code==HAPPYRO_MAP_TELEPORT_DIALOGUE_ACTIVE);
  assert(moves==1 && logs==1 && sd.x==previous_x && sd.y==previous_y && sd.navigation_teleport_tick==previous_tick);
  assert(script_state==1);
 }
 // Read-only previews remain allowed; finishing the dialogue permits a new
 // explicit request, using the existing safe-arrival search.
 clock_tick+=500;assert(happyro_map_arrival_preview(&sd,"prt_fild08").code==HAPPYRO_MAP_TELEPORT_SUCCESS);
 sd.npc_id=0;sd.st=nullptr;sd.progressbar.npc_id=0;
 assert(happyro_map_teleport(&sd,"prt_fild08",168,373).code==HAPPYRO_MAP_TELEPORT_SUCCESS);
 assert(moves==2 && logs==2);
 // A valid coordinate whose entire search radius overlaps an OnTouch region
 // is distinct from an out-of-bounds coordinate, with no mutation on refusal.
 clock_tick+=20000;const auto safe_tick=sd.navigation_teleport_tick;
 const auto safe_x=sd.x,safe_y=sd.y;
 clear_cells();
 for(int y=70;y<=90;++y)for(int x=166;x<=186;++x)touch[y][x]=true;
 auto no_cell=happyro_map_teleport(&sd,"rachel",176,80);
 assert(no_cell.code==HAPPYRO_MAP_TELEPORT_NO_SAFE_CELL);
 assert(moves==2 && logs==2 && sd.x==safe_x && sd.y==safe_y && sd.navigation_teleport_tick==safe_tick);
 assert(happyro_map_teleport(&sd,"rachel",400,80).code==HAPPYRO_MAP_TELEPORT_INVALID_COORDINATE);
 clear_cells();
 for(int y=68;y<=92;++y)for(int x=164;x<=188;++x)occupied[y][x]=true;
 assert(happyro_map_teleport(&sd,"rachel",176,80).code==HAPPYRO_MAP_TELEPORT_NO_SAFE_CELL);
 assert(moves==2 && logs==2 && sd.navigation_teleport_tick==safe_tick);
 clear_cells();
 assert(happyro_map_teleport(&sd,"rachel",176,80).code==HAPPYRO_MAP_TELEPORT_SUCCESS);
 assert(moves==3 && logs==3 && sd.x==176 && sd.y==80);
 clock_tick+=20000;const auto loaded_tick=sd.navigation_teleport_tick;
 for(int phase=0;phase<4;++phase){
  sd.prev=phase==0?nullptr:&sd;sd.state.active=phase!=1;sd.state.pc_loaded=phase!=2;sd.state.warping=phase==3;
  assert(happyro_map_teleport(&sd,"rachel",120,120).code==HAPPYRO_MAP_TELEPORT_MAP_NOT_READY);
  assert(moves==3 && logs==3 && sd.x==176 && sd.y==80 && sd.navigation_teleport_tick==loaded_tick);
 }
 clock_tick+=500;assert(happyro_map_arrival_preview(&sd,"prt_fild08").code==HAPPYRO_MAP_TELEPORT_SUCCESS);
 sd.prev=&sd;sd.state={true,true,false};
 assert(happyro_map_teleport(&sd,"rachel",120,120).code==HAPPYRO_MAP_TELEPORT_SUCCESS);
 assert(moves==4 && logs==4 && sd.x==120 && sd.y==120);
 std::cout<<"preview permissions, rate limit, no side effects and teleport revalidation passed\\n";
 }
 `;
 const output=resolve(options[0]);
 const build=spawnSync('c++',['-std=c++17','-O1','-fsanitize=address,undefined','-x','c++','-','-o',output],{input:code,stdio:['pipe','inherit','inherit']});
 if(build.status!==0)process.exit(build.status||1);
 const run=spawnSync(output,[],{stdio:'inherit'});process.exit(run.status||(run.signal?1:0));
}
