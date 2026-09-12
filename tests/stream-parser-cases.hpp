std::vector<std::vector<uint8_t>> delivered;
void capture(int fd, TBL_PC*) {
  int length = packet_db[RFIFOW(fd, 0)].len;
  if (length == -1) length = RFIFOW(fd, 2);
  delivered.emplace_back(RFIFOP(fd, 0), RFIFOP(fd, length));
}
std::vector<uint8_t> frame(size_t length) {
  std::vector<uint8_t> p(length, 0);
  p[0] = 0xfa; p[1] = 0x0c; p[2] = length & 255; p[3] = length >> 8;
  return p;
}
void feed(TestSession& s, const std::vector<uint8_t>& bytes, size_t begin, size_t end) {
  while (begin < end) {
    const size_t count = std::min(end - begin, s.max_rdata - s.bytes.size());
    assert(count > 0);
    s.bytes.insert(s.bytes.end(), bytes.begin() + begin, bytes.begin() + begin + count);
    begin += count;
    size_t consumed;
    do {
      clif_parse(0);
      assert(!s.flag.eof);
      consumed = s.rdata_pos;
      s.bytes.erase(s.bytes.begin(), s.bytes.begin() + consumed);
      s.rdata_pos = 0;
    } while (consumed && !s.bytes.empty());
  }
}
int main() {
  TBL_PC player;
  packet_db[0xcfa] = {-1, capture};
  packet_db[0x123] = {6, capture};
  for (size_t length : {size_t(898), size_t(1210), size_t(32768)}) {
    const auto p = frame(length);
    for (size_t split = 1; split < length; ++split) {
      TestSession s; s.session_data = &player; session[0] = &s; delivered.clear();
      feed(s, p, 0, split);
      assert(delivered.empty());
      feed(s, p, split, length);
      assert(delivered.size() == 1 && delivered[0] == p && s.bytes.empty());
    }
  }
  TestSession s; s.session_data = &player; session[0] = &s; delivered.clear();
  std::vector<uint8_t> combined;
  for (int i = 0; i < 100; ++i) {
    auto p = i % 2 ? frame(898) : std::vector<uint8_t>{0x23, 1, 2, 3, 4, 5};
    combined.insert(combined.end(), p.begin(), p.end());
  }
  for (size_t offset = 0; offset < combined.size();) {
    size_t end = std::min(combined.size(), offset + (offset % 211 + 1));
    feed(s, combined, offset, end); offset = end;
  }
  assert(delivered.size() == 100);
  for (size_t length : {size_t(0), size_t(3), size_t(32769), size_t(65535)}) {
    TestSession invalid; session[0] = &invalid; invalid.bytes = {0xfa, 0x0c, uint8_t(length), uint8_t(length >> 8)};
    clif_parse(0); assert(invalid.flag.eof);
  }
  puts("Actual clif_parse: all splits, coalescing, FIFO growth and invalid lengths passed");
}
