# Semantic Release 自動發布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定 Semantic Release，讓每次 push 到 main 自動根據 Conventional Commits 計算版本並發布至 npm，同時建立 GitHub Release。

**Architecture:** 安裝 semantic-release plugins → 建立 `.releaserc.json` 設定 → 建立 GitHub Actions workflow → 移除舊的手動發布 skill → 在 GitHub repo 加入 NPM_TOKEN secret。

**Tech Stack:** semantic-release v25, @semantic-release/* plugins, GitHub Actions, npm

---

## 檔案異動總覽

| 動作 | 路徑 | 說明 |
|---|---|---|
| 修改 | `package.json` | 新增 4 個 semantic-release plugins 到 devDependencies |
| 修改 | `package-lock.json` | npm install 自動更新 |
| 新增 | `.releaserc.json` | semantic-release 設定檔 |
| 新增 | `.github/workflows/publish.yml` | GitHub Actions release workflow |
| 刪除 | `.claude/skills/npm-release/SKILL.md` | 舊的手動發布 skill（已被取代） |

---

## Task 1: 安裝 semantic-release plugins

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (自動)

- [ ] **Step 1: 安裝 4 個 plugins**

```bash
npm install --save-dev \
  @semantic-release/commit-analyzer \
  @semantic-release/release-notes-generator \
  @semantic-release/npm \
  @semantic-release/github
```

- [ ] **Step 2: 確認 package.json 已更新**

確認 `package.json` 的 `devDependencies` 包含：
```json
"@semantic-release/commit-analyzer": "...",
"@semantic-release/release-notes-generator": "...",
"@semantic-release/npm": "...",
"@semantic-release/github": "..."
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install semantic-release plugins"
```

---

## Task 2: 建立 `.releaserc.json`

**Files:**
- Create: `.releaserc.json`

- [ ] **Step 1: 建立設定檔**

建立 `.releaserc.json`：

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    "@semantic-release/github"
  ]
}
```

Plugin 順序說明：
1. `commit-analyzer` — 分析 commits，決定版本號
2. `release-notes-generator` — 產生 changelog 內容
3. `npm` — 發布至 npm
4. `github` — 建立 GitHub Release（用到前面產生的 changelog）

- [ ] **Step 2: 本地 dry-run 驗證設定（需要設定環境變數）**

```bash
GITHUB_TOKEN=dummy NPM_TOKEN=dummy npx semantic-release --dry-run --no-ci
```

預期輸出：看到 semantic-release 啟動、讀取 `.releaserc.json`、可能顯示 "This run was not triggered in a known CI environment" 或分析 commits 的訊息。不應看到 plugin 載入錯誤。

> 注意：`--no-ci` 允許在本地跑，token 是假的所以最後步驟會失敗，但前面的 plugin 載入和 commit 分析是有效的驗證。

- [ ] **Step 3: Commit**

```bash
git add .releaserc.json
git commit -m "chore: add semantic-release config"
```

---

## Task 3: 建立 GitHub Actions workflow

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: 建立 workflow 檔案**

建立 `.github/workflows/publish.yml`：

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write      # 建立 GitHub Release 及 git tag
  id-token: write      # 預留 npm provenance 擴充用

concurrency:
  group: release
  cancel-in-progress: false   # 不取消進行中的發布，避免 npm 發到一半

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # semantic-release 需要完整 git history 才能分析 commits

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci
      - run: npm test
      - run: npm run build

      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

重點說明：
- `fetch-depth: 0`：缺少這個，semantic-release 只看到最後一個 commit，無法計算正確版本
- `GITHUB_TOKEN`：Actions 自動提供，不需手動設定
- `NPM_TOKEN`：需要手動在 repo Settings → Secrets 加入（Task 4）

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add semantic-release GitHub Actions workflow"
```

---

## Task 4: 在 GitHub Repo 設定 NPM_TOKEN（手動步驟）

**Files:** 無（GitHub 介面操作）

- [ ] **Step 1: 取得 npm Automation Token**

前往 `https://www.npmjs.com` → 右上角頭像 → Access Tokens → Generate New Token → 選 **Automation**（不受 2FA 限制，適合 CI）。複製產生的 token。

- [ ] **Step 2: 將 token 加入 GitHub repo**

前往 GitHub repo → Settings → Secrets and variables → Actions → New repository secret：
- Name: `NPM_TOKEN`
- Secret: 貼上剛才複製的 token

按 Add secret。

---

## Task 5: 移除舊的手動發布 skill

**Files:**
- Delete: `.claude/skills/npm-release/SKILL.md`
- Delete: `.claude/skills/npm-release/` (目錄)

- [ ] **Step 1: 刪除 skill 目錄**

```bash
rm -rf .claude/skills/npm-release
```

- [ ] **Step 2: Commit**

```bash
git add -A .claude/skills/npm-release
git commit -m "chore: remove manual npm-release skill (replaced by semantic-release)"
```

---

## Task 6: 端對端驗證

**Files:** 無（驗證步驟）

> 前提：Task 4 的 NPM_TOKEN 已設定完成。

- [ ] **Step 1: Push 所有變更到 main**

```bash
git push
```

- [ ] **Step 2: 確認 Actions workflow 觸發**

前往 GitHub repo → Actions → 確認 "Release" workflow 有在跑。

- [ ] **Step 3: 確認本次 push 不會觸發發布**

本次 commit message 使用 `chore:` 格式，semantic-release 應分析後顯示 "There are no relevant changes, so no new version is released." 並成功結束（非失敗）。

- [ ] **Step 4: 測試實際發布（選擇性）**

若要確認完整發布流程，可推一個 `fix:` commit：

```bash
# 做一個小修改（例如 README）
git commit -m "fix: trigger test release"
git push
```

預期：Actions 跑完後，npm 上出現新的 patch 版本，GitHub Releases 頁面出現新 release。

---

## 附錄：Conventional Commits 速查

| Commit 類型 | 觸發版本 | 範例 |
|---|---|---|
| `fix:` | patch | `fix: correct bar renderer` |
| `feat:` | minor | `feat: add circular mode` |
| `BREAKING CHANGE:` (commit footer) | major | body 加 `BREAKING CHANGE: removed X` |
| `docs:` `chore:` `refactor:` `test:` `style:` | **不發布** | 隨意寫 |
