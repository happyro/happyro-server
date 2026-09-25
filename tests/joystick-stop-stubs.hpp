#include <cassert>
#include <cstdint>
#include <iostream>
using int16 = int16_t;
using int32 = int32_t;
using t_tick = int64_t;
constexpr int dirx[] = {0, -1, -1, -1, 0, 1, 1, 1};
constexpr int diry[] = {1, 1, 0, -1, -1, -1, 0, 1};
t_tick gettick() { return 1000; }
struct block_list { int16 x = 100, y = 100; };
struct unit_data {
    struct { int path_pos = 0, path_len = 4; int path[8] = {6, 6, 6, 6}; } walkpath;
    struct { bool force_walk = false, running = false, change_walk_target = true; } state;
    int16 to_x = 104, to_y = 100;
    unsigned char sx = 8, sy = 8;
    int target_to = 0;
    bool stepaction = false;
    bool past_midpoint = false;
    void getpos(int16& x, int16& y, unsigned char&, unsigned char&, t_tick) {
        if (past_midpoint) { x += dirx[walkpath.path[walkpath.path_pos]]; y += diry[walkpath.path[walkpath.path_pos]]; }
    }
};
struct map_session_data : block_list {
    unit_data ud;
    bool dead = false, walking = true;
};
unit_data* unit_bl2ud(block_list* bl) { return &static_cast<map_session_data*>(bl)->ud; }
bool pc_isdead(map_session_data* sd) { return sd->dead; }
bool unit_is_walking(map_session_data* sd) { return sd->walking; }
int broadcasts = 0, acknowledgements = 0;
void clif_move(const unit_data&) { ++broadcasts; }
void clif_walkok(const map_session_data&) { ++acknowledgements; }
void unit_stop_walking_soon(block_list&, t_tick = gettick());
