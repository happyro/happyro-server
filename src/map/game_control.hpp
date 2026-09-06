// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL

#ifndef GAME_CONTROL_HPP
#define GAME_CONTROL_HPP

#include <string>

bool game_control_start(const std::string& socket_path);
void game_control_stop();
void game_control_process();

#endif
