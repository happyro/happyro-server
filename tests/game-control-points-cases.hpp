int main() {
    using nlohmann::json;
    for (const json& payload : std::vector<json>{json::object(), json::array(),
            {{"skill_points", 5}, {"status_points", -1}},
            {{"skill_points", 32768}, {"status_points", 5}},
            {{"status_points", 2147483648LL}}, {{"status_points", 1.5}},
            {{"status_points", "5"}}, {{"status_points", 5}, {"base_level", 10}}}) {
        map_session_data sd;
        int status = 0;
        json result;
        apply(&sd, {{"payload", payload}}, status, result);
        assert(status == 400 && result["error"]["code"] == "invalid_parameter");
        assert(sd.status.skill_point == 10 && sd.status.status_point == 20);
        assert(sd.writes == 0 && sd.saves == 0);
    }
    for (const json& payload : std::vector<json>{
            {{"skill_points", 0}, {"status_points", 0}},
            {{"skill_points", 32767}, {"status_points", 2147483647}},
            {{"status_points", 50}}, {{"skill_points", 15}}}) {
        map_session_data sd;
        int status = 0;
        json result;
        apply(&sd, {{"payload", payload}}, status, result);
        assert(status == 200 && sd.saves == 1);
        assert(sd.status.skill_point == payload.value("skill_points", 10));
        assert(sd.status.status_point == payload.value("status_points", 20));
        assert(sd.writes == payload.size());
        assert(result["data"]["result"]["skill_points"] == sd.status.skill_point);
        assert(result["data"]["result"]["status_points"] == sd.status.status_point);
    }
    std::cout << "12 point balance cases passed\n";
}
