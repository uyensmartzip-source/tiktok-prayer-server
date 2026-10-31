const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.get('/', (req, res) => {
  res.send('Server Cầu Nguyện TikTok LIVE đang hoạt động tuyệt vời!');
});

let tiktokLive = null;

function connectToTikTok(socket, username) {
  if (tiktokLive) {
    try { tiktokLive.disconnect(); } catch (e) {}
  }

  const cleanId = username.replace('@', '').trim();
  console.log(`⏳ Đang kết nối tới phòng LIVE của: @${cleanId}...`);
  
  tiktokLive = new WebcastPushConnection(cleanId);

  tiktokLive.connect().then(() => {
    console.log(`✅ Đã kết nối thành công với LIVE của @${cleanId}`);
    socket.emit('status', { connected: true, username: cleanId });
  }).catch(err => {
    console.log(`❌ Lỗi kết nối @${cleanId}: ${err.message}`);
    socket.emit('status', { connected: false, error: err.message });
  });

  // 1. Lắng nghe Comment cầu nguyện
  tiktokLive.on('chat', data => {
    const isFemale = /thị|hương|lan|mai|linh|trang|ngọc|vy|nhi|huyền|thảo|yến|uyên|my|nhung|hà|anh|thư|trâm/i.test(data.nickname);
    io.emit('prayer_event', {
      username: data.nickname,
      text: data.comment,
      gender: isFemale ? 'female' : 'male'
    });
  });

  // 2. Lắng nghe Quà tặng (Gift)
  tiktokLive.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) return; // Chờ kết thúc combo quà
    const totalDiamonds = data.diamondCount * data.repeatCount;
    io.emit('gift_event', {
      username: data.nickname,
      diamonds: totalDiamonds,
      giftName: data.giftName || 'Hoa Thánh'
    });
  });

  // 3. Lắng nghe lượt Thả Tim (Like)
  tiktokLive.on('like', data => {
    io.emit('like_event', { count: data.likeCount });
  });
}

io.on('connection', (socket) => {
  console.log('📱 Giao diện app 3D đã kết nối vào Server trung gian.');
  
  // Nhận yêu cầu đổi kênh TikTok từ nút 🔗 TikTok trên app
  socket.on('set_channel', (newUsername) => {
    if (newUsername) {
      connectToTikTok(socket, newUsername);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server trung gian đang chạy trên cổng ${PORT}`);
});