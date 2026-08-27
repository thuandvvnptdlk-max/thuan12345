const BASE_URL = "https://vn.luxpowertek.com";
const ACCOUNT = process.env.LUX_ACCOUNT;
const PASSWORD = process.env.LUX_PASSWORD;
const INVERTER_SN = process.env.INVERTER_SN;
const ACTION = process.argv[2] || "enable";

let cookieJar = [];

function saveCookies(response) {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const parts = setCookie.split(";")[0].split("=");
    if (parts.length === 2) {
      cookieJar.push(`${parts[0].trim()}=${parts[1].trim()}`);
    }
  }
}

function getCookieHeader() {
  return cookieJar.join("; ");
}

async function performLogin() {
  console.log("--- 1. Khoi tao phien ket noi ---");
  const initUrl = new URL("/WManage/web/login/login", BASE_URL).toString();
  
  const initRes = await fetch(initUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  saveCookies(initRes);

  console.log("--- 2. Dang nhap he thong LuxPower ---");
  const form = new URLSearchParams();
  form.append("account", ACCOUNT);
  form.append("password", PASSWORD);

  const loginRes = await fetch(initUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": BASE_URL,
      "Referer": initUrl,
      "Cookie": getCookieHeader(),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    body: form.toString(),
  });
  saveCookies(loginRes);

  const resText = await loginRes.text();
  console.log("Ket qua dang nhap:", resText);
}

async function sendControl(enable) {
  await performLogin();

  console.log(`--- 3. Gui lenh dieu khien: ${enable ? "BAT" : "TAT"} ---`);
  const form = new URLSearchParams();
  form.append("inverterSn", INVERTER_SN);
  form.append("functionParam", "1");
  form.append("enable", enable ? "true" : "false");

  const controlUrl = new URL("/WManage/web/config/function/set", BASE_URL).toString();
  const controlRes = await fetch(controlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Cookie": getCookieHeader(),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    body: form.toString(),
  });

  const result = await controlRes.text();
  console.log("Phan hoi tu LuxPower:", result);
}

const isEnable = ACTION === "enable";
sendControl(isEnable)
  .then(() => {
    console.log("Thuc hien thanh cong!");
  })
  .catch((err) => {
    console.error("Loi thuc thi:", err);
    process.exit(1);
  });
