// Minimal session model for executing the actual clif_parse function without
// starting a game world or touching the live database.
#include <cassert>
#include <cstdint>
#include <cstring>
#include <cstdio>
#include <vector>
#include <algorithm>
using int32 = int32_t;
using uint16 = uint16_t;
struct TBL_PC {
  struct { bool autotrade = false, active = false; } state;
  struct { char name[24]; int account_id, char_id; } status;
  void* prev = reinterpret_cast<void*>(1);
  int fd = 0;
};
struct TestSession {
  struct { bool eof = false; } flag;
  void* session_data = nullptr;
  int client_addr = 0;
  size_t max_rdata = 2048, max_wdata = 2048;
  size_t rdata_pos = 0;
  std::vector<uint8_t> bytes;
};
TestSession* session[1];
struct Entry { int len = 0; void (*func)(int, TBL_PC*) = nullptr; } packet_db[65536];
constexpr int MIN_PACKET_DB = 1, MAX_PACKET_DB = 65535;
#define CL_WHITE ""
#define CL_RESET ""
#define ShowInfo(...) ((void)0)
#define ShowWarning(...) ((void)0)
#define RFIFOREST(fd) (session[fd]->bytes.size() - session[fd]->rdata_pos)
#define RFIFOP(fd, offset) (session[fd]->bytes.data() + session[fd]->rdata_pos + (offset))
uint16 word(const uint8_t* p) { return p[0] | (p[1] << 8); }
#define RFIFOW(fd, offset) word(RFIFOP(fd, offset))
#define RFIFOSKIP(fd, count) (session[fd]->rdata_pos += (count))
void realloc_fifo(int fd, size_t size, size_t) { session[fd]->max_rdata = size; }
void set_eof(int fd) { session[fd]->flag.eof = true; }
void do_close(int) {}
void clif_quitsave(int, TBL_PC*) {}
void map_quit(TBL_PC*) {}
void clif_parse_debug(int, TBL_PC*) {}
void clif_parse_WantToConnection(int, TBL_PC*) {}
void clif_parse_LoadEndAck(int, TBL_PC*) {}
