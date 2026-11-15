# TaskFlow｜開發歷程紀錄

本文件詳細記錄專案各階段的實作內容、技術決策、
問題處理、驗證結果及後續規劃。

## 2026-11-15｜M0：專案初始化

### 一、階段目標

建立可獨立管理、具備版本控制及完整文件架構的
TaskFlow 專案開發環境。

### 二、已完成工作

1. 建立 C:\Projects\TaskFlow 專案目錄。
2. 使用 git init -b main 初始化版本控制。
3. 設定 GitHub origin。
4. 建立 docs、public、server 資料夾。
5. 規劃七份核心文件。
6. 確立分階段開發與同步維護原則。

### 三、遇到的問題

初期建立資料夾時，曾出現兩個不同位置：

- C:\Projects\TaskFlow
- C:\Taskflow

其中正式 Git Repository 位於 C:\Projects\TaskFlow，
而 docs、public、server 最初建立在 C:\Taskflow。

### 四、問題處理

使用 PowerShell 的 Copy-Item 指令，
將三個資料夾複製至正式專案位置。

執行 Get-ChildItem 後，確認正式專案目錄包含：

- .git
- docs
- public
- server

VS Code 檔案總管亦顯示三個資料夾。

### 五、技術決策

- 沿用 Node.js、Express 與 SQLite。
- 第一版不強制導入 React。
- 使用 REST API 處理資料操作。
- 規劃使用 Socket.IO 處理即時事件。
- 採取後端驗證權限的設計。
- 以逐階段測試及 Git Commit 控制變更。

### 六、階段驗證

已由 PowerShell 終端機截圖確認：

- 正式專案目錄存在。
- Git Repository 已初始化。
- origin 已設定。
- 三個基礎資料夾已建立。

尚未完成網站功能測試。

### 七、後續工作

- 補齊所有初始文件。
- 完成首次 Git Commit 與 Push。
- 進入 M1：網站骨架及基本介面開發。

---

## 2026-11-15｜M0 結案紀錄

### 一、文件初始化

完成七份核心專案文件及兩個 .gitkeep 檔案。

### 二、首次 Git Commit

- Commit：8c2a2e6
- Branch：main
- 新增追蹤檔案：9 個
- 新增內容：390 行

Commit Message：

chore: initialize TaskFlow project structure and documentation

### 三、GitHub Push

成功執行：

git push -u origin main

GitHub Repository：

https://github.com/Chiou-Jiakang/TaskFlow

遠端分支 origin/main 已建立。

### 四、版本一致性

執行以下指令完成檢查：

- git status -sb
- git log -1 --oneline
- git remote -v

檢查結果：

- 本機分支為 main。
- main 已追蹤 origin/main。
- 本機與遠端追蹤分支指向相同 Commit。
- 工作目錄沒有待提交變更。

### 五、M0 結案

M0 專案初始化工作已完成。

專案具備獨立目錄、版本控制、
GitHub 遠端儲存庫及基本文件管理架構。

接下來進入 M1 網站骨架與基本介面開發。

註：本結案紀錄更新完成後，
仍須建立文件結案 Commit 並再次 Push。
