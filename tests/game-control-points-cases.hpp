int main() {
    using nlohmann::json;
    for (const json& payload : std::vector<json>{json::object(), json::array(),
            {{"skill_points", 5}, {"status_points", -1}},
            {{"skill_points", 32768}, {"status_points", 5}},
            {{"status_points", 2147483648LL}}, {{"status_points", 1.5}},
            {{"status_points", "5"}}, {{"status_points", 5}, {"base_level", 10}},
            {{"skill_points", 5}, {"trait_points", 0}}}) {
        map_session_data sd;
        int status = 0;
        json result;
        apply(&sd, {{"payload", payload}}, status, result);
        assert(status == 400 && result["error"]["code"] == "invalid_parameter");
        assert(sd.status.skill_point == 10 && sd.status.status_point == 20 && sd.status.trait_point == 30);
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
    // Exercise the trait field without weakening atomic validation of other balances.
    for (const json& value : std::vector<json>{-1, 2147483648LL, 1.5, "5", nullptr}) {
        map_session_data sd; sd.class_ = TRAIT_JOB;
        int status = 0; json result;
        apply(&sd, {{"payload", {{"skill_points", 5}, {"trait_points", value}}}}, status, result);
        assert(status == 400 && sd.writes == 0 && sd.saves == 0);
        assert(sd.status.skill_point == 10 && sd.status.trait_point == 30);
    }
    for (int32_t value : {0, INT32_MAX}) {
        map_session_data sd; sd.class_ = TRAIT_JOB;
        int status = 0; json result;
        apply(&sd, {{"payload", {{"skill_points", 5}, {"status_points", 6}, {"trait_points", value}}}}, status, result);
        assert(status == 200 && sd.writes == 3 && sd.saves == 1);
        assert(sd.status.skill_point == 5 && sd.status.status_point == 6 && sd.status.trait_point == value);
        assert(result["data"]["result"]["trait_points"] == value);
    }
    std::cout << "PASS: point balances, trait eligibility and atomic validation\n";
}
