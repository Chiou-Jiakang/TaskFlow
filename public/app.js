"use strict";

// M1 示範任務：非正式資料庫資料
// M5 將改為從 REST API 取得真實任務

const tasks = [
  {
    id: 1,
    title: "設計資料庫",
    description: "規劃 Users、Projects 和 Tasks 的關聯。",
    status: "todo",
    priority: "high",
    category: "Database",
    assignee: "陳",
  },
  {
    id: 2,
    title: "規劃 REST API",
    description: "設計專案與任務管理 API。",
    status: "todo",
    priority: "medium",
    category: "Backend",
    assignee: "林",
  },
  {
    id: 3,
    title: "製作登入頁面",
    description: "建立使用者登入與註冊介面。",
    status: "progress",
    priority: "high",
    category: "Frontend",
    assignee: "王",
  },
  {
    id: 4,
    title: "建立任務看板",
    description: "設計三欄式 Kanban 介面。",
    status: "progress",
    priority: "medium",
    category: "Frontend",
    assignee: "邱",
  },
  {
    id: 5,
    title: "建立 GitHub",
    description: "完成 Repository 與版本控制。",
    status: "done",
    priority: "low",
    category: "DevOps",
    assignee: "陳",
  },
  {
    id: 6,
    title: "確認專案需求",
    description: "整理開發範圍與里程碑。",
    status: "done",
    priority: "medium",
    category: "Planning",
    assignee: "林",
  },
];

const priorities = {
  high: "高優先",
  medium: "中優先",
  low: "低優先",
};

const statuses = ["todo", "progress", "done"];

// 建立單張任務卡片
function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";

  const category = document.createElement("span");
  category.className = "task-category";
  category.textContent = task.category;

  const title = document.createElement("h4");
  title.textContent = task.title;

  const description = document.createElement("p");
  description.textContent = task.description;

  const footer = document.createElement("div");
  footer.className = "task-footer";

  const priority = document.createElement("span");
  priority.className = `task-priority ${task.priority}`;
  priority.textContent = priorities[task.priority];

  const assignee = document.createElement("span");
  assignee.className = "task-assignee";
  assignee.textContent = task.assignee;
  assignee.setAttribute("aria-label", `負責人：${task.assignee}`);

  footer.append(priority, assignee);
  card.append(category, title, description, footer);

  return card;
}

// 更新 Dashboard 的任務數量
function updateStatistics() {
  const progressCount = tasks.filter(
    (task) => task.status === "progress",
  ).length;

  const doneCount = tasks.filter((task) => task.status === "done").length;

  document.getElementById("total-count").textContent = tasks.length;

  document.getElementById("progress-count").textContent = progressCount;

  document.getElementById("done-count").textContent = doneCount;
}

// 依照任務狀態產生 Kanban 看板
function renderBoard() {
  statuses.forEach((status) => {
    const column = document.querySelector(
      `.kanban-column[data-status="${status}"]`,
    );

    const list = column.querySelector(".task-list");
    const count = column.querySelector(".column-count");

    const filteredTasks = tasks.filter((task) => task.status === status);

    const cards = filteredTasks.map(createTaskCard);

    list.replaceChildren(...cards);
    count.textContent = filteredTasks.length;
  });

  updateStatistics();
}

// M1 首次渲染
renderBoard();
