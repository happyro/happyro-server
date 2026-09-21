int main() {
    using nlohmann::json;
    map_session_data sd;
    assert(game_control_traits_snapshot(&sd)["maximums"]["pow"] == 32767);
    assert(game_control_traits_update(&sd, {{"pow", 292}, {"spl", 32767}}));
    assert(sd.values[SP_POW] == 292 && sd.values[SP_SPL] == 32767);
    assert(sd.status.trait_point == 7);
    assert(game_control_traits_update(&sd, {{"pow", 0}}));
    assert(sd.status.trait_point == 7 && sd.values[SP_SPL] == 32767);
    for (const json& payload : std::vector<json>{json::object(), json::array(),
            {{"pow", -1}}, {{"pow", 32768}}, {{"pow", 1.5}}, {{"pow", "2"}},
            {{"pow", 2}, {"spl", 32768}}, {{"unknown", 2}}}) {
        const auto before = sd.values;
        const auto writes = sd.writes;
        assert(!game_control_traits_update(&sd, payload));
        assert(sd.values == before && sd.writes == writes && sd.status.trait_point == 7);
    }
    game_control_traits_reconcile(&sd, false);
    assert(sd.values[SP_SPL] == 32767 && sd.status.trait_point == 0);
    game_control_traits_reconcile(&sd, true);
    assert(sd.values == (std::array<int32, 6>{}) && sd.status.trait_point == 7);
    sd.class_ = false;
    assert(!game_control_traits_update(&sd, {{"pow", 292}}));
    game_control_traits_reconcile(&sd, false);
    assert(sd.status.trait_point == 0);
    std::cout << "Trait budget bypass, limits, atomic rejection and reset cases passed\n";
}
