"""Execute the production item request handler with packet and player stubs."""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ItemUseAckTest(unittest.TestCase):
    def test_rejected_requests_acknowledge_without_consumption(self):
        source = (ROOT / 'src/map/clif.cpp').read_text()
        start = source.index('void clif_parse_UseItem(')
        handler = source[start:source.index('\n}', start) + 2]
        code = r'''
#include <cassert>
using int32 = int;
constexpr int MAX_INVENTORY=100, PCBLOCK_USEITEM=1, CLR_DEAD=1, MSI_BUSY=2, IDLE_USEITEM=1;
struct map_session_data {
 bool dead=false, trading=false; int npc_id=0, chatID=0;
 struct { int block_action=0; } state;
 int idletime=0, idletime_hom=0, idletime_mer=0;
 bool hd=false, md=false;
};
struct { int idletime_option=1, hom_idle_no_share=1, idletime_hom_option=1,
 mer_idle_no_share=1, idletime_mer_option=1; } battle_config;
struct Packet { int pos[1]={2}; } packet_db[1];
int wire_index=2, last_tick=99, acks=0, uses=0, notices=0;
bool accepted=false;
int RFIFOW(int, int offset) { return offset==0 ? 0 : wire_index; }
bool pc_isdead(map_session_data* sd) { return sd->dead; }
bool pc_istrading(map_session_data* sd) { return sd->trading; }
void clif_clearunit_area(map_session_data&, int) { ++notices; }
void clif_msg(map_session_data&, int) { ++notices; }
void clif_useitemack(map_session_data*, int index, int amount, bool ok) {
 assert(index==wire_index-2 && index>=0 && index<MAX_INVENTORY);
 assert(amount==0 && !ok); ++acks;
}
bool pc_useitem(map_session_data*, int index) {
 assert(index==wire_index-2); ++uses; return accepted;
}
''' + handler + r'''
int main() {
 for(int reason=0; reason<5; ++reason) {
  map_session_data sd;
  sd.dead=reason==0; sd.trading=reason==1; sd.chatID=reason==2;
  sd.state.block_action=reason==3 ? PCBLOCK_USEITEM : 0;
  acks=uses=notices=0; wire_index=7;
  clif_parse_UseItem(1,&sd);
  assert(acks==1 && uses==(reason==4 ? 1 : 0));
  assert(notices==(reason==4 ? 0 : 1));
  // Once the condition clears, the next request reaches the use handler.
  sd={}; accepted=true; acks=uses=0;
  clif_parse_UseItem(1,&sd);
  assert(uses==1 && acks==0); accepted=false;
 }
 for(int invalid : {0, 1, MAX_INVENTORY+2, 65535}) {
  map_session_data sd; sd.dead=true; wire_index=invalid; acks=uses=0;
  clif_parse_UseItem(1,&sd); assert(acks==0 && uses==0);
 }
 // NPC scripts retain their existing exception for trading state.
 map_session_data sd; sd.trading=true; sd.npc_id=42; wire_index=2;
 accepted=true; acks=uses=0; clif_parse_UseItem(1,&sd);
 assert(uses==1 && acks==0);
}
'''
        code = '#include <initializer_list>\n' + code
        work = ROOT / 'work'
        work.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='item-use-ack-', dir=work) as directory:
            binary = str(Path(directory) / 'test')
            subprocess.run(['c++', '-std=c++17', '-fsanitize=undefined',
                            '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', binary],
                           input=code, text=True, check=True)
            subprocess.run([binary], check=True)
