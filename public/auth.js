"use strict";

// M3-C1：瀏覽器身分驗證。Session Cookie 由瀏覽器管理；不寫入 localStorage。
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginButton = document.getElementById("show-login");
const registerButton = document.getElementById("show-register");
const message = document.getElementById("auth-message");
const title = document.getElementById("form-title");
const subtitle = document.getElementById("form-subtitle");
let busy = false;

function showMessage(text, type = "error") {
  message.textContent = text;
  message.dataset.type = type;
  message.hidden = !text;
}

function chooseMode(mode) {
  const registration = mode === "register";
  loginForm.hidden = registration;
  registerForm.hidden = !registration;
  loginButton.classList.toggle("selected", !registration);
  registerButton.classList.toggle("selected", registration);
  loginButton.setAttribute("aria-pressed", String(!registration));
  registerButton.setAttribute("aria-pressed", String(registration));
  title.textContent = registration ? "建立 TaskFlow 帳號" : "歡迎回來";
  subtitle.textContent = registration
    ? "註冊後請登入，開始管理你的專案。"
    : "登入後查看自己的專案工作空間。";
  showMessage("");
}

function setBusy(value) {
  busy = value;
  for (const element of [
    ...loginForm.querySelectorAll("input, button"),
    ...registerForm.querySelectorAll("input, button"),
    loginButton,
    registerButton,
  ]) {
    element.disabled = value;
  }
}

async function api(route, body) {
  const response = await fetch(route, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      json?.message || `請求失敗（HTTP ${response.status}）。`,
    );
    error.status = response.status;
    throw error;
  }
  return json;
}

loginButton.addEventListener("click", () => {
  if (!busy) chooseMode("login");
});
registerButton.addEventListener("click", () => {
  if (!busy) chooseMode("register");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !loginForm.reportValidity()) return;
  setBusy(true);
  showMessage("");
  try {
    await api("/api/auth/login", {
      email: document.getElementById("login-email").value.trim(),
      password: document.getElementById("login-password").value,
    });
    document.getElementById("login-password").value = "";
    window.location.replace("/");
  } catch (error) {
    showMessage(
      error.status === 429 ? "登入嘗試過多，請稍後再試。" : error.message,
    );
    setBusy(false);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !registerForm.reportValidity()) return;
  const password = document.getElementById("register-password").value;
  const confirm = document.getElementById("register-confirm").value;
  if (password !== confirm) {
    showMessage("兩次輸入的密碼不一致。");
    return;
  }
  setBusy(true);
  showMessage("");
  try {
    const email = document.getElementById("register-email").value.trim();
    await api("/api/auth/register", {
      email,
      password,
      displayName: document.getElementById("register-name").value.trim(),
    });
    registerForm.reset();
    chooseMode("login");
    document.getElementById("login-email").value = email;
    showMessage("帳號已建立，請使用剛才的密碼登入。", "success");
    document.getElementById("login-password").focus();
  } catch (error) {
    showMessage(error.message);
  } finally {
    setBusy(false);
  }
});

// 已登入使用者再開啟本頁時，直接回到工作空間。
(async () => {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.ok) window.location.replace("/");
  } catch {
    showMessage("目前無法確認伺服器狀態，請確認 TaskFlow 已啟動。", "error");
  }
})();
