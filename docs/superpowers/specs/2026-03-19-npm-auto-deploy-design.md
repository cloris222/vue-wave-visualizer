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
  contents: write
  id-token: write

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

## 不在範圍內

- `CHANGELOG.md` 自動更新（需額外 `@semantic-release/git`，複雜度大於價值）
- branch protection rules（solo 開發者無需）
- `workflow_dispatch` 手動觸發（流程單一化）
