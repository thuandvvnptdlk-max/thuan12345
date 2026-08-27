const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const BASE_URL = 'https://vn.luxpowertek.com';

const ACCOUNT = process.env.LUX_ACCOUNT;
const PASSWORD = process.env.LUX_PASSWORD;
const INVERTER_SN = process.env.INVERTER_SN;

const rawAction = (process.argv[2] || 'enable').trim().toLowerCase();

const isEnable =
  rawAction === 'enable' ||
  rawAction === 'true';

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const jar = new CookieJar();

const client = wrapper(
  axios.create({
    jar,
    withCredentials: true,
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    },
  })
);


// ======================================================
// KIEM TRA CAU HINH
// ======================================================

function checkConfig() {
  if (!ACCOUNT) {
    throw new Error('Thieu LUX_ACCOUNT trong GitHub Secrets');
  }

  if (!PASSWORD) {
    throw new Error('Thieu LUX_PASSWORD trong GitHub Secrets');
  }

  if (!INVERTER_SN) {
    throw new Error('Thieu INVERTER_SN trong GitHub Secrets');
  }

  if (!['enable', 'disable', 'true', 'false'].includes(rawAction)) {
    throw new Error(
      `Action khong hop le: "${rawAction}". Chi nhan enable hoac disable.`
    );
  }

  console.log(`Inverter SN: ${INVERTER_SN}`);
  console.log(`Action yeu cau: ${isEnable ? 'ENABLE (BAT)' : 'DISABLE (TAT)'}`);
}


// ======================================================
// LOGIN
// ======================================================

async function login() {
  console.log('');
  console.log('>>> [1] Khoi tao phien ket noi & Session Cookie <<<');

  await client.get(`${BASE_URL}/WManage/web/login`);

  console.log('>>> [2] Dang nhap vao he thong LuxPower <<<');

  const loginParams = new URLSearchParams();

  loginParams.append('account', ACCOUNT);
  loginParams.append('password', PASSWORD);

  const loginRes = await client.post(
    `${BASE_URL}/WManage/web/login`,
    loginParams.toString(),
    {
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: `${BASE_URL}/WManage/web/login`,
        Origin: BASE_URL,
      },
    }
  );

  console.log(
    'Login response:',
    JSON.stringify(loginRes.data)
  );

  // Kiem tra mot so dang response pho bien cua LuxPower
  const data = loginRes.data;

  if (
    data &&
    data.success === false
  ) {
    throw new Error(
      `Dang nhap that bai: ${data.msg || data.message || 'Unknown error'}`
    );
  }

  if (
    data &&
    typeof data.code !== 'undefined' &&
    String(data.code) !== '0' &&
    data.success !== true
  ) {
    console.warn(
      `Login tra ve code=${data.code}. Tiep tuc kiem tra session...`
    );
  }

  console.log('Dang nhap xong.');
}


// ======================================================
// GUI LENH CONTROL
// ======================================================

async function sendControlCommand(enable) {
  const controlParams = new URLSearchParams();

  controlParams.append('inverterSn', INVERTER_SN);
  controlParams.append(
    'functionParam',
    'FUNC_TAKE_LOAD_TOGETHER'
  );
  controlParams.append(
    'enable',
    enable ? 'true' : 'false'
  );
  controlParams.append('clientType', 'WEB');
  controlParams.append('remoteSetType', 'NORMAL');

  console.log('');
  console.log('--- Control parameters ---');
  console.log(`inverterSn: ${INVERTER_SN}`);
  console.log('functionParam: FUNC_TAKE_LOAD_TOGETHER');
  console.log(`enable: ${enable ? 'true' : 'false'}`);
  console.log('clientType: WEB');
  console.log('remoteSetType: NORMAL');
  console.log('--------------------------');

  const res = await client.post(
    `${BASE_URL}/WManage/web/maintain/remoteSet/functionControl`,
    controlParams.toString(),
    {
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer:
          `${BASE_URL}/WManage/web/maintain/workingMode/index`,
        Origin: BASE_URL,
      },
    }
  );

  return res.data;
}


// ======================================================
// KIEM TRA RESPONSE LENH
// ======================================================

function isCommandSuccessful(result) {
  if (!result) {
    return false;
  }

  // Dang response ro rang
  if (result.success === true) {
    return true;
  }

  if (
    typeof result.msg === 'string' &&
    result.msg.toLowerCase() === 'success'
  ) {
    return true;
  }

  if (
    typeof result.message === 'string' &&
    result.message.toLowerCase() === 'success'
  ) {
    return true;
  }

  // Mot so API co the tra code = 0
  if (
    typeof result.code !== 'undefined' &&
    String(result.code) === '0'
  ) {
    return true;
  }

  return false;
}


// ======================================================
// REFRESH DU LIEU DU SERVER
// ======================================================

async function refreshServer() {
  try {
    const params = new URLSearchParams();

    params.append('inverterSn', INVERTER_SN);

    const res = await client.post(
      `${BASE_URL}/WManage/web/maintain/remoteTransfer/refreshInputData`,
      params.toString(),
      {
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Accept:
            'application/json, text/javascript, */*; q=0.01',
          Referer:
            `${BASE_URL}/WManage/web/maintain/workingMode/index`,
          Origin: BASE_URL,
        },
      }
    );

    console.log(
      'Refresh response:',
      JSON.stringify(res.data)
    );

    console.log(
      'Da gui lenh yeu cau bien tan dong bo du lieu ve server.'
    );

    return true;
  } catch (e) {
    console.warn(
      'Refresh server that bai:',
      e.message
    );

    return false;
  }
}


// ======================================================
// MAIN
// ======================================================

async function run() {
  checkConfig();

  await login();

  const targetText = isEnable
    ? 'ENABLE (BAT)'
    : 'DISABLE (TAT)';

  console.log('');
  console.log(
    `>>> [3] Tien hanh gui lenh: ${targetText} <<<`
  );

  const maxRetries = 3;

  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      console.log('');
      console.log(
        `Dang gui lenh lan ${attempt}/${maxRetries}...`
      );

      const result =
        await sendControlCommand(isEnable);

      console.log(
        'Ket qua phan hoi tu LuxPower:'
      );

      console.log(
        JSON.stringify(result, null, 2)
      );

      if (isCommandSuccessful(result)) {
        console.log('');
        console.log(
          'Server da chap nhan lenh.'
        );

        // Cho server/inverter co thoi gian xu ly
        await sleep(2000);

        // Refresh du lieu
        await refreshServer();

        console.log('');
        console.log(
          `>>> THANH CONG: DA ${targetText} <<<`
        );

        return;
      }

      console.warn(
        'Server khong tra ve response thanh cong.'
      );

      if (attempt < maxRetries) {
        console.log(
          'Thu lai sau 3 giay...'
        );

        await sleep(3000);
      }

    } catch (err) {
      console.error(
        `Loi lan thu ${attempt}:`,
        err.response
          ? JSON.stringify(err.response.data)
          : err.message
      );

      if (attempt < maxRetries) {
        console.log(
          'Thu lai sau 3 giay...'
        );

        await sleep(3000);
      }
    }
  }

  throw new Error(
    `Da thu ${maxRetries} lan nhung khong xac nhan duoc lenh ${targetText}.`
  );
}


// ======================================================
// RUN
// ======================================================

run()
  .then(() => {
    console.log('');
    console.log('Hoan tat.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('');
    console.error(
      '======================================'
    );
    console.error(
      'LUXPOWER CONTROL THAT BAI'
    );
    console.error(
      '======================================'
    );
    console.error(
      err.message || err
    );

    process.exit(1);
  });
