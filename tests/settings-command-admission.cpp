#include "../src/map/game_control_settings_admission.hpp"
#include <cassert>

int main() {
 using State = GameControlSettingsState;
 using nlohmann::json;
 State state("map-process");
 const auto original = json::parse(R"({"instance_id":"map-process","expected_revision":0,"changes":[]})");
 for (const auto& invalid : {json(), json::array(), json::object(), json::parse(R"({"instance_id":12,"expected_revision":0})"), json::parse(R"({"instance_id":"map-process","expected_revision":-1})"), json::parse(R"({"instance_id":"map-process","expected_revision":0.5})")}) {
  assert(admit_settings_command(state, invalid, "command") == State::Admission::invalid_request);
  assert(state.revision() == 0);
 }
 assert(admit_settings_command(state, original, "command") == State::Admission::accepted);
 state.complete(true);
 assert(admit_settings_command(state, original, "command") == State::Admission::stale_revision);
 assert(state.last_command() == "command" && state.last_status() == "succeeded");
 State restarted("new-map-process");
 assert(admit_settings_command(restarted, original, "delayed") == State::Admission::wrong_instance);
 assert(restarted.revision() == 0);
 State fenced("map-process");
 assert(admit_settings_command(fenced, original, "barrier", true) == State::Admission::invalid_request);
 const auto barrier = json::parse(R"({"instance_id":"map-process","expected_revision":0})");
 assert(admit_settings_command(fenced, barrier, "barrier", true) == State::Admission::accepted);
 assert(admit_settings_command(state, barrier, "barrier", true) == State::Admission::stale_revision);
 assert(state.last_command() == "command" && state.last_status() == "succeeded");
 assert(admit_settings_command(fenced, original, "delayed") == State::Admission::stale_revision);
 assert(fenced.last_status() == "fenced");
}
