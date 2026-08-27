// Trích xuất từ content.js:
headers: {
  "Content-Type": "application/json;charset=UTF-8",
  "X-Requested-With": "XMLHttpRequest"
},
body: JSON.stringify(payload)
```[cite: 2]

Khi gửi `URLSearchParams` (dạng form), server LuxPower không đọc được payload và bỏ qua lệnh[cite: 1, 2]. 

---

### Code chuẩn hoàn chỉnh cho `luxpower.js`

Bạn mở file `luxpower.js` trên GitHub, xóa toàn bộ và dán đoạn mã này:

```javascript
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
  console.log('--- 1. Dang nhap tai khoan LuxPower ---');
  const form = new URLSearchParams();
  form.append('account', ACCOUNT);
  form.append('password', PASSWORD);

  const res = await fetch(`${BASE_URL}/WManage/web/login/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: form.toString(),
  });

  parseAndSaveCookies(res);
  const text = await res.text();
  console.log('Phan hoi dang nhap:', text);
}

async function sendControl(enable) {
  await login();

  const isEnable = Boolean(enable);
  console.log(`--- 2. Gui lenh dieu khien: ${isEnable ? 'ENABLE (BAT)' : 'DISABLE (TAT)'} ---`);

  const payload = {
    inverterSn: INVERTER_SN,
    functionParam: 'FUNC_TAKE_LOAD_TOGETHER',
    enable: isEnable,
    clientType: 'WEB',
    remoteSetType: 'NORMAL'
  };

  const res = await fetch(`${BASE_URL}/WManage/web/maintain/remoteSet/functionControl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Cookie': getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log('Ket qua tu bien tan:', text);
}

const isEnable = ACTION === 'enable';
sendControl(isEnable)
  .then(() => {
    console.log('Hoan thanh xu ly!');
  })
  .catch((err) => {
    console.error('Loi thuc thi:', err);
    process.exit(1);
  });
