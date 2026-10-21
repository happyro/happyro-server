#include "../src/map/game_control_settings_state.hpp"
#include <cassert>

int main() {
 using State = GameControlSettingsState;
 State state("first-process");
 assert(state.revision() == 0 && state.last_status() == "idle");
 assert(state.begin("first-process",0,"original") == State::Admission::accepted);
 state.complete(true);
 assert(state.revision() == 1 && state.last_command() == "original" && state.last_status() == "succeeded");
 // A lost response can be recognized without executing the original again.
 assert(state.begin("first-process",0,"original") == State::Admission::stale_revision);
 assert(state.last_status() == "succeeded");
 assert(state.fence("first-process",1) == State::Admission::accepted);
 // If the barrier wins, a delayed command cannot mutate settings afterward.
 assert(state.begin("first-process",1,"delayed") == State::Admission::stale_revision);
 assert(state.revision() == 2 && state.last_status() == "fenced");
 // If the command wins, the barrier reports a conflict and preserves its receipt.
 assert(state.begin("first-process",2,"winner") == State::Admission::accepted);
 state.complete(false);
 assert(state.fence("first-process",2) == State::Admission::stale_revision);
 assert(state.last_command() == "winner" && state.last_status() == "failed");
 State restarted("second-process");
 assert(restarted.begin("first-process",0,"old-request") == State::Admission::wrong_instance);
 assert(restarted.fence("first-process",0) == State::Admission::wrong_instance);
 assert(restarted.revision() == 0);
 assert(restarted.begin("second-process",0,"") == State::Admission::invalid_request);
 assert(restarted.revision() == 0);
}
