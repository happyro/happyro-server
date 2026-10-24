#include <algorithm>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <nlohmann/json.hpp>
using int32 = int32_t;
using int64 = int64_t;
constexpr int SP_SKILLPOINT = 1, SP_STATUSPOINT = 2, SP_TRAITPOINT = 3, CSAVE_NORMAL = 0;
constexpr uint64_t TRAIT_JOB = 1;
bool pc_is_trait_job(uint64_t job) { return job == TRAIT_JOB; }
struct map_session_data {
    struct { int char_id = 42; uint32_t skill_point = 10, status_point = 20, trait_point = 30; } status;
    uint64_t class_ = 0;
    int writes = 0, saves = 0;
};
void pc_setparam(map_session_data* sd, int parameter, int32 value) {
    ++sd->writes;
    if (parameter == SP_SKILLPOINT) sd->status.skill_point = value;
    else if (parameter == SP_STATUSPOINT) sd->status.status_point = value;
    else if (parameter == SP_TRAITPOINT) sd->status.trait_point = value;
    else assert(false);
}
void chrif_save(map_session_data* sd, int) { ++sd->saves; }
