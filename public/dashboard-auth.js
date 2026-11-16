"use strict";

// M3-C1：前端只管理顯示狀態；身分、權限與 CSRF 均由 Express 驗證。
let currentCsrfToken = null;
const boot = document.getElementById("auth-boot");
const projectMessage = document.getElementById("project-message");
const projectList = document.getElementById("project-list");
const projectForm = document.getElementById("project-create");
const projectName = document.getElementById("project-name");
const logoutButton = document.getElementById("logout-button");

function showBootError(text) {
  document.body.classList.remove("auth-pending");
  document.body.classList.add("auth-error");
  boot.textContent = `${text} `;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "重新整理";
  retry.addEventListener("click", () => window.location.reload());
  boot.append(retry);
}

function showProjectMessage(text, error = false) {
  projectMessage.textContent = text;
  projectMessage.dataset.error = String(error);
}

function goToLogin() {
  currentCsrfToken = null;
  window.location.replace("/auth.html");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
  });
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 401) {
    goToLogin();
    throw new Error("登入已失效，請重新登入。");
  }
  if (!response.ok) {
    const error = new Error(
      data?.message || `請求失敗（HTTP ${response.status}）。`,
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

function renderProjects(projects) {
  const elements = projects.map((project) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const role = document.createElement("small");
    title.textContent = project.name;
    role.textContent = `${project.myRole} · ${project.status}`;
    item.append(title, role);
    return item;
  });
  projectList.replaceChildren(...elements);
  if (projects.length === 0) {
    showProjectMessage("目前沒有專案，可以建立第一個專案。");
  } else {
    showProjectMessage(`目前有 ${projects.length} 個專案。`);
  }
}

async function loadProjects() {
  const data = await fetchJson("/api/projects");
  if (!Array.isArray(data?.projects)) throw new Error("專案清單格式異常。");
  renderProjects(data.projects);
}

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentCsrfToken || !projectForm.reportValidity()) return;
  const button = projectForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showProjectMessage("正在建立專案…");
  try {
    await fetchJson("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TaskFlow-CSRF": currentCsrfToken,
      },
      body: JSON.stringify({ name: projectName.value.trim() }),
    });
    projectForm.reset();
    await loadProjects();
  } catch (error) {
    showProjectMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  if (!currentCsrfToken) return;
  logoutButton.disabled = true;
  try {
    await fetchJson("/api/auth/logout", {
      method: "POST",
      headers: { "X-TaskFlow-CSRF": currentCsrfToken },
    });
    goToLogin();
  } catch (error) {
    showProjectMessage(error.message, true);
    logoutButton.disabled = false;
  }
});

(async () => {
  try {
    const session = await fetchJson("/api/auth/me");
    if (!session?.user || !/^[a-f0-9]{64}$/.test(session.csrfToken || "")) {
      throw new Error("登入資料格式不完整。");
    }
    currentCsrfToken = session.csrfToken;
    document.getElementById("user-display").textContent =
      session.user.displayName;
    document.querySelector(".avatar").textContent = session.user.displayName
      .slice(0, 1)
      .toUpperCase();
    document
      .querySelector(".avatar")
      .setAttribute("aria-label", `使用者：${session.user.displayName}`);
    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");
    try {
      await loadProjects();
    } catch (error) {
      showProjectMessage(error.message, true);
    }
  } catch (error) {
    // 若已因 401 導向登入頁，不再顯示過渡畫面。
    showBootError(error.message || "無法驗證登入狀態。");
  }
})();
