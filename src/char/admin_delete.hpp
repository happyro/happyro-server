#ifndef HAPPYRO_CHAR_ADMIN_DELETE_HPP
#define HAPPYRO_CHAR_ADMIN_DELETE_HPP
#include <common/cbasetypes.hpp>
bool admin_delete_init();
bool admin_account_blocked(uint32 account_id);
bool admin_delete_character_auxiliary(uint32 char_id);
int32 admin_delete_fence_ack(int32 fd,int32 server_id);
void admin_delete_map_disconnected(int32 server_id);
#endif
