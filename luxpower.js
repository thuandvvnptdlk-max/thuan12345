const BASE_URL = 'https://vn.luxpowertek.com';
const ACCOUNT = process.env.LUX_ACCOUNT;
const PASSWORD = process.env.LUX_PASSWORD;
const INVERTER_SN = process.env.INVERTER_SN;
const ACTION = process.argv[2] || 'enable';

let cookies = {};

function parseAndSaveCookies(res) {
  // Trích xuất toàn bộ cookie từ header set-cookie
  let rawCookies = [];
  if (typeof res.headers.getSetCookie === 'function') {
    rawCookies = res.headers.getSetCookie();
  } else {
    const raw = res.headers.get('set-cookie');
    if (raw) rawCookies = [raw];
  }

  rawCookies.forEach((c) => {
    const firstPart = c.split(';')[0];
    const [key, ...vals] = firstPart.split('=');
    if (key && vals.length > 0) {
      cookies[key.trim()] = vals.join('=').trim();
    }
  });
}

function getCookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function performLogin() {
  console.log('--- 1. Khoi tao phien ket noi (GET login) ---');
  const initRes = await fetch(`${BASE_URL}/WManage/web/login`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });
  parseAndSaveCookies(initRes);

  console.log('--- 2. Gui thong tin dang nhap (POST login) ---');
  const form = new URLSearchParams();
  form.append('account', ACCOUNT);
  form.append('password', PASSWORD);

  const loginRes = await fetch(`${BASE_URL}/WManage/web/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/WManage/web/login`,
      'Cookie': getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: form.toString(),
  });
  parseAndSaveCookies(loginRes);

  const resText = await loginRes.text();
  console.log('Ket qua dang nhap:', resText);
}

async function sendControl(enable) {
  await performLogin();

  console.log(`--- 3. Gui lenh dieu khien: ${enable ? 'BAT' : 'TAT'} ---`);
  const form = new URLSearchParams();
  form.append('inverterSn', INVERTER_SN);
  form.append('functionParam', '1');
  form.append('enable', enable ? 'true' : 'false');

  const controlRes = await fetch(`${BASE_URL}/WManage/web/config/function/set`, {
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
  console.log('Phan hoi tu LuxPower:', result);
}

const isEnable = ACTION === 'enable';
sendControl(isEnable)
  .then(() => {
    console.log('Thuc hien thanh cong!');
  })
  .catch((err) => {
    console.error('Loi thuc thi:', err);
    process.exit(1);
  });
