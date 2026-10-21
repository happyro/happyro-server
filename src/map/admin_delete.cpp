#include "admin_delete.hpp"
#include <common/socket.hpp>
#include "map.hpp"
#include "pc.hpp"
#include "clif.hpp"
#include "chrif.hpp"

void admin_delete_fence(int32 fd) {
 const uint32 account_id = RFIFOL(fd,2);
 const uint64 nonce = RFIFOQ(fd,6);
 if (map_session_data* sd = map_id2sd(account_id); sd != nullptr) {
  sd->state.admin_delete_pending = true;
  sd->state.keepshop = false;
  if (session_isActive(sd->fd)) clif_authfail_fd(sd->fd,15);
  else map_quit(sd);
  return;
 }
 // A logout auth node remains until the final character save is acknowledged.
 // Do not authorize deletion while that save could still recreate character data.
 if (chrif_search(account_id) != nullptr) return;
 WFIFOHEAD(fd,14);
 WFIFOW(fd,0)=0x2b2c;
 WFIFOL(fd,2)=account_id;
 WFIFOQ(fd,6)=nonce;
 WFIFOSET(fd,14);
}
