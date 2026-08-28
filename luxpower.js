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
    console.error("Lỗi gửi Telegram:", err.message);
  }
}

async function main() {
  const timeNow = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const actionText = action.toLowerCase() === 'enable' ? 'BẬT' : 'TẮT';

  console.log(`[${timeNow}] Bắt đầu thực hiện lệnh: ${actionText}`);

  try {
    const domain = 'https://vn.luxpowertek.com';

    // 1. Đăng nhập hệ thống LuxPower
    const params = new URLSearchParams();
    params.append('account', username.trim());
    params.append('password', password.trim());

    console.log("Đang đăng nhập hệ thống LuxPower VN...");
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
    console.log("Đăng nhập thành công!");

    // 2. Gửi lệnh điều khiển bật/tắt biến tần
    const isEnable = action.toLowerCase() === 'enable';
    
    // LuxPower dùng hold: 1 để On (Bật), 0 để Off/Standby (Tắt)
    const setParams = new URLSearchParams();
    setParams.append('serialNum', dongleSn.trim());
    setParams.append('inverterSn', dongleSn.trim());
    setParams.append('hold', isEnable ? '1' : '0');
    setParams.append('remoteType', '1');

    // Danh sách các route thực tế của LuxPower
    const endpoints = [
      `${domain}/WManage/web/inverter/setFunction`,
      `${domain}/WManage/web/inverter/setParam`,
      `${domain}/WManage/web/inverter/quickSet`,
      `${domain}/WManage/api/inverter/setParam`
    ];

    let success = false;
    let lastData = null;
    let errLogs = [];

    for (const ep of endpoints) {
      try {
        console.log(`Đang gửi lệnh tới: ${ep}`);
        const res = await axios.post(ep, setParams.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          timeout: 15000
        });

        if (res.data && (res.data.success || res.data.code === 200 || res.data.msgCode === 200)) {
          success = true;
          lastData = res.data;
          break;
        } else {
          errLogs.push(`${ep} -> ${JSON.stringify(res.data)}`);
        }
      } catch (e) {
        errLogs.push(`${ep} -> HTTP ${e.response ? e.response.status : e.message}`);
      }
    }

    if (!success) {
      throw new Error(errLogs.join('\n'));
    }

    // 3. Báo cáo hoàn tất
    const successMsg = `☀️ LuxPower Thông Báo\n\n` +
                       `⏰ Thời gian: ${timeNow}\n` +
                       `⚙️ Lệnh: Đã ${actionText} biến tần thành công!\n` +
                       `📟 Thiết bị: ${dongleSn.trim()}`;

    await notifyTelegram(successMsg);
    console.log("Hoàn tất thành công.");

  } catch (error) {
    const errorMsg = `❌ LuxPower Thất bại\n\n` +
                     `⏰ Thời gian: ${timeNow}\n` +
                     `⚙️ Lệnh: ${actionText}\n` +
                     `⚠️ Chi tiết:\n${error.message}`;
    console.error(errorMsg);
    await notifyTelegram(errorMsg);
    process.exit(1);
  }
}

main();
