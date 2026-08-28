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
    const userToken = loginRes.data.token || (loginRes.data.rows && loginRes.data.rows.token) || '';

    console.log("Đăng nhập thành công!");

    // 2. Danh sách các endpoint điều khiển tiềm năng
    const isEnable = action.toLowerCase() === 'enable';
    const postBody = new URLSearchParams();
    postBody.append('serialNum', dongleSn.trim());
    postBody.append('inverterSn', dongleSn.trim());
    postBody.append('hold', isEnable ? '1' : '0');
    postBody.append('remoteType', '1');

    const endpoints = [
      `${domain}/WManage/web/inverter/set/common`,
      `${domain}/WManage/web/inverter/setCommon`,
      `${domain}/WManage/api/inverter/setCommon`,
      `${domain}/WManage/api/setCommon`,
      `${domain}/WManage/api/v1/inverter/set/common`
    ];

    let success = false;
    let successData = null;
    const errors = [];

    for (const ep of endpoints) {
      try {
        console.log(`Thử gửi tới: ${ep}`);
        const res = await axios.post(ep, postBody.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieHeader,
            'token': userToken,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          timeout: 15000
        });

        if (res.data && (res.data.success || res.data.msgCode === 200 || res.data.code === 200)) {
          success = true;
          successData = res.data;
          console.log(`Thành công với endpoint: ${ep}`);
          break;
        } else {
          errors.push(`${ep} => ${JSON.stringify(res.data)}`);
        }
      } catch (e) {
        errors.push(`${ep} => HTTP ${e.response ? e.response.status : e.message}`);
      }
    }

    if (!success) {
      throw new Error(errors.join('\n'));
    }

    // 3. Thông báo thành công về Telegram
    const successMsg = `☀️ LuxPower Thông Báo\n\n` +
                       `⏰ Thời gian: ${timeNow}\n` +
                       `⚙️ Lệnh: Đã ${actionText} biến tần thành công!\n` +
                       `📟 Thiết bị: ${dongleSn.trim()}`;

    await notifyTelegram(successMsg);
    console.log("Hoàn tất.");

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
