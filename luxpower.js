const axios = require('axios');

const username = process.env.LUX_USER;
const password = process.env.LUX_PASSWORD;
const dongleSn = process.env.LUX_DONGLE || '60403U0700';

let action = process.env.ACTION_INPUT;
const cron = process.env.CRON_TRIGGER;

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const BASE_URL = 'https://vn.luxpowertek.com';
const LOGIN_URL = `${BASE_URL}/WManage/web/login/login`;
const CONTROL_URL = `${BASE_URL}/WManage/web/maintain/remoteSet/functionControl`;

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
    console.error("Lỗi gửi Telegram:", err.message);
  }
}

async function main() {
  const timeNow = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const isEnable = action.toLowerCase() === 'enable';
  const actionText = isEnable ? 'BẬT (ENABLE)' : 'TẮT (DISABLE)';

  console.log(`[${timeNow}] Bắt đầu thực hiện lệnh: ${actionText}`);

  if (!username || !password) {
    const errText = `❌ LuxPower Thất bại\nThiếu biến môi trường (LUX_USER, LUX_PASSWORD).`;
    await notifyTelegram(errText);
    process.exit(1);
  }

  try {
    // 1. Đăng nhập theo đúng API Extension
    console.log("Đang đăng nhập hệ thống LuxPower VN...");
    const loginParams = new URLSearchParams();
    loginParams.append('account', username.trim());
    loginParams.append('password', password.trim());

    const loginRes = await axios.post(LOGIN_URL, loginParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });

    if (!loginRes.data || loginRes.data.success === false) {
      throw new Error(`Đăng nhập thất bại: ${JSON.stringify(loginRes.data)}`);
    }

    const cookies = loginRes.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
    console.log("Đăng nhập thành công!");

    // 2. Gửi lệnh điều khiển chuẩn xác theo Extension
    const controlParams = new URLSearchParams();
    controlParams.append('inverterSn', dongleSn.trim());
    controlParams.append('functionParam', 'FUNC_TAKE_LOAD_TOGETHER');
    controlParams.append('enable', isEnable ? 'true' : 'false');
    controlParams.append('clientType', 'WEB');
    controlParams.append('remoteSetType', 'NORMAL');

    console.log(`Đang gửi lệnh ${actionText} tới Inverter ${dongleSn.trim()}...`);

    const controlRes = await axios.post(CONTROL_URL, controlParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });

    console.log("Phản hồi Server:", controlRes.data);

    if (controlRes.data && controlRes.data.success === false) {
      throw new Error(`Lỗi API: ${controlRes.data.msg || JSON.stringify(controlRes.data)}`);
    }

    // 3. Thông báo thành công về Telegram
    const successMsg = `☀️ LuxPower Thông Báo\n\n` +
                       `⏰ Thời gian: ${timeNow}\n` +
                       `⚙️ Lệnh: Đã ${actionText} thành công!\n` +
                       `📟 Thiết bị: ${dongleSn.trim()}`;

    await notifyTelegram(successMsg);
    console.log("Hoàn tất thành công.");

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
