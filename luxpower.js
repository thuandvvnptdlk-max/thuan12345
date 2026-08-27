const BASE_URL = (process.env.BASE_URL || 'https://vn.luxpowertek.com').trim().replace(/\/+$/, '');
const ACCOUNT = process.env.LUX_ACCOUNT;
const PASSWORD = process.env.LUX_PASSWORD;
const INVERTER_SN = process.env.INVERTER_SN;
const ACTION = process.argv[2]; // 'enable' hoặc 'disable'

let cookieJar = [];

function saveCookies(response) {
  const rawCookies = response.headers.raw()['set-cookie'] || [];
  rawCookies.forEach((c) => {
    const parts = c.split(';')[0].split('=');
    if (parts.length === 2) {
      cookieJar.push(`${parts[0].trim()}=${parts[1].trim()}`);
    }
  });
}

function getCookieHeader() {
  return cookieJar.join('; ');
}

async function performLogin() {
  const nodeFetch = (await import('node-fetch')).default;

  console.log('--- 1. Khởi tạo phiên kết nối ---');
  const initRes = await nodeFetch(`${BASE_URL}/WManage/web/login/login`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });
  saveCookies(initRes);

  console.log('--- 2. Đăng nhập hệ thống LuxPower ---');
  const form = new URLSearchParams();
  form.append('account', ACCOUNT);
  form.append('password', PASSWORD);

  const loginRes = await nodeFetch(`${BASE_URL}/WManage/web/login/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/WManage/web/login/login`,
      'Cookie': getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: form.toString(),
  });
  saveCookies(loginRes);

  const resText = await loginRes.text();
  console.log('Kết quả đăng nhập:', resText);
}

async function sendControl(enable) {
  const nodeFetch = (await import('node-fetch')).default;
  
  await performLogin();

  console.log(`--- 3. Gửi lệnh điều khiển: ${enable ? 'BẬT' : 'TẮT'} ---`);
  const form = new URLSearchParams();
  form.append('inverterSn', INVERTER_SN);
  form.append('functionParam', '1');
  form.append('enable', enable ? 'true' : 'false');

  const controlRes = await nodeFetch(`${BASE_URL}/WManage/web/config/function/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: form.toString(),
  });

  const result = await controlRes.text();
  console.log('Phản hồi từ LuxPower:', result);
}

const isEnable = ACTION === 'enable';
sendControl(isEnable)
  .then(() => {
    console.log('Hoàn thành!');
  })
  .catch((err) => {
    console.error('Lỗi thực thi:', err);
    process.exit(1);
  });
