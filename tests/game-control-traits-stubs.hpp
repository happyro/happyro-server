#include <algorithm>
#include <array>
#include <cassert>
#include <climits>
#include <cstdint>
#include <iostream>
#include <nlohmann/json.hpp>
using int32 = int32_t;
using uint32 = uint32_t;
enum _sp { SP_POW, SP_STA, SP_WIS, SP_SPL, SP_CON, SP_CRT, SP_UPOW, SP_TRAITPOINT = 20 };
constexpr int SCO_FORCE = 1;
struct map_session_data {
    bool class_ = true;
    struct { int base_level = 20; uint32 trait_point = 7; } status;
    std::array<int32, 6> values{};
    int writes = 0;
};
struct { int trait_points_job_change = 7; } battle_config;
struct { uint32 get_trait_table_point(int) { return 0; } } statpoint_db;
bool pc_is_trait_job(bool value) { return value; }
int32 pc_getstat(const map_session_data* sd, int type) { return sd->values.at(type); }
void pc_setstat(map_session_data* sd, int type, int32 value) { sd->values.at(type) = value; ++sd->writes; }
void clif_updatestatus(map_session_data&, _sp) {}
void status_calc_pc(map_session_data*, int) {}
