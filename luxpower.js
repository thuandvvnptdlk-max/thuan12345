const BASE_URL = 'https://vn.luxpowertek.com';
const ACCOUNT = process.env.LUX_ACCOUNT;
const PASSWORD = process.env.LUX_PASSWORD;
const INVERTER_SN = process.env.INVERTER_SN || '60403U0700';
const ACTION = process.argv[2] || 'enable';

let cookies = {};

function parseAndSaveCookies(res) {
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

async function login() {
  console.log('--- 1. Khoi tao phien va lay Cookie ---');
  const initRes = await fetch(`${BASE_URL}/WManage/web/login`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });
  parseAndSaveCookies(initRes);

  console.log('--- 2. Dang nhap tai khoan ---');
  const form = new URLSearchParams();
  form.append('account', ACCOUNT);
  form.append('password', PASSWORD);

  const res = await fetch(`${BASE_URL}/WManage/web/login/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/WManage/web/login`,
      'Cookie': getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: form.toString(),
  });

  parseAndSaveCookies(res);
  const text = await res.text();
  console.log('Ket qua login:', text);

  if (text.includes('405') || text.includes('<html>')) {
    throw new Error('Dang nhap khong thanh cong, bi server tu choi.');
  }
}

async function sendControl(enable) {
  await login();

  const isEnable = Boolean(enable);
  console.log(`--- 3. Gui lenh dieu khien: ${isEnable ? 'ENABLE (BAT)' : 'DISABLE (TAT)'} ---`);

  const form = new URLSearchParams();
  form.append('inverterSn', INVERTER_SN);
  form.append('functionParam', 'FUNC_TAKE_LOAD_TOGETHER');
  form.append('enable', isEnable ? 'true' : 'false');
  form.append('clientType', 'WEB');
  form.append('remoteSetType', 'NORMAL');

  const res = await fetch(`${BASE_URL}/WManage/web/maintain/remoteSet/functionControl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/WManage/web/maintain/workingMode/index`,
      'Cookie': getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: form.toString(),
  });

  parseAndSaveCookies(res);
  const text = await res.text();
  console.log('Ket qua tu bien tan:', text);
}

const isEnable = ACTION === 'enable';
sendControl(isEnable)
  .then(() => {
    console.log('Thuc hien lenh hoan tat!');
  })
  .catch((err) => {
    console.error('Loi:', err.message || err);
    process.exit(1);
  });
