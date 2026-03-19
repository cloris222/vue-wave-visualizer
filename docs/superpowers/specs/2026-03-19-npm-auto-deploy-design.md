# npm 自動發布設計 — Semantic Release

**日期：** 2026-03-19
**狀態：** 已核准

---

## 背景

`vue-wave-visualizer` 是一個 Vue 3 音訊波形視覺化套件，發布至 npm。先前的 `publish.yml` workflow 經歷多次修改（OIDC、token 切換、provenance 設定），已雜亂難維護，予以刪除，重頭設計。

---

## 目標

- push 到 `main` 分支自動觸發版本分析
- 根據 Conventional Commits 格式自動計算版本號
- 自動發布至 npm
- 自動建立 GitHub Release（含 changelog）
- 非發布性 commit（`docs:`、`chore:` 等）不觸發任何發布

---

## 架構

```
push to main
      ↓
GitHub Actions (publish.yml)
      ├── actions/checkout (fetch-depth: 0)
      ├── npm ci
      ├── npm test
      ├── npm run build
      └── npx semantic-release
            ├── @semantic-release/commit-analyzer   → 計算版本
            ├── @semantic-release/release-notes-generator → 產生 changelog
            ├── @semantic-release/npm               → 發布至 npm
            └── @semantic-release/github            → 建立 GitHub Release
```

---

## 版本規則（Conventional Commits）

| Commit 格式 | 觸發版本 |
|---|---|
| `fix: ...` | patch |
| `feat: ...` | minor |
| `BREAKING CHANGE:` (footer) | major |
| `docs:`, `chore:`, `refactor:`, `test:` | 不發布 |

---

## 檔案清單

### 新增

**`.github/workflows/publish.yml`**

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
          fetch-depth: 0

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

**`.releaserc.json`**

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

### 修改

**`package.json`** — 新增 semantic-release plugins 至 devDependencies：
- `@semantic-release/commit-analyzer`
- `@semantic-release/release-notes-generator`
- `@semantic-release/npm`
- `@semantic-release/github`

### 刪除

- `.claude/skills/npm-release/SKILL.md` — 被 Semantic Release 取代

---

## GitHub Secrets 需求

| Secret | 說明 |
|---|---|
| `NPM_TOKEN` | npm Automation Token，需手動在 repo Settings → Secrets 設定 |
| `GITHUB_TOKEN` | GitHub Actions 自動提供，無需手動設定 |

---

## 注意事項

- **`package.json` 的 `version` 欄位**：semantic-release 透過 `@semantic-release/npm` 在發布時更新此欄位，但不會 commit 回 git（未裝 `@semantic-release/git`）。開發者不需手動修改版本號。
- **`dist/` 目錄**：`npm run build` 在 `npx semantic-release` 之前執行，確保發布時 `dist/` 已在磁碟上。`dist/` 不進 git，但會被 `npm publish` 打包（由 `package.json` 的 `files: ["dist"]` 控制）。
- **無版本 commit 回推**：由於未裝 `@semantic-release/git`，semantic-release 只會建立 git tag 和 GitHub Release，不會 push 任何 commit 回 `main`，因此不會觸發第二次 workflow。
- **`concurrency` 設定**：`cancel-in-progress: false` 確保即使多個 push 接連進來，不會中途取消正在進行的發布流程。

---

## 不在範圍內

- `CHANGELOG.md` 自動更新（需額外 `@semantic-release/git`，複雜度大於價值）
- branch protection rules（solo 開發者無需）
- `workflow_dispatch` 手動觸發（流程單一化）
