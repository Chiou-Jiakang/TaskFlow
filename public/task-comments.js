"use strict";

// M8-C1：任務留言前端。僅讀寫 M8-B REST API，不接觸 Cookie 或 localStorage。
// M8-C3 才會加入留言事件的 Socket.IO 即時同步；目前手動重新整理可讀取最新內容。
(function initTaskComments(root) {
  const PAGE_SIZE = 30;

  function positiveId(value) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || String(number) !== String(value)) {
      throw new TypeError("ID 必須是正整數。");
    }
    return number;
  }

  function commentsUrl(projectId, taskId, commentId = null) {
    const base = `/api/projects/${positiveId(projectId)}/tasks/${positiveId(taskId)}/comments`;
    return commentId === null ? base : `${base}/${positiveId(commentId)}`;
  }

  function canEditComment(comment, userId, writable) {
    return Boolean(writable && comment?.authorId === userId);
  }

  function canDeleteComment(comment, userId, role, writable) {
    return Boolean(writable && (comment?.authorId === userId || ["owner", "admin"].includes(role)));
  }

  function validateBody(body) {
    if (typeof body !== "string" || !body.trim() || body.trim().length > 2000) {
      throw new TypeError("留言內容必須介於 1～2000 字元。");
    }
    return body.trim();
  }

  function createCommentsApi(fetchFn, onUnauthorized = () => {}) {
    if (typeof fetchFn !== "function") throw new TypeError("缺少 fetch 函式。");
    async function request(url, options = {}) {
      const response = await fetchFn(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
      });
      const json = response.status === 204 ? null : await response.json().catch(() => null);
      if (response.status === 401) onUnauthorized();
      if (!response.ok) {
        const error = new Error(json?.message || `操作失敗（HTTP ${response.status}）。`);
        error.status = response.status;
        error.code = json?.error;
        throw error;
      }
      return json;
    }
    function write(method, csrf, data) {
      if (typeof csrf !== "string" || !/^[a-f0-9]{64}$/.test(csrf)) {
        throw new TypeError("登入憑證失效，請重新登入。");
      }
      return {
        method,
        headers: {
          "X-TaskFlow-CSRF": csrf,
          ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      };
    }
    return {
      list(projectId, taskId, beforeId = null) {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (beforeId !== null) params.set("beforeId", String(positiveId(beforeId)));
        return request(`${commentsUrl(projectId, taskId)}?${params}`);
      },
      create(projectId, taskId, text, csrf) {
        return request(commentsUrl(projectId, taskId), write("POST", csrf, { body: validateBody(text) }));
      },
      update(projectId, taskId, commentId, version, text, csrf) {
        return request(commentsUrl(projectId, taskId, commentId),
          write("PATCH", csrf, { version: positiveId(version), body: validateBody(text) }));
      },
      remove(projectId, taskId, commentId, version, csrf) {
        return request(`${commentsUrl(projectId, taskId, commentId)}?version=${positiveId(version)}`,
          write("DELETE", csrf));
      },
    };
  }

  const exported = { commentsUrl, canEditComment, canDeleteComment, validateBody, createCommentsApi };
  if (typeof module === "object" && module.exports) module.exports = exported;
  if (!root?.document) return;

  const doc = root.document;
  const api = createCommentsApi(root.fetch.bind(root), () => {
    close();
    root.TaskRealtime?.stop();
    root.location.replace("/auth.html");
  });
  let current = null;
  let sequence = 0;
  let busy = false;
  let loading = false;
  let comments = [];
  let editing = null;
  let hasMore = false;
  let focusOrigin = null;
  // M8-C3-BEGIN: 未完成讀取／寫入期間的 Socket 更新必須保留，不能直接丟棄。
  let remoteDirty = false;
  let remoteTimer = null;
  function flushRemote() {
    if (!remoteDirty || remoteTimer !== null || !current || busy || loading) return;
    remoteTimer = root.setTimeout(() => {
      remoteTimer = null;
      if (!remoteDirty || !current || busy || loading) return;
      remoteDirty = false;
      void reload({ preserveDraft: true });
    }, 90);
  }


  function element(tag, className = "", text = "") {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }
  function button(label, onClick, className = "") {
    const node = element("button", className, label);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  const overlay = element("section", "tf-comments-overlay");
  overlay.id = "task-comments-overlay";
  overlay.hidden = true;
  const dialog = element("div", "tf-comments-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "task-comments-title");
  const heading = element("div", "tf-comments-heading");
  const title = element("h2", "", "任務留言");
  title.id = "task-comments-title";
  const closeButton = button("關閉", () => close(), "tf-comments-secondary");
  closeButton.id = "task-comments-close";
  heading.append(title, closeButton);

  const info = element("p", "tf-comments-notice", "");
  info.id = "task-comments-message";
  info.setAttribute("role", "status");
  info.setAttribute("aria-live", "polite");
  const list = element("ul", "tf-comments-list");
  list.id = "task-comments-list";
  list.setAttribute("aria-label", "任務留言列表");
  const tools = element("div", "tf-comments-toolbar");
  const refreshButton = button("重新整理", () => { void reload(); }, "tf-comments-secondary");
  refreshButton.id = "task-comments-refresh";
  const moreButton = button("載入更早留言", () => { void loadMore(); }, "tf-comments-secondary");
  moreButton.id = "task-comments-more";
  moreButton.hidden = true;
  tools.append(refreshButton, moreButton);

  const form = element("form", "tf-comments-form");
  form.id = "task-comments-form";
  const label = element("label", "", "新增留言");
  label.id = "task-comments-form-label";
  label.htmlFor = "task-comments-input";
  const input = element("textarea");
  input.id = "task-comments-input";
  input.maxLength = 2000;
  input.required = true;
  input.rows = 3;
  input.placeholder = "輸入留言（1～2000 字元）";
  const controls = element("div", "tf-comments-toolbar");
  const submit = element("button", "tf-comments-primary", "送出留言");
  submit.id = "task-comments-submit";
  submit.type = "submit";
  const cancelEdit = button("取消編輯", () => resetEditor(), "tf-comments-secondary");
  cancelEdit.id = "task-comments-cancel-edit";
  cancelEdit.hidden = true;
  controls.append(submit, cancelEdit);
  form.append(label, input, controls);
  dialog.append(heading, info, list, tools, form);
  overlay.append(dialog);
  doc.body.append(overlay);

  function notify(text, isError = false) {
    info.textContent = text;
    info.dataset.error = String(isError);
  }
  function formatDate(value) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString("zh-TW") : String(value || "");
  }
  function resetEditor(keepDraft = false) {
    editing = null;
    if (!keepDraft) input.value = "";
    label.textContent = "新增留言";
    submit.textContent = "送出留言";
    cancelEdit.hidden = true;
  }
  function updateControls() {
    const writable = Boolean(current?.writable);
    form.hidden = !writable;
    submit.disabled = busy || loading;
    input.disabled = busy || loading;
    refreshButton.disabled = busy || loading;
    moreButton.disabled = busy || loading;
  }
  function render() {
    list.replaceChildren();
    if (!comments.length) list.append(element("li", "tf-comments-empty", "目前尚無留言。"));
    for (const comment of comments) {
      const row = element("li", "tf-comments-item");
      row.dataset.commentId = String(comment.id);
      const head = element("div", "tf-comments-item-head");
      head.append(
        element("strong", "", comment.authorName || "成員"),
        element("time", "", formatDate(comment.updatedAt || comment.createdAt)),
      );
      const body = element("p", "tf-comments-body", comment.body);
      row.append(head, body);
      if (canEditComment(comment, current?.userId, current?.writable) ||
          canDeleteComment(comment, current?.userId, current?.role, current?.writable)) {
        const actions = element("div", "tf-comments-item-actions");
        if (canEditComment(comment, current.userId, current.writable)) {
          actions.append(button("編輯", () => {
            editing = { id: comment.id, version: comment.version };
            input.value = comment.body;
            label.textContent = "編輯留言";
            submit.textContent = "儲存編輯";
            cancelEdit.hidden = false;
            input.focus();
          }, "tf-comments-secondary"));
        }
        if (canDeleteComment(comment, current.userId, current.role, current.writable)) {
          actions.append(button("刪除", () => { void remove(comment); }, "tf-comments-danger"));
        }
        row.append(actions);
      }
      list.append(row);
    }
    moreButton.hidden = !hasMore;
    updateControls();
  }
  function validContext(config) {
    if (!config || typeof config !== "object") throw new TypeError("缺少任務資訊。");
    return {
      projectId: positiveId(config.projectId),
      taskId: positiveId(config.taskId),
      title: String(config.taskTitle || ""),
      userId: positiveId(config.userId),
      role: String(config.role || ""),
      writable: Boolean(config.writable),
      csrf: config.csrfToken,
    };
  }
  async function fetchPage(beforeId = null, reset = false) {
    if (!current || loading || busy) return;
    const started = sequence;
    const context = current;
    loading = true;
    updateControls();
    notify("正在讀取留言…");
    try {
      const data = await api.list(context.projectId, context.taskId, beforeId);
      if (started !== sequence) return;
      if (!Array.isArray(data?.comments)) throw new Error("留言列表資料格式異常。");
      const seen = new Set(reset ? [] : comments.map((c) => c.id));
      const unique = data.comments.filter((c) => !seen.has(c.id) && seen.add(c.id));
      comments = reset ? unique : comments.concat(unique);
      hasMore = data.comments.length === PAGE_SIZE;
      render();
      notify(`已載入 ${comments.length} 筆留言。`);
    } catch (error) {
      if (started !== sequence || error.status === 401) return;
      if ([403, 404].includes(error.status)) {
        close();
        return;
      }
      notify(error.message, true);
    } finally {
      if (started === sequence) { loading = false; render(); flushRemote(); }
    }
  }
  async function reload({ preserveDraft = false } = {}) {
    if (!current || loading || busy) return;
    if (!preserveDraft) resetEditor();
    await fetchPage(null, true);
  }
  async function loadMore() {
    if (!hasMore || !comments.length) return;
    await fetchPage(comments[comments.length - 1].id, false);
  }
  async function execute(operation, success) {
    if (!current || busy || loading || !current.writable) return;
    const started = sequence;
    const context = current;
    busy = true;
    updateControls();
    notify("正在儲存留言…");
    try {
      await operation(context);
      if (started !== sequence) return;
      busy = false;
      resetEditor();
      await reload();
      if (started === sequence) notify(success);
    } catch (error) {
      if (started !== sequence || error.status === 401) return;
      if (error.status === 409) {
        busy = false;
        // 保留使用者草稿，但不沿用過期版本繼續提交。
        resetEditor(true);
        await reload({ preserveDraft: true });
        if (started === sequence) notify("留言版本已變更，已重新讀取最新資料。草稿已保留，請確認後再操作。", true);
      } else if ([403, 404].includes(error.status)) {
        busy = false;
        notify(error.message, true);
        if (error.status === 404) await reload();
      } else notify(error.message, true);
    } finally {
      if (started === sequence) { busy = false; render(); flushRemote(); }
    }
  }
  async function remove(comment) {
    if (!current || !canDeleteComment(comment, current.userId, current.role, current.writable)) return;
    if (!root.confirm("確定刪除這則留言？")) return;
    await execute((ctx) => api.remove(ctx.projectId, ctx.taskId, comment.id, comment.version, ctx.csrf), "留言已刪除。");
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!current?.writable || busy || loading) return;
    let body;
    try { body = validateBody(input.value); }
    catch (error) { notify(error.message, true); return; }
    if (editing) {
      const saved = { ...editing };
      void execute((ctx) => api.update(ctx.projectId, ctx.taskId, saved.id, saved.version, body, ctx.csrf), "留言已更新。");
    } else {
      void execute((ctx) => api.create(ctx.projectId, ctx.taskId, body, ctx.csrf), "留言已送出。");
    }
  });
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  doc.addEventListener("keydown", (event) => {
    if (overlay.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "Tab") {
      const focusable = Array.from(dialog.querySelectorAll("button:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden])"))
        .filter((node) => !node.closest("[hidden]"));
      if (!focusable.length) return;
      const index = focusable.indexOf(doc.activeElement);
      if (event.shiftKey && (index <= 0)) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
    }
  });
  function close() {
    remoteDirty = false;
    if (remoteTimer !== null) root.clearTimeout(remoteTimer);
    remoteTimer = null;
    sequence++;
    current = null;
    comments = [];
    busy = false;
    loading = false;
    editing = null;
    overlay.hidden = true;
    resetEditor();
    if (focusOrigin?.isConnected) focusOrigin.focus();
    focusOrigin = null;
  }
  function open(config) {
    const parsed = validContext(config);
    close();
    current = parsed;
    focusOrigin = doc.activeElement;
    title.textContent = `任務留言｜${parsed.title}`;
    overlay.hidden = false;
    render();
    notify(parsed.writable ? "正在取得最新留言…" : "此專案僅供閱讀留言。", false);
    closeButton.focus();
    void fetchPage(null, true);
  }
  function projectChanged(projectId) {
    if (current && current.projectId !== Number(projectId)) close();
  }
  function revoke(projectId) {
    if (current && current.projectId === Number(projectId)) close();
  }
  // M8-C3-BEGIN: 僅刷新目前開啟且屬於同一專案的留言面板。
  function realtimeChanged(projectId) {
    if (!current || current.projectId !== Number(projectId) || overlay.hidden) return;
    remoteDirty = true;
    flushRemote();
  }
  root.TaskComments = { open, close, projectChanged, revoke, realtimeChanged };
})(typeof window === "undefined" ? null : window);
