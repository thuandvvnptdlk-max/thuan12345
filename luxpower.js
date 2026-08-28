const axios = require('axios');

// 1. Đọc cấu hình từ biến môi trường
const username = process.env.LUX_USER;
const password = process.env.LUX_PASSWORD;
const dongleSn = process.env.LUX_DONGLE;

let action = process.env.ACTION_INPUT;
const cron = process.env.CRON_TRIGGER;

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Địa chỉ cổng máy chủ LuxPower Việt Nam
const BASE_URL = 'https://vn.luxpowertek.com/WManage';

if (!action) {
  if (cron === "0 1 * * *") {
    action = "disable";
  } else if (cron === "24 4 * * *") {
    action = "enable";
  } else {
    action = "enable";
  }
}

async function notifyTelegram(message) {
  if (!botToken || !chatId) return;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error("Lỗi khi gửi thông báo Telegram:", err.message);
  }
}

async function main() {
  const timeNow = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const actionText = action.toLowerCase() === 'enable' ? 'BẬT' : 'TẮT';

  console.log(`[${timeNow}] Bắt đầu thực hiện lệnh: ${actionText}`);

  if (!username || !password || !dongleSn) {
    const errText = `❌ <b>LuxPower Thất bại</b>\nThiếu biến môi trường (LUX_USER, LUX_PASSWORD hoặc LUX_DONGLE).`;
    console.error(errText);
    await notifyTelegram(errText);
    process.exit(1);
  }

  try {
    // Bước 1: Đăng nhập vào Server VN
    console.log("Đang đăng nhập hệ thống LuxPower (Server VN)...");
    const loginRes = await axios.post(
      `${BASE_URL}/api/login`,
      `account=${encodeURIComponent(username.trim())}&password=${encodeURIComponent(password.trim())}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    if (!loginRes.data || !loginRes.data.success) {
      throw new Error(`Đăng nhập thất bại: ${JSON.stringify(loginRes.data)}`);
    }

    const cookies = loginRes.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

    // Bước 2: Chuẩn bị tham số cài đặt
    const isEnable = action.toLowerCase() === 'enable';
    const params = new URLSearchParams();
    params.append('serialNum', dongleSn.trim());
    params.append('hold', isEnable ? '1' : '0');

    console.log(`Đang gửi lệnh ${actionText} tới Inverter ${dongleSn}...`);

    // Bước 3: Gửi lệnh thay đổi chế độ
    const setRes = await axios.post(
      `${BASE_URL}/api/inverter/set/common`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieHeader
        }
      }
    );

    console.log("Phản hồi từ LuxPower:", setRes.data);

    // Bước 4: Gửi thông báo thành công
    const successMsg = `☀️ <b>LuxPower Thông Báo</b>\n\n` +
                       `⏰ <b>Thời gian:</b> ${timeNow}\n` +
                       `⚙️ <b>Lệnh:</b> Đã <b>${actionText}</b> biến tần thành công!\n` +
                       `📟 <b>Thiết bị:</b> <code>${dongleSn}</code>`;
    
    await notifyTelegram(successMsg);
    console.log("Đã hoàn tất quy trình.");

  } catch (error) {
    const errorMsg = `❌ <b>LuxPower Thất bại</b>\n\n` +
                     `⏰ <b>Thời gian:</b> ${timeNow}\n` +
                     `⚙️ <b>Lệnh:</b> ${actionText}\n` +
                     `⚠️ <b>Lỗi:</b> ${error.message}`;
    console.error(errorMsg);
    await notifyTelegram(errorMsg);
    process.exit(1);
  }
}

main();
