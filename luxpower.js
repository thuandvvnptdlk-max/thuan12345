const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const BASE_URL = 'https://vn.luxpowertek.com';
const ACCOUNT = process.env.LUX_ACCOUNT;
const PASSWORD = process.env.LUX_PASSWORD;
const INVERTER_SN = process.env.INVERTER_SN || '60403U0700';
const ACTION = process.argv[2] || 'enable';

const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  }
}));

async function run() {
  console.log('>>> [1] Khoi tao phien ket noi & Session Cookie <<<');
  await client.get(`${BASE_URL}/WManage/web/login`);

  console.log('>>> [2] Dang nhap vao tai khoan LuxPower <<<');
  const loginParams = new URLSearchParams();
  loginParams.append('account', ACCOUNT);
  loginParams.append('password', PASSWORD);

  const loginRes = await client.post(`${BASE_URL}/WManage/web/login/login`, loginParams.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Referer': `${BASE_URL}/WManage/web/login`,
      'Origin': BASE_URL,
    }
  });
  console.log('Ket qua login:', JSON.stringify(loginRes.data));

  const isEnable = ACTION === 'enable';
  console.log(`>>> [3] Gui lenh dieu khien: ${isEnable ? 'ENABLE (BAT)' : 'DISABLE (TAT)'} <<<`);

  const payload = {
    inverterSn: INVERTER_SN,
    functionParam: 'FUNC_TAKE_LOAD_TOGETHER',
    enable: isEnable,
    clientType: 'WEB',
    remoteSetType: 'NORMAL'
  };

  const controlRes = await client.post(`${BASE_URL}/WManage/web/maintain/remoteSet/functionControl`, payload, {
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Referer': `${BASE_URL}/WManage/web/maintain/workingMode/index`,
      'Origin': BASE_URL,
    }
  });

  console.log('Ket qua tu Inverter:', JSON.stringify(controlRes.data));
  console.log('>>> THUC THI HOAN TAT <<<');
}

run().catch((err) => {
  console.error('Loi:', err.response ? JSON.stringify(err.response.data) : err.message);
  process.exit(1);
});
