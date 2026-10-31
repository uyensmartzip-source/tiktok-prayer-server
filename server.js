const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.get('/', (req, res) => { res.send('Server TikTok LIVE đang hoạt động!'); });

let tiktokLive = null;

function connectToTikTok(socket, username) {
  if (tiktokLive) {
    try { tiktokLive.disconnect(); } catch (e) {}
  }

  const cleanId = username.replace('@', '').trim();
  console.log(`⏳ Đang kết nối (bản fix 403) tới phòng LIVE của: @${cleanId}...`);
  
  // FIX CHÍNH: Thêm tùy chọn giả lập trình duyệt để lách cơ chế chặn 403 của TikTok
  tiktokLive = new WebcastPushConnection(cleanId, {
    enableExtendedGiftInfo: true,
    processInitialData: true,
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    },
    clientParams: {
      app_language: 'vi',
      device_language: 'vi'
    }
  });

  tiktokLive.connect().then(state => {
    console.log(`✅ Kết nối thành công phòng LIVE: ${state.roomInfo.title || cleanId}`);
    socket.emit('status', { connected: true, username: cleanId });
  }).catch(err => {
    console.log(`❌ Vẫn bị chặn 403 hoặc lỗi: ${err.message}`);
    socket.emit('status', { connected: false, error: err.message });
  });

  tiktokLive.on('chat', data => {
    const isFemale = /thị|hương|lan|mai|linh|trang|ngọc|vy|nhi|huyền|thảo|yến|uyên|my|nhung|hà|anh|thư|trâm/i.test(data.nickname);
    io.emit('prayer_event', { username: data.nickname, text: data.comment, gender: isFemale ? 'female' : 'male' });
  });

  tiktokLive.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) return;
    io.emit('gift_event', { username: data.nickname, diamonds: data.diamondCount * data.repeatCount, giftName: data.giftName || 'Hoa Thánh' });
  });

  tiktokLive.on('like', data => {
    io.emit('like_event', { count: data.likeCount });
  });
}

io.on('connection', (socket) => {
  console.log('📱 Giao diện app 3D đã kết nối vào Server trung gian.');
  socket.on('set_channel', (newUsername) => {
    if (newUsername) connectToTikTok(socket, newUsername);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 Server đang chạy trên cổng ${PORT}`); });
