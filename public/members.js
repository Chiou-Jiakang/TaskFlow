"use strict";

// M4-C1：權限由後端 API 驗證，前端只控制操作介面。
const queryId = new URLSearchParams(window.location.search).get("projectId");
const projectId =
  typeof queryId === "string" &&
  /^[1-9]\d*$/.test(queryId) &&
  Number.isSafeInteger(Number(queryId))
    ? Number(queryId)
    : null;

const state = {
  user: null,
  csrf: null,
  project: null,
  version: null,
  members: [],
  busy: false,
};

const el = (id) => document.getElementById(id);
const list = el("member-list");
const message = el("member-message");
const form = el("member-add-form");

const roleNames = {
  owner: "Owner（擁有者）",
  admin: "Admin（管理員）",
  member: "Member（成員）",
};

function notice(text, error = false) {
  message.textContent = text;
  message.dataset.error = String(error);
}

function goToLogin() {
  state.csrf = null;
  window.location.replace("/auth.html");
}

function fatal(text) {
  document.body.classList.remove("auth-pending");
  document.body.classList.add("auth-error");
  el("auth-boot").textContent = text;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
  });

  const data =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (response.status === 401) {
    goToLogin();
    const error = new Error("登入已過期，請重新登入。");
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || `請求失敗（HTTP ${response.status}）。`,
    );
    error.status = response.status;
    error.code = data?.error;
    throw error;
  }

  return data;
}

function disableActions(value) {
  state.busy = value;

  for (const button of document.querySelectorAll(".member-main button")) {
    button.disabled =
      value ||
      (button.dataset.roleSave === "true" &&
        button.previousElementSibling?.value === button.dataset.originalRole);
  }
}

function makeButton(text, handler, dangerous = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  if (dangerous) button.className = "danger";
  button.addEventListener("click", handler);
  return button;
}

function renderMembers() {
  const isOwner = state.project.myRole === "owner";
  const isAdmin = state.project.myRole === "admin";

  el("project-title").textContent = state.project.name;
  el("my-role").textContent = roleNames[state.project.myRole] || "未知角色";
  el("project-version").textContent = String(state.version);
  el("member-count").textContent = String(state.members.length);

  el("add-section").hidden = !(isOwner || isAdmin);

  el("member-role").querySelector('option[value="admin"]').hidden = !isOwner;

  if (!isOwner) {
    el("member-role").value = "member";
  }

  const rows = state.members.map((member) => {
    const item = document.createElement("li");
    item.className = "member-row";

    const person = document.createElement("div");
    person.className = "member-person";

    const name = document.createElement("strong");
    name.textContent = member.displayName || "未提供名稱";

    const email = document.createElement("small");
    email.textContent = member.email || "";

    const role = document.createElement("span");
    role.className = "member-role-badge";
    role.textContent = roleNames[member.role] || "未知角色";

    person.append(name, email, role);

    const actions = document.createElement("div");
    actions.className = "member-actions";

    const isSelf = member.userId === state.user.id;

    // Owner 可以更改其他 Admin / Member 的角色。
    if (isOwner && !isSelf && member.role !== "owner") {
      const select = document.createElement("select");
      select.setAttribute("aria-label", `調整 ${member.displayName} 的角色`);

      for (const value of ["member", "admin"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = roleNames[value];
        select.append(option);
      }

      select.value = member.role;

      const save = makeButton("更新角色", () =>
        changeRole(member, select.value),
      );
      save.dataset.roleSave = "true";
      save.dataset.originalRole = member.role;
      save.disabled = true;

      select.addEventListener("change", () => {
        save.disabled = select.value === member.role;
      });

      actions.append(select, save);
    }

    const mayRemove =
      (isOwner && !isSelf && member.role !== "owner") ||
      (isAdmin && !isSelf && member.role === "member");

    if (mayRemove) {
      actions.append(
        makeButton("移除", () => removeMember(member, false), true),
      );
    } else if (isSelf && state.project.myRole !== "owner") {
      actions.append(
        makeButton("退出專案", () => removeMember(member, true), true),
      );
    }

    item.append(person, actions);
    return item;
  });

  list.replaceChildren(...rows);
}

async function refresh() {
  const base = `/api/projects/${projectId}`;

  const [projectData, memberData] = await Promise.all([
    api(base),
    api(`${base}/members`),
  ]);

  if (
    !projectData?.project ||
    !Array.isArray(memberData?.members) ||
    !Number.isSafeInteger(memberData.version)
  ) {
    throw new Error("伺服器回傳的專案或成員資料格式異常。");
  }

  state.project = projectData.project;
  state.version = memberData.version;
  state.members = memberData.members;

  renderMembers();
}

async function runMutation(operation, successText) {
  if (state.busy) return;

  disableActions(true);
  notice("正在處理…");

  try {
    await operation();
    await refresh();
    notice(successText);
  } catch (error) {
    if (error.status === 401) return;

    if (error.status === 409) {
      try {
        await refresh();
      } catch (refreshError) {
        notice(refreshError.message, true);
        return;
      }

      notice(
        "專案已被其他操作更新，已重新載入最新版本，請再次確認後操作。",
        true,
      );
    } else {
      notice(error.message, true);
    }
  } finally {
    disableActions(false);
  }
}

function writeOptions(method, body) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-TaskFlow-CSRF": state.csrf,
    },
    body: JSON.stringify(body),
  };
}

