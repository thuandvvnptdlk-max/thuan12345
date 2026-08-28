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

async function performLuxRequest(endpointBase) {
  const loginUrl = `${endpointBase}/login`;
  
  // Thử gửi dạng Form
  const params = new URLSearchParams();
  params.append('account', username.trim());
  params.append('password', password.trim());

  const loginRes = await axios.post(loginUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    timeout: 10000
  });

  if (loginRes.data && (loginRes.data.success || loginRes.data.msgCode === 200 || loginRes.data.code === 200)) {
    const cookies = loginRes.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
    return { success: true, cookieHeader, endpointBase, data: loginRes.data };
  }

  return { success: false, data: loginRes.data };
}

async function main() {
  const timeNow = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const actionText = action.toLowerCase() === 'enable' ? 'BẬT' : 'TẮT';

  console.log(`[${timeNow}] Bắt đầu thực hiện lệnh: ${actionText}`);

  if (!username || !password || !dongleSn) {
    await notifyTelegram(`❌ <b>LuxPower Thất bại</b>\nThiếu biến môi trường LUX_USER / LUX_PASSWORD / LUX_DONGLE.`);
    process.exit(1);
  }

  const candidateEndpoints = [
    'https://vn.luxpowertek.com/api',
    'https://vn.luxpowertek.com/WManage/web',
    'https://vn.luxpowertek.com/WManage/api',
    'https://server.luxpowertek.com/WManage/api'
  ];

  let activeSession = null;
  let errorHistory = [];

  for (const ep of candidateEndpoints) {
    try {
      console.log(`Kiểm tra cổng: ${ep}...`);
      const res = await performLuxRequest(ep);
      if (res.success) {
        activeSession = res;
        console.log(`Đăng nhập thành công tại cổng: ${ep}`);
        break;
      } else {
        errorHistory.push(`${ep} -> ${JSON.stringify(res.data)}`);
      }
    } catch (err) {
      errorHistory.push(`${ep} -> HTTP ${err.response ? err.response.status : err.message}`);
    }
  }

  if (!activeSession) {
    const msg = `❌ <b>LuxPower Thất bại</b>\n\n` +
                `⏰ <b>Thời gian:</b> ${timeNow}\n` +
                `⚙️ <b>Lệnh:</b> ${actionText}\n` +
                `⚠️ <b>Chi tiết phản hồi từ các cổng:</b>\n<code>${errorHistory.join('\n')}</code>`;
    await notifyTelegram(msg);
    process.exit(1);
  }

  try {
    const isEnable = action.toLowerCase() === 'enable';
    const setParams = new URLSearchParams();
    setParams.append('serialNum', dongleSn.trim());
    setParams.append('hold', isEnable ? '1' : '0');

    const targetSetUrl = `${activeSession.endpointBase}/inverter/set/common`;
    const setRes = await axios.post(targetSetUrl, setParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': activeSession.cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 10000
    });

    const successMsg = `☀️ <b>LuxPower Thông Báo</b>\n\n` +
                       `⏰ <b>Thời gian:</b> ${timeNow}\n` +
                       `⚙️ <b>Lệnh:</b> Đã <b>${actionText}</b> biến tần thành công!\n` +
                       `📟 <b>Thiết bị:</b> <code>${dongleSn.trim()}</code>`;
    await notifyTelegram(successMsg);
  } catch (error) {
    const detail = error.response ? `${error.message} (${JSON.stringify(error.response.data)})` : error.message;
    await notifyTelegram(`❌ <b>Lỗi gửi lệnh điều khiển:</b> ${detail}`);
    process.exit(1);
  }
}

main();
