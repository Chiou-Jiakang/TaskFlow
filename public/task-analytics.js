"use strict";

// M9-A：只使用目前專案已授權取得的 REST 任務資料，統計不寫入 DB。
(function initTaskAnalytics(root) {
  function localToday(now = new Date()) {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new TypeError("now 必須是有效日期。");
    }
    const pad = (number) => String(number).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function summarize(tasks, members, today = localToday()) {
    if (!Array.isArray(tasks) || !Array.isArray(members) ||
        typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      throw new TypeError("統計資料格式不正確。");
    }

    const open = tasks.filter((task) => task && task.status !== "done");
    const done = tasks.filter((task) => task && task.status === "done").length;
    const activeDue = (task) => typeof task.dueDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate);
    const workload = new Map();

    for (const member of members) {
      if (!member || !Number.isSafeInteger(member.userId) || member.userId <= 0) continue;
      if (workload.has(member.userId)) continue;
      workload.set(member.userId, {
        userId: member.userId,
        name: String(member.displayName || member.email || `使用者 ${member.userId}`),
        count: 0,
      });
    }

    let unassigned = 0;
    for (const task of open) {
      const member = workload.get(task.assigneeId);
      if (member) member.count += 1;
      else unassigned += 1;
    }

    const count = tasks.length;
    return {
      total: count,
      done,
      completionPercent: count ? Math.round((done / count) * 100) : 0,
      overdue: open.filter((task) => activeDue(task) && task.dueDate < today).length,
      dueToday: open.filter((task) => activeDue(task) && task.dueDate === today).length,
      highOpen: open.filter((task) => task.priority === "high").length,
      unassigned,
      workload: [...workload.values()].filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count || a.userId - b.userId),
    };
  }

  function render(tasks, members, project, documentRef = root.document) {
    if (!documentRef) return;
    const scope = documentRef.getElementById("m9-analytics-scope");
    if (!scope) return; // 尚未安裝 M9-A HTML 時安全略過。
    const data = project ? summarize(tasks, members) : summarize([], []);
    const write = (id, value) => {
      const element = documentRef.getElementById(id);
      if (element) element.textContent = String(value);
    };
    write("m9-rate", `${data.completionPercent}%`);
    write("m9-rate-detail", `已完成 ${data.done} / 共 ${data.total} 筆`);
    write("m9-overdue", data.overdue);
    write("m9-due-today", `今日到期 ${data.dueToday} 筆`);
    write("m9-high", data.highOpen);
    write("m9-unassigned", data.unassigned);
    scope.textContent = project
      ? `目前專案：${project.name || "未命名專案"}；僅統計此專案的 REST 任務。`
      : "請先選擇專案，統計不會顯示其他專案資料。";

    const list = documentRef.getElementById("m9-workload-list");
    if (!list) return;
    const rows = data.workload.slice(0, 8).map((person) => {
      const item = documentRef.createElement("li");
      const name = documentRef.createElement("span");
      const count = documentRef.createElement("strong");
      name.textContent = person.name;
      count.textContent = `${person.count} 筆未完成`;
      item.append(name, count);
      return item;
    });
    if (rows.length === 0) {
      const empty = documentRef.createElement("li");
      empty.textContent = project
        ? "目前沒有已指派的未完成任務。"
        : "尚未選擇專案。";
      rows.push(empty);
    }
    list.replaceChildren(...rows);
    const remaining = documentRef.getElementById("m9-workload-remaining");
    if (remaining) remaining.textContent = data.workload.length > 8
      ? `另有 ${data.workload.length - 8} 位成員有待辦任務。` : "";
  }

  const api = Object.freeze({ localToday, summarize, render });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.TaskAnalytics = api;
})(typeof window !== "undefined" ? window : globalThis);