function changeRole(member, role) {
  if (!Object.hasOwn(roleNames, role) || role === "owner") return;

  runMutation(
    () =>
      api(
        `/api/projects/${projectId}/members/${member.userId}`,
        writeOptions("PATCH", { version: state.version, role }),
      ),
    "已更新成員角色。",
  );
}

function removeMember(member, self) {
  const question = self
    ? "確定要退出這個專案？退出後將無法再查看成員資料。"
    : `確定移除 ${member.displayName}（${member.email}）？`;

  if (!window.confirm(question)) return;

  const action = () =>
    api(
      `/api/projects/${projectId}/members/${member.userId}?version=${state.version}`,
      {
        method: "DELETE",
        headers: { "X-TaskFlow-CSRF": state.csrf },
      },
    );

  if (self) {
    if (state.busy) return;

    disableActions(true);
    notice("正在退出專案…");

    action()
      .then(() => window.location.assign("/"))
      .catch(async (error) => {
        if (error.status === 401) return;

        if (error.status === 409) {
          try {
            await refresh();
          } catch {
            // 保留原始錯誤訊息。
          }
        }

        notice(error.message, true);
        disableActions(false);
      });
  } else {
    runMutation(action, "已移除成員。");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity() || state.busy) return;

  const email = el("member-email").value.trim();
  const role = el("member-role").value;

  runMutation(async () => {
    await api(
      `/api/projects/${projectId}/members`,
      writeOptions("POST", {
        version: state.version,
        email,
        role,
      }),
    );

    form.reset();
  }, "已新增成員。");
});

el("refresh-members").addEventListener("click", async () => {
  if (state.busy) return;

  disableActions(true);

  try {
    await refresh();
    notice("已更新成員清單。");
  } catch (error) {
    if (error.status !== 401) notice(error.message, true);
  } finally {
    disableActions(false);
  }
});

el("logout-button").addEventListener("click", async () => {
  if (state.busy || !state.csrf) return;

  disableActions(true);

  try {
    await api("/api/auth/logout", {
      method: "POST",
      headers: { "X-TaskFlow-CSRF": state.csrf },
    });
    goToLogin();
  } catch (error) {
    if (error.status !== 401) notice(error.message, true);
    disableActions(false);
  }
});

(async () => {
  if (!projectId) {
    fatal("專案連結不正確，請返回首頁重新選擇專案。");
    return;
  }

  try {
    const data = await api("/api/auth/me");

    if (!data?.user || !/^[a-f0-9]{64}$/.test(data.csrfToken || "")) {
      throw new Error("登入資料格式不完整。");
    }

    state.user = data.user;
    state.csrf = data.csrfToken;

    el("user-display").textContent = data.user.displayName;
    document.querySelector(".avatar").textContent = data.user.displayName
      .slice(0, 1)
      .toUpperCase();

    await refresh();

    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");

    notice(`目前有 ${state.members.length} 位專案成員。`);
  } catch (error) {
    if (error.status !== 401) {
      fatal(error.message || "無法讀取成員資料。");
    }
  }
})();
