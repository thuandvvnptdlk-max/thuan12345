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
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error("Lỗi Telegram:", err.message);
  }
}

async function tryLogin(baseUrl) {
  const loginParams = new URLSearchParams();
  loginParams.append('account', username.trim());
  loginParams.append('password', password.trim());

  const res = await axios.post(`${baseUrl}/WManage/api/login`, loginParams.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    timeout: 15000
  });

  if (res.data && res.data.success) {
    const cookies = res.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
    return { success: true, cookieHeader, baseUrl };
  }
  return { success: false, data: res.data };
}

async function main() {
  const timeNow = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const actionText = action.toLowerCase() === 'enable' ? 'BẬT' : 'TẮT';

  console.log(`[${timeNow}] Bắt đầu thực hiện lệnh: ${actionText}`);

  if (!username || !password || !dongleSn) {
    await notifyTelegram(`❌ <b>LuxPower Thất bại</b>\nThiếu biến môi trường LUX_USER / LUX_PASSWORD / LUX_DONGLE.`);
    process.exit(1);
  }

  try {
    const servers = ['https://server.luxpowertek.com', 'https://vn.luxpowertek.com'];
    let loginData = null;
    let lastError = '';

    for (const srv of servers) {
      try {
        console.log(`Thử đăng nhập vào: ${srv}...`);
        const res = await tryLogin(srv);
        if (res.success) {
          loginData = res;
          break;
        } else {
          lastError = JSON.stringify(res.data);
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!loginData) {
      throw new Error(`Đăng nhập không thành công trên các máy chủ: ${lastError}`);
    }

    // Gửi lệnh Bật / Tắt
    const isEnable = action.toLowerCase() === 'enable';
    const setParams = new URLSearchParams();
    setParams.append('serialNum', dongleSn.trim());
    setParams.append('hold', isEnable ? '1' : '0');

    const setRes = await axios.post(
      `${loginData.baseUrl}/WManage/api/inverter/set/common`,
      setParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': loginData.cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 15000
      }
    );

    const successMsg = `☀️ <b>LuxPower Thông Báo</b>\n\n` +
                       `⏰ <b>Thời gian:</b> ${timeNow}\n` +
                       `⚙️ <b>Lệnh:</b> Đã <b>${actionText}</b> biến tần thành công!\n` +
                       `📟 <b>Thiết bị:</b> <code>${dongleSn.trim()}</code>`;
    
    await notifyTelegram(successMsg);

  } catch (error) {
    const errorMsg = `❌ <b>LuxPower Thất bại</b>\n\n` +
                     `⏰ <b>Thời gian:</b> ${timeNow}\n` +
                     `⚙️ <b>Lệnh:</b> ${actionText}\n` +
                     `⚠️ <b>Chi tiết:</b> ${error.message}`;
    await notifyTelegram(errorMsg);
    process.exit(1);
  }
}

main();
