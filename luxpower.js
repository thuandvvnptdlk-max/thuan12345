const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const BASE_URL = 'https://vn.luxpowertek.com';
const ACCOUNT = process.env.LUX_ACCOUNT;
const PASSWORD = process.env.LUX_PASSWORD;
const INVERTER_SN = process.env.INVERTER_SN || '60403U0700';
const rawAction = (process.argv[2] || 'enable').trim().toLowerCase();

const isEnable = rawAction === 'enable' || rawAction === 'true';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  }
}));

async function login() {
  console.log('>>> [1] Khoi tao phien ket noi & Session Cookie <<<');
  await client.get(`${BASE_URL}/WManage/web/login`);

  console.log('>>> [2] Dang nhap vao he thong LuxPower <<<');
  const loginParams = new URLSearchParams();
  loginParams.append('account', ACCOUNT);
  loginParams.append('password', PASSWORD);

  const loginRes = await client.post(`${BASE_URL}/WManage/web/login`, loginParams.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Referer': `${BASE_URL}/WManage/web/login`,
      'Origin': BASE_URL,
    }
  });
  console.log('Dang nhap thanh cong!');
}

async function sendControlCommand(enable) {
  const controlParams = new URLSearchParams();
  controlParams.append('inverterSn', INVERTER_SN);
  controlParams.append('functionParam', 'FUNC_TAKE_LOAD_TOGETHER');
  controlParams.append('enable', enable ? 'true' : 'false');
  controlParams.append('clientType', 'WEB');
  controlParams.append('remoteSetType', 'NORMAL');

  const res = await client.post(`${BASE_URL}/WManage/web/maintain/remoteSet/functionControl`, controlParams.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Referer': `${BASE_URL}/WManage/web/maintain/workingMode/index`,
      'Origin': BASE_URL,
    }
  });
  return res.data;
}

async function refreshServer() {
  try {
    const params = new URLSearchParams();
    params.append('inverterSn', INVERTER_SN);

    await client.post(`${BASE_URL}/WManage/web/maintain/remoteTransfer/refreshInputData`, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
      }
    });
    console.log('Da gui lenh ep bien tan dong bo du lieu ve server.');
  } catch (e) {
    // Bo qua loi refresh neu co
  }
}

async function run() {
  await login();

  const targetText = isEnable ? 'ENABLE (BAT)' : 'DISABLE (TAT)';
  console.log(`>>> [3] Tien hanh gui lenh: ${targetText} <<<`);

  let maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Dang gui lenh lan ${attempt}/${maxRetries}...`);
      const result = await sendControlCommand(isEnable);
      console.log('Ket qua phan hoi tu Inverter:', JSON.stringify(result));

      if (result && (result.success === true || result.msg === 'success' || !result.msg)) {
        await sleep(2000);
        await refreshServer();
        console.log(`>>> THANH CONG: DA ${targetText} HOAN TAT <<<`);
        return;
      } else {
        console.warn(`Server chua nhan lenh. Thu lai sau 3s...`);
        await sleep(3000);
      }
    } catch (err) {
      console.error(`Loi lan thu ${attempt}:`, err.message);
      if (attempt < maxRetries) await sleep(3000);
    }
  }

  throw new Error(`Da thu ${maxRetries} lan nhung server chua chap nhan.`);
}

run().catch((err) => {
  console.error('Loi:', err.message || err);
  process.exit(1);
});
