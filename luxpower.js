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
    const domain = 'https://vn.luxpowertek.com';

    // 1. Đăng nhập
    const params = new URLSearchParams();
    params.append('account', username.trim());
    params.append('password', password.trim());

    console.log("Đang đăng nhập hệ thống...");
    const loginRes = await axios.post(`${domain}/WManage/api/login`, params.toString(), {
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
    console.log("Đăng nhập thành công, cookie nhận được.");

    // 2. Thử các endpoint điều khiển
    const isEnable = action.toLowerCase() === 'enable';
    const setParams = new URLSearchParams();
    setParams.append('serialNum', dongleSn.trim());
    setParams.append('hold', isEnable ? '1' : '0');

    const controlEndpoints = [
      `${domain}/WManage/api/inverter/set/common`,
      `${domain}/WManage/api/inverter/setCommon`,
      `${domain}/WManage/api/inverter/set/quick`,
      `${domain}/WManage/api/inverter/set/func`
    ];

    let successRes = null;
    let lastErr = '';

    for (const ep of controlEndpoints) {
      try {
        console.log(`Thử gửi lệnh tới: ${ep}`);
        const res = await axios.post(ep, setParams.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          timeout: 15000
        });

        if (res.data && (res.data.success || res.data.msgCode === 200 || res.data.code === 200)) {
          successRes = res.data;
          console.log(`Gửi lệnh thành công tại: ${ep}`);
          break;
        } else {
          lastErr = JSON.stringify(res.data);
        }
      } catch (err) {
        lastErr = `${ep} -> HTTP ${err.response ? err.response.status : err.message}`;
      }
    }

    if (!successRes) {
      throw new Error(`Không gửi được lệnh qua các endpoint: ${lastErr}`);
    }

    // 3. Gửi thông báo thành công
    const successMsg = `☀️ LuxPower Thông Báo\n\n` +
                       `⏰ Thời gian: ${timeNow}\n` +
                       `⚙️ Lệnh: Đã ${actionText} biến tần thành công!\n` +
                       `📟 Thiết bị: ${dongleSn.trim()}`;

    await notifyTelegram(successMsg);
    console.log("Quy trình hoàn tất thành công 100%.");

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
