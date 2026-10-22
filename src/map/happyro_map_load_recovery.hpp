// HappyRO current map-load recovery policy. Destinations are server-owned.
#ifndef HAPPYRO_MAP_LOAD_RECOVERY_HPP
#define HAPPYRO_MAP_LOAD_RECOVERY_HPP

#include <cstdint>
#include <string>

struct HappyroMapLoadRecovery {
 uint32_t generation = 0;
 uint8_t attempt = 0;
 bool pending = false;
 bool ready = false;
 std::string safe_map;
 uint16_t safe_x = 0;
 uint16_t safe_y = 0;

 struct Decision { uint8_t status; uint8_t destination; uint8_t attempt; };
 void begin(uint32_t token) { generation = token; pending = true; }
 void restore(bool interrupted, uint8_t saved_attempt) {
  attempt = interrupted ? (saved_attempt > 2 ? 2 : saved_attempt) : 0;
  ready = true;
 }
 Decision request(uint32_t token, uint8_t action, bool previous_available) const {
  if (!pending || token == 0 || token != generation) return {1, 0, attempt};
  if (!ready) return {4, 0, attempt};
  if (action > 1) return {3, 0, attempt};
  if (attempt >= 2) return {2, 1, attempt};
  if (action == 0 && attempt == 0 && previous_available) return {0, 0, 1};
  return {0, 1, 2};
 }
 void confirm() { pending = false; attempt = 0; }
};
#endif
