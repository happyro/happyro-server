// HappyRO: one explicit policy for newly created human characters.
#ifndef HAPPYRO_NEW_PLAYER_START_HPP
#define HAPPYRO_NEW_PLAYER_START_HPP

#include <optional>
#include <string_view>

struct HappyroNewPlayerStart {
 const char* mode;
 const char* map;
 unsigned short x;
 unsigned short y;
};

inline std::optional<HappyroNewPlayerStart> happyro_new_player_start(const char* setting) {
 const std::string_view mode = setting == nullptr ? "classic" : setting;
 if (mode == "ship") return HappyroNewPlayerStart{"ship", "iz_int", 18, 26};
 if (mode == "classic") return HappyroNewPlayerStart{"classic", "new_1-1", 53, 107};
 return std::nullopt;
}

#endif
