#include <cassert>
#include <cstdint>
#include <nlohmann/json.hpp>
using int32 = int32_t;
using uint32 = uint32_t;
using uint64 = uint64_t;
struct map_session_data {
 struct { bool keepshop = true; bool admin_delete_pending = false; } state;
 int fd = 1;
};
map_session_data* session = nullptr;
bool active = true, saving = false;
int disconnects = 0, quits = 0, acknowledgements = 0, mutations = 0;
uint32 packetAccount = 2000000, ackAccount = 0;
uint64 packetNonce = 42, ackNonce = 0;
uint16_t ackOpcode = 0;
#define RFIFOL(fd,offset) packetAccount
#define RFIFOQ(fd,offset) packetNonce
#define WFIFOHEAD(fd,size) ((void)0)
#define WFIFOW(fd,offset) ackOpcode
#define WFIFOL(fd,offset) ackAccount
#define WFIFOQ(fd,offset) ackNonce
#define WFIFOSET(fd,size) (++acknowledgements)
map_session_data* map_id2sd(uint32) { return session; }
map_session_data* map_charid2sd(int32) { return session; }
bool session_isActive(int) { return active; }
void clif_authfail_fd(int,int) { assert(session->state.admin_delete_pending); ++disconnects; }
void map_quit(map_session_data* sd) { assert(sd->state.admin_delete_pending); ++quits; }
void* chrif_search(uint32) { return saving ? reinterpret_cast<void*>(1) : nullptr; }
