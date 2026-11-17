"use strict";

// M5-C1：沿用 Cookie Session / CSRF，並將專案交給正式任務看板。
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
    const info = document.createElement("div");
    const title = document.createElement("strong");
    const role = document.createElement("small");
    const actions = document.createElement("div");
    const manage = document.createElement("a");
    const board = document.createElement("button");

    info.className = "tf-project-info";
    title.textContent = project.name;
    role.textContent = `${project.myRole} · ${project.status}`;
    info.append(title, role);

    actions.className = "tf-project-actions";
    manage.href = `/members.html?projectId=${encodeURIComponent(project.id)}`;
    manage.textContent = "管理成員";
    manage.className = "member-entry-link";
    manage.setAttribute("aria-label", `管理「${project.name}」的成員`);

    board.type = "button";
    board.textContent = "開啟任務看板";
    board.setAttribute("aria-label", `開啟「${project.name}」任務看板`);
    board.addEventListener("click", () =>
      window.TaskBoard.selectProject(project.id),
    );
    actions.append(board, manage);
    item.append(info, actions);
    return item;
  });
  projectList.replaceChildren(...elements);
  showProjectMessage(
    projects.length === 0
      ? "目前沒有專案，可以建立第一個專案。"
      : `目前有 ${projects.length} 個專案。`,
  );
}

async function loadProjects(preferredId = null) {
  const data = await fetchJson("/api/projects");
  if (!Array.isArray(data?.projects)) {
    throw new Error("專案清單格式異常。");
  }
  renderProjects(data.projects);
  window.TaskBoard.setProjects(data.projects, preferredId);
}

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentCsrfToken || !projectForm.reportValidity()) return;
  const button = projectForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showProjectMessage("正在建立專案…");
  try {
    const created = await fetchJson("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TaskFlow-CSRF": currentCsrfToken,
      },
      body: JSON.stringify({ name: projectName.value.trim() }),
    });
    projectForm.reset();
    await loadProjects(created?.project?.id);
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
    const avatar = document.querySelector(".avatar");
    avatar.textContent = session.user.displayName.slice(0, 1).toUpperCase();
    avatar.setAttribute("aria-label", `使用者：${session.user.displayName}`);
    window.TaskBoard.openSession(session.user, currentCsrfToken);
    await loadProjects();
    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");
  } catch (error) {
    showBootError(error.message || "無法驗證登入狀態。");
  }
})();
