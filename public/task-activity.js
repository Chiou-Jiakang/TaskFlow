"use strict";

// M8-C2：專案活動時間軸。只從受 Session/RBAC 保護的 REST API 讀取資料。
// M8-A 目前僅產生 comment_created / comment_updated / comment_deleted 三種活動。
// 即時自動刷新留待 M8-C3；此階段提供手動重新整理及分頁。
(function initTaskActivity(root) {
  const PAGE_SIZE = 20;
  const ACTION_LABELS = Object.freeze({
    comment_created: "新增了任務留言",
    comment_updated: "編輯了任務留言",
    comment_deleted: "刪除了任務留言",
  });

  function positiveId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1 || String(id) !== String(value)) {
      throw new TypeError("ID 必須是正整數。");
    }
    return id;
  }
  function activityUrl(projectId, beforeId = null, limit = PAGE_SIZE) {
    const id = positiveId(projectId);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new TypeError("分頁筆數必須介於 1 至 100。");
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (beforeId !== null) params.set("beforeId", String(positiveId(beforeId)));
    return `/api/projects/${id}/activity?${params.toString()}`;
  }
  function activityLabel(action) {
    return ACTION_LABELS[action] ?? "進行了一項專案操作";
  }
  function normalizeActivities(data) {
    if (!Array.isArray(data?.activities)) throw new TypeError("活動紀錄資料格式異常。");
    for (const item of data.activities) {
      if (!item || typeof item !== "object" || !Number.isSafeInteger(item.id) || item.id < 1 ||
          typeof item.action !== "string") {
        throw new TypeError("活動紀錄資料格式異常。");
      }
    }
    return data.activities;
  }
  async function fetchActivities(fetchFn, projectId, beforeId = null, onUnauthorized = () => {}) {
    const response = await fetchFn(activityUrl(projectId, beforeId), {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 401) onUnauthorized();
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.message || `活動紀錄讀取失敗（HTTP ${response.status}）。`);
      error.status = response.status;
      throw error;
    }
    return normalizeActivities(body);
  }

  const exports = { PAGE_SIZE, positiveId, activityUrl, activityLabel, normalizeActivities, fetchActivities };
  if (typeof module === "object" && module.exports) module.exports = exports;
  if (!root?.document) return;

  const doc = root.document;
  const select = doc.getElementById("task-project-select");
  const taskRefresh = doc.getElementById("task-refresh");
  if (!select || !taskRefresh) return;

  function node(tag, className = "", content = "") {
    const element = doc.createElement(tag);
    element.className = className;
    element.textContent = content;
    return element;
  }
  function button(content, handler, className = "") {
    const element = node("button", className, content);
    element.type = "button";
    element.addEventListener("click", handler);
    return element;
  }
  const opener = button("活動紀錄", () => open(), "tf-activity-trigger");
  opener.id = "task-activity-open";
  opener.setAttribute("aria-haspopup", "dialog");
  taskRefresh.parentElement.insertBefore(opener, taskRefresh);

  const overlay = node("section", "tf-activity-overlay");
  overlay.id = "task-activity-overlay";
  overlay.hidden = true;
  const dialog = node("div", "tf-activity-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "task-activity-title");
  const head = node("div", "tf-activity-heading");
  const heading = node("h2", "", "專案活動紀錄");
  heading.id = "task-activity-title";
  const closeButton = button("關閉", () => close(), "tf-activity-secondary");
  closeButton.id = "task-activity-close";
  head.append(heading, closeButton);
  const help = node("p", "tf-activity-help", "目前顯示任務留言的新增、修改與刪除紀錄；不包含留言正文。");
  const status = node("p", "tf-activity-status");
  status.id = "task-activity-message";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const list = node("ol", "tf-activity-list");
  list.id = "task-activity-list";
  list.setAttribute("aria-label", "專案活動時間軸");
  const actions = node("div", "tf-activity-actions");
  const refreshButton = button("重新整理", () => { void reload(); }, "tf-activity-secondary");
  refreshButton.id = "task-activity-refresh";
  const moreButton = button("載入更早紀錄", () => { void more(); }, "tf-activity-secondary");
  moreButton.id = "task-activity-more";
  moreButton.hidden = true;
  actions.append(refreshButton, moreButton);
  dialog.append(head, help, status, list, actions);
  overlay.append(dialog);
  doc.body.append(overlay);

  let currentProject = null;
  let sequence = 0;
  let activities = [];
  let hasMore = false;
  let loading = false;
  let previousFocus = null;
  // M8-C3-BEGIN: 正在分頁讀取時收到事件先記錄，讀取完成後再補抓。
  let remoteDirty = false;
  let remoteTimer = null;
  function flushRemote() {
    if (!remoteDirty || remoteTimer !== null || !currentProject || loading) return;
    remoteTimer = root.setTimeout(() => {
      remoteTimer = null;
      if (!remoteDirty || !currentProject || loading) return;
      remoteDirty = false;
      void reload();
    }, 90);
  }


  function announce(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }
  function formatTime(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toLocaleString("zh-TW") : "時間未提供";
  }
  function render() {
    list.replaceChildren();
    if (!activities.length) list.append(node("li", "tf-activity-empty", "目前沒有活動紀錄。"));
    for (const item of activities) {
      const row = node("li", "tf-activity-entry");
      row.dataset.activityId = String(item.id);
      const label = node("p", "tf-activity-line");
      const actor = node("strong", "", item.actorName || "已離開的成員");
      const action = node("span", "", ` ${activityLabel(item.action)}`);
      label.append(actor, action);
      const metadata = node("div", "tf-activity-meta");
      const when = node("time", "", formatTime(item.createdAt));
      if (item.createdAt) when.dateTime = item.createdAt;
      metadata.append(when);
      if (Number.isSafeInteger(item.taskId) && item.taskId > 0) {
        metadata.append(node("span", "", `任務 #${item.taskId}`));
      }
      if (Number.isSafeInteger(item.commentId) && item.commentId > 0) {
        metadata.append(node("span", "", `留言 #${item.commentId}`));
      }
      row.append(label, metadata);
      list.append(row);
    }
    moreButton.hidden = !hasMore;
    refreshButton.disabled = loading;
    moreButton.disabled = loading;
  }
  async function fetchPage(beforeId = null, reset = false) {
    if (!currentProject || loading) return;
    const currentSequence = sequence;
    const requestedProject = currentProject;
    loading = true;
    announce("正在載入活動紀錄…");
    render();
    try {
      const rows = await fetchActivities(root.fetch.bind(root), requestedProject, beforeId, () => {
        close();
        root.TaskRealtime?.stop();
        root.location.replace("/auth.html");
      });
      if (sequence !== currentSequence || currentProject !== requestedProject) return;
      const ids = new Set(reset ? [] : activities.map((item) => item.id));
      const unique = rows.filter((item) => !ids.has(item.id) && ids.add(item.id));
      activities = reset ? unique : activities.concat(unique);
      hasMore = rows.length === PAGE_SIZE;
      announce(`已載入 ${activities.length} 筆活動紀錄。`);
    } catch (error) {
      if (sequence !== currentSequence || error.status === 401) return;
      if (error.status === 403 || error.status === 404) {
        close();
        return;
      }
      announce(error.message, true);
    } finally {
      if (sequence === currentSequence) {
        loading = false;
        render();
        flushRemote();
      }
    }
  }
  async function reload() {
    if (!currentProject || loading) return;
    await fetchPage(null, true);
  }
  async function more() {
    if (!currentProject || !hasMore || loading || !activities.length) return;
    await fetchPage(activities[activities.length - 1].id, false);
  }
  function close() {
    remoteDirty = false;
    if (remoteTimer !== null) root.clearTimeout(remoteTimer);
    remoteTimer = null;
    sequence++;
    currentProject = null;
    activities = [];
    hasMore = false;
    loading = false;
    overlay.hidden = true;
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  }
  function open() {
    let projectId;
    try { projectId = positiveId(select.value); }
    catch { announce("請先選擇專案。", true); return; }
    close();
    currentProject = projectId;
    previousFocus = doc.activeElement;
    heading.textContent = `專案活動紀錄｜${doc.getElementById("task-project-name")?.textContent || `#${projectId}`}`;
    overlay.hidden = false;
    render();
    closeButton.focus();
    void reload();
  }
  function projectChanged(projectId) {
    if (currentProject && currentProject !== Number(projectId)) close();
  }
  function revoke(projectId) {
    if (currentProject === Number(projectId)) close();
  }
  select.addEventListener("change", () => projectChanged(select.value));
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  doc.addEventListener("keydown", (event) => {
    if (overlay.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "Tab") {
      const available = [closeButton, refreshButton, moreButton].filter((item) => !item.hidden && !item.disabled);
      if (!available.length) return;
      const index = available.indexOf(doc.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault(); available[available.length - 1].focus();
      } else if (!event.shiftKey && index === available.length - 1) {
        event.preventDefault(); available[0].focus();
      }
    }
  });
  // M8-C3-BEGIN: 只刷新目前開啟的相同專案時間軸。
  function realtimeChanged(projectId) {
    if (!currentProject || currentProject !== Number(projectId) || overlay.hidden) return;
    remoteDirty = true;
    flushRemote();
  }
  root.TaskActivity = { open, close, projectChanged, revoke, realtimeChanged };
})(typeof window === "undefined" ? null : window);
