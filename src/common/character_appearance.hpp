#ifndef HAPPYRO_CHARACTER_APPEARANCE_HPP
#define HAPPYRO_CHARACTER_APPEARANCE_HPP
#include "character_appearance_data.hpp"
#include <cstdint>

inline const character_appearance_data::Job* character_appearance_job(int job) {
 for (const auto& entry : character_appearance_data::jobs)
  if (entry.id == job) return &entry;
 return nullptr;
}
inline const character_appearance_data::Option* character_appearance_find(int64_t choice) {
 for (const auto& entry : character_appearance_data::options)
  if (entry.id == choice) return &entry;
 return nullptr;
}
inline bool character_appearance_known(int64_t choice) {
 return choice == 0 || character_appearance_find(choice) != nullptr;
}
inline bool character_appearance_allowed(int job, int64_t choice, int sex) {
 if (choice == 0) return true;
 const auto* actual = character_appearance_job(job);
 const auto* option = character_appearance_find(choice);
 return actual && option && actual->branch == option->branch && actual->stage > option->stage
  && (sex == 0 || sex == 1) && (actual->sex == -1 || actual->sex == sex)
  && (option->sex == -1 || option->sex == sex);
}
// Only explicit mounted aliases prove that this real job has a mounted shape.
inline const character_appearance_data::Option* character_appearance_mount(int job) {
 const auto* actual = character_appearance_job(job);
 if (!actual) return nullptr;
 const int walking = actual->mounted_of ? actual->mounted_of : actual->id;
 bool mounted = false;
 for (const auto& entry : character_appearance_data::jobs)
  if (entry.mounted_of == walking) mounted = true;
 if (!mounted) return nullptr;
 const character_appearance_data::Option* result = nullptr;
 for (const auto& option : character_appearance_data::options)
  if (option.branch == actual->branch && option.stage <= actual->stage && option.mounted_job
   && (!result || option.stage > result->stage)) result = &option;
 return result;
}
#endif
