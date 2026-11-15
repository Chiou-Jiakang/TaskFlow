
-- TaskFlow M2-A
-- SQLite 資料庫基礎結構
-- 後續 M3、M4 會延伸使用

-- ========================================
-- 1. 使用者資料表
-- ========================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,

  email TEXT NOT NULL COLLATE NOCASE UNIQUE,

  password_hash TEXT NOT NULL,

  display_name TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT (
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
);

-- ========================================
-- 2. 專案資料表
-- ========================================

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,

  name TEXT NOT NULL
    CHECK (length(trim(name)) BETWEEN 1 AND 100),

  description TEXT NOT NULL DEFAULT '',

  owner_id INTEGER NOT NULL,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),

  version INTEGER NOT NULL DEFAULT 1
    CHECK (version >= 1),

  created_at TEXT NOT NULL DEFAULT (
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),

  updated_at TEXT NOT NULL DEFAULT (
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),

  FOREIGN KEY (owner_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

-- ========================================
-- 3. 專案成員關聯表
-- ========================================

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL,

  user_id INTEGER NOT NULL,

  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin', 'member')),

  joined_at TEXT NOT NULL DEFAULT (
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),

  PRIMARY KEY (project_id, user_id),

  FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- ========================================
-- 4. 常用查詢索引
-- ========================================

CREATE INDEX IF NOT EXISTS idx_projects_owner_id
ON projects(owner_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
ON project_members(user_id);
