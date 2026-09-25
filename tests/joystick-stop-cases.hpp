int main() {
    for (bool past_midpoint : {false, true}) {
        map_session_data sd;
        sd.ud.past_midpoint = past_midpoint;
        broadcasts = acknowledgements = 0;
        clif_parse_happyro_stop_move(0, &sd);
        assert(sd.ud.walkpath.path_len == (past_midpoint ? 2 : 1));
        assert(sd.ud.to_x == (past_midpoint ? 102 : 101));
        assert(sd.ud.to_y == 100);
        assert(sd.x == 100 && sd.y == 100); // The stop never rewinds or teleports the player.
        assert(!sd.ud.state.change_walk_target);
        assert(broadcasts == 1 && acknowledgements == 1);
        clif_parse_happyro_stop_move(0, &sd);
        assert(broadcasts == 1 && acknowledgements == 1); // Repeats do not restart the short route.
    }
    {
        map_session_data sd;
        sd.ud.past_midpoint = true;
        sd.ud.walkpath.path[1] = 7;
        clif_parse_happyro_stop_move(0, &sd);
        assert(sd.ud.to_x == 102 && sd.ud.to_y == 101); // Follow the existing turn, not a client coordinate.
    }
    {
        map_session_data sd;
        sd.ud.walkpath.path_pos = 2;
        sd.ud.walkpath.path_len = 3;
        sd.ud.to_x = 120; // A queued redirect must be cleared even on the last cell.
        broadcasts = acknowledgements = 0;
        clif_parse_happyro_stop_move(0, &sd);
        assert(sd.ud.to_x == 101 && !sd.ud.state.change_walk_target);
        assert(broadcasts == 0 && acknowledgements == 0);
    }
    for (int state = 0; state < 6; ++state) {
        map_session_data sd;
        if (state == 0) sd.dead = true;
        if (state == 1) sd.walking = false;
        if (state == 2) sd.ud.state.force_walk = true;
        if (state == 3) sd.ud.state.running = true;
        if (state == 4) sd.ud.stepaction = true;
        if (state == 5) sd.ud.target_to = 42;
        broadcasts = acknowledgements = 0;
        clif_parse_happyro_stop_move(0, &sd);
        assert(sd.ud.walkpath.path_len == 4 && sd.ud.to_x == 104);
        assert(broadcasts == 0 && acknowledgements == 0);
    }
    std::cout << "Joystick stop: forward route, turns, repeated stops and protected actions passed\n";
}
