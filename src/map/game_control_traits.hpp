// Copyright (c) HappyRO - Licensed under GNU GPL
#pragma once

#include <nlohmann/json.hpp>

struct map_session_data;

nlohmann::json game_control_traits_snapshot(const map_session_data* sd);
bool game_control_traits_update(map_session_data* sd, const nlohmann::json& payload);
void game_control_traits_reconcile(map_session_data* sd, bool reset = false);
void game_control_base_stats_reset(map_session_data* sd);
