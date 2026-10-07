#include <algorithm>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <nlohmann/json.hpp>
using int32 = int32_t; using int64 = int64_t; using uint32 = uint32_t; using uint64 = uint64_t;
constexpr int JOB_MAX=5000, JOB_WEDDING=100, JOB_XMAS=101, JOB_SUMMER=102;
constexpr int SP_BASELEVEL=1, SP_JOBLEVEL=2, SP_HP=3, SP_SP=4, SP_STATUSPOINT=5, SP_AP=6, CSAVE_NORMAL=0;
struct map_session_data {
 struct { int class_=1, base_level=99, job_level=1, sex=0, char_id=42; uint32 status_point=1000,skill_point=0; } status;
 struct { int max_hp=100,max_sp=50,max_ap=200,ap=30; } battle_status;
 int saves=0,writes=0;
};
uint64 pc_jobid2mapid(int job){return job;}
int pc_mapid2jobid(uint64 job,int){return job;}
bool pc_is_trait_job(uint64 job){return job==4;}
struct Jobs {
 bool exists(int job){return job==1||job==3||job==4;}
 int get_maxBaseLv(int job){return job==1?99:275;}
 int get_maxJobLv(int){return 70;}
} job_db;
struct Points {uint32 get_table_point(int level){return level*5;}} statpoint_db;
uint32 extra_job_skill_points(map_session_data*){return 0;}
void reset_job_change_levels(map_session_data*){}
void reconcile_job_skill_points(map_session_data*,uint32){}
void game_control_traits_reconcile(map_session_data*){}
void game_control_base_stats_reset(map_session_data* sd){sd->status.status_point=0;}
void clif_updatestatus(map_session_data&,int){}
bool pc_isdead(map_session_data*){return false;}
void status_revive(map_session_data*,int,int,int ap){assert(ap==100);}
void chrif_save(map_session_data* sd,int){sd->saves++;}
void pc_setparam(map_session_data* sd,int type,int value){
 sd->writes++;
 if(type==SP_AP)sd->battle_status.ap=value;
 if(type==SP_BASELEVEL)sd->status.base_level=std::min(value,job_db.get_maxBaseLv(sd->status.class_));
 if(type==SP_JOBLEVEL)sd->status.job_level=value;
}
bool pc_jobchange(map_session_data* sd,int job,int){
 sd->writes++;sd->status.class_=job;sd->status.job_level=1;
 sd->status.base_level=std::min(sd->status.base_level,job_db.get_maxBaseLv(job));return true;
}
