#include <cassert>
#include <cstdint>
#include <cstring>
#include <memory>
#include <unordered_map>
#include <cinttypes>
using int32 = int32_t;
using uint32 = uint32_t;
using uint16 = uint16_t;
struct mmo_charstatus { uint32 char_id; };
struct online_char_data { uint32 char_id; };
std::unordered_map<uint32,std::shared_ptr<online_char_data>> online;
auto& char_get_onlinedb() { return online; }
namespace util {
template<class M> auto umap_find(M& m, uint32 key) { return m.count(key) ? m.at(key) : nullptr; }
}
uint16 length = 13 + sizeof(mmo_charstatus), opcode = 0;
uint32 packetAid = 2000000, packetCid = 150000, ackAid = 0, ackCid = 0;
unsigned char finalSave = 1;
mmo_charstatus data{150000};
int available = 17, consumed = 0, saved = 0, offline = 0, acks = 0, saveError = 0;
#define RFIFOREST(fd) available
#define RFIFOW(fd, offset) length
#define RFIFOL(fd, offset) ((offset)==4 ? packetAid : packetCid)
#define RFIFOB(fd, offset) finalSave
#define RFIFOP(fd, offset) (&data)
#define RFIFOSKIP(fd, size) (consumed += (size))
#define WFIFOHEAD(fd, size) ((void)0)
#define WFIFOW(fd, offset) opcode
#define WFIFOL(fd, offset) ((offset)==2 ? ackAid : ackCid)
#define WFIFOSET(fd, size) (++acks)
void ShowError(const char*, ...) {}
int char_mmo_char_tosql(uint32, mmo_charstatus*) { ++saved; return saveError; }
void char_set_char_online(int32, uint32, uint32) {}
void char_set_char_offline(uint32, uint32) { ++offline; }
