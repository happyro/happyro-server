int main() {
 // Failed SQL save consumes the request, but cannot retire the map's logout node.
 saveError = 1;
 assert(chmapif_parse_reqsavechar(1, 0) == 1);
 assert(saved == 1 && consumed == length && offline == 0 && acks == 0);
 // A later retry succeeds and only then acknowledges the final save.
 saveError = 0;
 assert(chmapif_parse_reqsavechar(1, 0) == 1);
 assert(saved == 2 && consumed == length * 2 && offline == 1 && acks == 1);
 assert(opcode == 0x2b21 && ackAid == packetAid && ackCid == packetCid);
 // Ordinary autosave must not produce the logout acknowledgement.
 finalSave = 0;
 online[packetAid] = std::make_shared<online_char_data>(online_char_data{packetCid});
 assert(chmapif_parse_reqsavechar(1, 0) == 1);
 assert(saved == 3 && acks == 1 && offline == 1);
 // Partial packets are held until complete.
 available = 3;
 assert(chmapif_parse_reqsavechar(1, 0) == 0);
 assert(saved == 3 && consumed == length * 3);
}
