"use strict";

// M6-C：正式 Task Kanban + 原子排序 API。
// 延續 M5 的 CRUD、Session / CSRF / RBAC，不做樂觀寫入。
(() => {
  const el = (id) => document.getElementById(id);
  const selector = el("task-project-select");
  const message = el("task-message");
  const form = el("task-form");
  const statusNames = {
    todo: "待處理",
    in_progress: "進行中",
    done: "已完成",
  };
  const priorityNames = { low: "低優先", medium: "中優先", high: "高優先" };
  const columnStatus = { todo: "todo", progress: "in_progress", done: "done" };

  const state = {
    user: null,
    csrf: null,
    projects: [],
    project: null,
    members: [],
    tasks: [],
    editingId: null,
    // M7-C：保留進入編輯時的版本，避免背景刷新後以新版本覆寫舊表單。
    editingVersion: null,
    busy: false,
    requestId: 0,
    dragging: null,
  };

  const dragHelp = document.createElement("p");
  dragHelp.className = "tf-drag-instructions";
  dragHelp.textContent =
    "Owner / Admin：拖曳卡片到其他欄位或調整同欄順序；也可按「上移／下移」操作。";
  dragHelp.hidden = true;
  document.querySelector(".board-section .section-heading > div")?.append(dragHelp);

  function notice(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }

  function isManager() {
    return state.project && ["owner", "admin"].includes(state.project.myRole);
  }

  function canWrite() {
    return state.project?.status === "active";
  }

  function canMove() {
    return Boolean(isManager() && canWrite() && !state.busy && state.csrf);
  }

  function taskUrl(id = "") {
    const base = `/api/projects/${selector.value}/tasks`;
    return id ? `${base}/${id}` : base;
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
      state.csrf = null;
      window.location.replace("/auth.html");
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

  function clearDropMarkers() {
    for (const list of document.querySelectorAll("#task-workspace .task-list")) {
      list.classList.remove("tf-drop-zone", "tf-drop-at-end");
      for (const card of list.querySelectorAll(".tf-drop-before")) {
        card.classList.remove("tf-drop-before");
      }
    }
  }

  function endDrag() {
    clearDropMarkers();
    for (const card of document.querySelectorAll(".tf-dragging")) {
      card.classList.remove("tf-dragging");
    }
    state.dragging = null;
  }

  function setBusy(value) {
    state.busy = value;
    if (value) endDrag();
    for (const control of el("task-workspace").querySelectorAll(
      "button, input, select, textarea",
    )) {
      control.disabled = value;
    }
    if (!value) {
      el("task-submit").disabled = !isManager() || !canWrite();
      // refresh() 在 busy 狀態會重建卡片，結束時重繪以恢復拖曳和操作。
      render();
      queueMicrotask(() => window.TaskRealtime?.flushPending());
    }
  }

  function resetForm() {
    state.editingId = null;
    state.editingVersion = null;
    form.reset();
    queueMicrotask(() => window.TaskRealtime?.flushPending());
    el("task-form-title").textContent = "新增任務";
    el("task-submit").textContent = "建立任務";
    el("task-cancel").hidden = true;
  }

  function renderAssignees() {
    const select = el("task-assignee");
    const previous = select.value;
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "未指派";
    const options = state.members.map((member) => {
      const option = document.createElement("option");
      option.value = String(member.userId);
      option.textContent = member.displayName || member.email;
      return option;
    });
    select.replaceChildren(empty, ...options);
    select.value = options.some((item) => item.value === previous)
      ? previous
      : "";
  }

  function sortedTasks() {
    return [...state.tasks].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
    );
  }

  function columnTasks(status) {
    return sortedTasks().filter((task) => task.status === status);
  }

  function emptyBoard() {
    for (const [column] of Object.entries(columnStatus)) {
      const section = document.querySelector(
        `.kanban-column[data-status="${column}"]`,
      );
      section.querySelector(".task-list").replaceChildren();
      section.querySelector(".column-count").textContent = "0";
    }
    for (const id of ["total-count", "progress-count", "done-count"]) {
      el(id).textContent = "0";
    }
  }

  function button(label, onClick, danger = false) {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.className = danger ? "tf-danger" : "tf-secondary";
    element.addEventListener("click", onClick);
    return element;
  }

  function moveTask(task, status, index) {
    if (!canMove() || !selector.value || !state.tasks.some((x) => x.id === task.id)) {
      return;
    }
    const remaining = columnTasks(status).filter((item) => item.id !== task.id);
    if (!Number.isSafeInteger(index) || index < 0 || index > remaining.length) {
      notice("目標排序位置不合法，請重新整理再操作。", true);
      return;
    }
    if (task.status === status) {
      const previousIndex = columnTasks(status).findIndex((x) => x.id === task.id);
      if (previousIndex === index) {
        notice("任務位置沒有變更。");
        return;
      }
    }
    // M6-B：只有等原子交易成功後才刷新正式資料，不先改前端 state。
    mutate(
      () =>
        api(
          `${taskUrl(task.id)}/move`,
          writeOptions("PATCH", {
            version: task.version,
            status,
            index,
          }),
        ),
      "任務已移動，排序已儲存。",
    );
  }

  function makeCard(task) {
    const card = document.createElement("article");
    card.className = "task-card tf-task-card";
    card.dataset.taskId = String(task.id);
    card.draggable = canMove();
    if (card.draggable) {
      card.classList.add("tf-can-drag");
      card.setAttribute("aria-label", `可拖曳排序：${task.title}`);
      card.addEventListener("dragstart", (event) => {
        if (!canMove() || !event.dataTransfer) {
          event.preventDefault();
          return;
        }
        endDrag();
        state.dragging = { taskId: task.id, projectId: selector.value };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(task.id));
        card.classList.add("tf-dragging");
      });
      card.addEventListener("dragend", () => {
        endDrag();
        queueMicrotask(() => window.TaskRealtime?.flushPending());
      });
    }

    const priority = document.createElement("span");
    priority.className = `task-category tf-priority-${task.priority}`;
    priority.textContent = priorityNames[task.priority] || task.priority;
    const title = document.createElement("h4");
    title.textContent = task.title;
    const description = document.createElement("p");
    description.textContent = task.description || "無描述";
    const assignee = state.members.find((m) => m.userId === task.assigneeId);
    const meta = document.createElement("p");
    meta.className = "tf-task-meta";
    meta.textContent = `負責人：${assignee?.displayName || assignee?.email || "未指派"}　·　截止：${task.dueDate || "未設定"}　·　v${task.version}`;
    card.append(priority, title, description, meta);

    if (card.draggable) {
      const hint = document.createElement("span");
      hint.className = "tf-drag-hint";
      hint.textContent = "⋮⋮ 拖曳排序";
      hint.setAttribute("aria-hidden", "true");
      card.append(hint);
    }

    if (canWrite()) {
      const actions = document.createElement("div");
      actions.className = "tf-task-actions";
      const mayChangeStatus = isManager() || task.assigneeId === state.user?.id;
      if (mayChangeStatus) {
        const status = document.createElement("select");
        status.setAttribute("aria-label", `變更「${task.title}」狀態`);
        for (const [value, label] of Object.entries(statusNames)) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          status.append(option);
        }
        status.value = task.status;
        status.addEventListener("change", () => {
          if (state.busy || status.value === task.status) return;
          if (isManager()) {
            // Manager 的狀態變更也走 M6-B，避免 position 與排序不同步。
            moveTask(task, status.value, columnTasks(status.value).length);
          } else {
            // Member 保留 M5 權限：僅能修改自己受指派任務的 status。
            mutate(
              () =>
                api(
                  taskUrl(task.id),
                  writeOptions("PATCH", {
                    version: task.version,
                    status: status.value,
                  }),
                ),
              "任務狀態已更新。",
            );
          }
        });
        actions.append(status);
      }
      if (isManager()) {
        const withinColumn = columnTasks(task.status);
        const index = withinColumn.findIndex((item) => item.id === task.id);
        if (index > 0) {
          actions.append(button("上移", () => moveTask(task, task.status, index - 1)));
        }
        if (index !== -1 && index < withinColumn.length - 1) {
          actions.append(button("下移", () => moveTask(task, task.status, index + 1)));
        }
        actions.append(
          button("編輯", () => editTask(task)),
          button("刪除", () => removeTask(task), true),
        );
      }
      card.append(actions);
    }
    return card;
  }

  function render() {
    endDrag();
    emptyBoard();
    el("task-project-name").textContent = state.project?.name || "尚未選擇專案";
    el("task-my-role").textContent = state.project?.myRole || "—";
    const editAllowed = Boolean(isManager() && canWrite());
    el("task-create-panel").hidden = !editAllowed;
    el("task-readonly-note").hidden = editAllowed || !state.project;
    dragHelp.hidden = !editAllowed;
    if (state.project) {
      el("task-readonly-note").textContent =
        state.project.status === "archived"
          ? "此專案已封存，只能讀取任務。"
          : "你的角色可查看任務；僅可更改自己受指派任務的狀態。";
    }
    renderAssignees();
    const tasks = sortedTasks();
    for (const [column, backendStatus] of Object.entries(columnStatus)) {
      const section = document.querySelector(
        `.kanban-column[data-status="${column}"]`,
      );
      const filtered = tasks.filter((task) => task.status === backendStatus);
      section.querySelector(".column-count").textContent = String(filtered.length);
      section.querySelector(".task-list").replaceChildren(...filtered.map(makeCard));
    }
    el("total-count").textContent = String(tasks.length);
    el("progress-count").textContent = String(
      tasks.filter((x) => x.status === "in_progress").length,
    );
    el("done-count").textContent = String(
      tasks.filter((x) => x.status === "done").length,
    );
  }

  async function refresh() {
    const currentId = selector.value;
    // 訂閱變更由 M7-A 校驗成員資格，Socket 本身無法修改資料。
    window.TaskRealtime?.setProject(currentId);
    const requestId = ++state.requestId;
    state.project = null;
    state.members = [];
    state.tasks = [];
    render();
    if (!currentId) {
      notice("請先建立或選擇專案。");
      return;
    }
    notice("正在讀取 SQLite 任務資料…");
    try {
      const base = `/api/projects/${currentId}`;
      const [projectData, memberData, taskData] = await Promise.all([
        api(base),
        api(`${base}/members`),
        api(`${base}/tasks`),
      ]);
      if (requestId !== state.requestId) return;
      if (
        !projectData?.project ||
        !Array.isArray(memberData?.members) ||
        !Array.isArray(taskData?.tasks)
      ) {
        throw new Error("伺服器回傳的任務資料格式異常。");
      }
      state.project = projectData.project;
      state.members = memberData.members;
      state.tasks = taskData.tasks;
      render();
      notice(`已載入 ${state.tasks.length} 筆正式任務。`);
    } catch (error) {
      if (requestId !== state.requestId || error.status === 401) return;
      render();
      notice(error.message, true);
    }
  }

  async function mutate(operation, successMessage) {
    if (state.busy || !state.csrf) return;
    setBusy(true);
    notice("正在儲存任務…");
    try {
      await operation();
      resetForm();
      await refresh();
      if (state.project) notice(successMessage);
    } catch (error) {
      if (error.status === 401) return;
      if (error.status === 409) {
        resetForm();
        await refresh();
        notice(
          "資料已由其他成員更新，已重新讀取最新版本，請確認後再操作。",
          true,
        );
      } else {
        await refresh();
        notice(error.message, true);
      }
    } finally {
      setBusy(false);
    }
  }

  function editTask(task) {
    if (!isManager() || !canWrite() || state.busy) return;
    state.editingId = task.id;
    state.editingVersion = task.version;
    el("task-title").value = task.title;
    el("task-description").value = task.description || "";
    el("task-status").value = task.status;
    el("task-priority").value = task.priority;
    el("task-assignee").value =
      task.assigneeId == null ? "" : String(task.assigneeId);
    el("task-due").value = task.dueDate || "";
    el("task-position").value =
      task.position == null ? "" : String(task.position);
    el("task-form-title").textContent = "編輯任務";
    el("task-submit").textContent = "儲存變更";
    el("task-cancel").hidden = false;
    el("task-create-panel").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    el("task-title").focus();
  }

  function removeTask(task) {
    if (state.busy || !isManager() || !canWrite()) return;
    if (!window.confirm(`確定刪除「${task.title}」？此動作無法復原。`)) return;
    mutate(
      () =>
        api(`${taskUrl(task.id)}?version=${task.version}`, {
          method: "DELETE",
          headers: { "X-TaskFlow-CSRF": state.csrf },
        }),
      "任務已刪除。",
    );
  }

  // 跨欄、同欄拖曳：只更新定位標記，絕不先搬動 DOM 或 state。
  function activeDrag(section) {
    return Boolean(
      state.dragging &&
      canMove() &&
      state.dragging.projectId === selector.value &&
      columnStatus[section.dataset.status],
    );
  }

  function dropIndex(section, clientY) {
    const list = section.querySelector(".task-list");
    const visible = [...list.querySelectorAll(".tf-task-card")].filter(
      (card) => Number(card.dataset.taskId) !== state.dragging.taskId,
    );
    const index = visible.findIndex(
      (card) => clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2,
    );
    return index === -1 ? visible.length : index;
  }

  function markDrop(section, index) {
    clearDropMarkers();
    const list = section.querySelector(".task-list");
    const visible = [...list.querySelectorAll(".tf-task-card")].filter(
      (card) => Number(card.dataset.taskId) !== state.dragging.taskId,
    );
    list.classList.add("tf-drop-zone");
    if (index === visible.length) {
      list.classList.add("tf-drop-at-end");
    } else {
      visible[index]?.classList.add("tf-drop-before");
    }
  }

  for (const section of document.querySelectorAll("#task-workspace .kanban-column")) {
    section.addEventListener("dragover", (event) => {
      if (!activeDrag(section)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      markDrop(section, dropIndex(section, event.clientY));
    });

    section.addEventListener("dragleave", (event) => {
      if (!section.contains(event.relatedTarget)) clearDropMarkers();
    });

    section.addEventListener("drop", (event) => {
      if (!activeDrag(section)) return;
      event.preventDefault();
      const targetStatus = columnStatus[section.dataset.status];
      const index = dropIndex(section, event.clientY);
      const task = state.tasks.find((item) => item.id === state.dragging.taskId);
      endDrag();
      if (task) moveTask(task, targetStatus, index);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.busy || !isManager() || !canWrite() || !form.reportValidity())
      return;
    const title = el("task-title").value.trim();
    if (!title) {
      notice("請輸入任務標題。", true);
      return;
    }
    const payload = {
      title,
      description: el("task-description").value.trim(),
      status: el("task-status").value,
      priority: el("task-priority").value,
    };
    const assignee = el("task-assignee").value;
    const due = el("task-due").value;
    if (assignee !== "") payload.assigneeId = Number(assignee);
    if (due !== "") payload.dueDate = due;
    const position = el("task-position").value;
    if (position !== "") payload.position = Number(position);
    const editing = state.tasks.find((task) => task.id === state.editingId);
    const editedPayload = {
      ...payload,
      assigneeId: assignee === "" ? null : Number(assignee),
      dueDate: due || null,
      version: state.editingVersion ?? editing?.version,
    };
    mutate(
      () =>
        editing
          ? api(taskUrl(editing.id), writeOptions("PATCH", editedPayload))
          : api(taskUrl(), writeOptions("POST", payload)),
      editing ? "任務已更新。" : "任務已建立。",
    );
  });

  el("task-cancel").addEventListener("click", resetForm);
  el("task-refresh").addEventListener("click", () => {
    if (!state.busy) {
      resetForm();
      refresh();
    }
  });
  selector.addEventListener("change", () => {
    if (state.busy) return;
    resetForm();
    refresh();
  });

  function setProjects(projects, preferredId = null) {
    if (!Array.isArray(projects)) return;
    const current = selector.value;
    state.projects = projects;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = projects.length ? "選擇專案" : "尚無專案";
    const options = projects.map((project) => {
      const option = document.createElement("option");
      option.value = String(project.id);
      option.textContent = project.name;
      return option;
    });
    selector.replaceChildren(placeholder, ...options);
    const wanted = preferredId == null ? current : String(preferredId);
    selector.value = projects.some((project) => String(project.id) === wanted)
      ? wanted
      : projects.length
        ? String(projects[0].id)
        : "";
    resetForm();
    refresh();
  }

  // M7-C-BEGIN: 忙碌／編輯／拖曳期間，暫不執行會重建卡片的遠端刷新。
  function canRealtimeSync() {
    return Boolean(state.csrf && !state.busy && !state.dragging && state.editingId === null);
  }

  window.TaskBoard = {
    realtimeSync(update) {
      if (!canRealtimeSync() || Number(selector.value) !== update?.projectId) return false;
      if (update.refreshProjects) {
        if (typeof window.TaskFlowDashboard?.reloadProjects !== "function") return false;
        void window.TaskFlowDashboard.reloadProjects().catch((error) => {
          notice(error.message || "專案資料同步失敗，請重新整理。", true);
        });
      } else {
        void refresh();
      }
      return true;
    },
    realtimeRevoked(projectId) {
      if (Number(selector.value) !== projectId) return;
      ++state.requestId;
      state.project = null;
      state.members = [];
      state.tasks = [];
      selector.value = "";
      resetForm();
      render();
      notice("你已失去此專案的存取權，正在重新讀取專案清單。", true);
    },
    openSession(user, csrfToken) {
      state.user = user;
      state.csrf = csrfToken;
      emptyBoard();
      window.TaskRealtime?.start();
    },
    setProjects,
    selectProject(id) {
      const wanted = String(id);
      if (!state.projects.some((project) => String(project.id) === wanted))
        return;
      selector.value = wanted;
      resetForm();
      refresh();
      el("task-board-heading").scrollIntoView({ behavior: "smooth" });
    },
  };

  emptyBoard();
})();
