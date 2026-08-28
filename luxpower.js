const axios = require('axios');

const username = process.env.LUX_USER;
const password = process.env.LUX_PASSWORD;
const dongleSn = process.env.LUX_DONGLE;

let action = process.env.ACTION_INPUT;
const cron = process.env.CRON_TRIGGER;

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

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
      chat_id: String(chatId).trim(),
      text: message
    });
  } catch (err) {
    console.error("Lỗi Telegram:", err.response ? JSON.stringify(err.response.data) : err.message);
  }
}

async function main() {
  const timeNow = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const actionText = action.toLowerCase() === 'enable' ? 'BẬT' : 'TẮT';

  console.log(`[${timeNow}] Bắt đầu thực hiện lệnh: ${actionText}`);

  try {
    const baseUrl = 'https://vn.luxpowertek.com/WManage/api';

    // 1. Đăng nhập
    const params = new URLSearchParams();
    params.append('account', username.trim());
    params.append('password', password.trim());

    const loginRes = await axios.post(`${baseUrl}/login`, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });

    if (!loginRes.data || !loginRes.data.success) {
      throw new Error(`Đăng nhập thất bại: ${JSON.stringify(loginRes.data)}`);
    }

    const cookies = loginRes.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

    // 2. Gửi lệnh Bật / Tắt
    const isEnable = action.toLowerCase() === 'enable';
    const setParams = new URLSearchParams();
    setParams.append('serialNum', dongleSn.trim());
    setParams.append('hold', isEnable ? '1' : '0');

    const setRes = await axios.post(`${baseUrl}/inverter/set/common`, setParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });

    console.log("Phản hồi từ LuxPower:", setRes.data);

    // 3. Gửi tin nhắn thành công
    const successMsg = `☀️ LuxPower Thông Báo\n\n` +
                       `⏰ Thời gian: ${timeNow}\n` +
                       `⚙️ Lệnh: Đã ${actionText} biến tần thành công!\n` +
                       `📟 Thiết bị: ${dongleSn.trim()}`;

    await notifyTelegram(successMsg);
    console.log("Hoàn tất thành công 100%!");

  } catch (error) {
    const errorMsg = `❌ LuxPower Thất bại\n\n` +
                     `⏰ Thời gian: ${timeNow}\n` +
                     `⚙️ Lệnh: ${actionText}\n` +
                     `⚠️ Chi tiết: ${error.message}`;
    console.error(errorMsg);
    await notifyTelegram(errorMsg);
    process.exit(1);
  }
}

main();
