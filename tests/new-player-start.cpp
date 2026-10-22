#include "../src/char/new_player_start.hpp"
#include <cassert>
#include <cstring>

int main() {
 for (const char* value : {"ship"}) {
  const auto start = happyro_new_player_start(value);
  assert(start && std::strcmp(start->map, "iz_int") == 0 && start->x == 18 && start->y == 26);
 }
 for (const char* value : {static_cast<const char*>(nullptr), "classic"}) {
  const auto classic = happyro_new_player_start(value);
  assert(classic && std::strcmp(classic->mode, "classic") == 0 && std::strcmp(classic->map, "new_1-1") == 0 && classic->x == 53 && classic->y == 111);
 }
 for (const char* value : {"", "Classic", "legacy", "new_1-1", "classic ", "unknown"}) assert(!happyro_new_player_start(value));
}
