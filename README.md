# 一日一页 · 中考背诵

面向初中生的中考背诵调度工具。实词每天安排新学和到期复习，诗词与文言文按篇目进度解锁，再按句段进入复习队列。

## 本地运行

```bash
pnpm install
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm --dir apps/web dev
```

没有配置 Supabase 环境变量时，应用仍然可以构建并展示登录界面。正式使用需要设置 `.env.local` 中的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。

## 内容包

内容包格式见 `docs/content-pack-format.md`。原始 PDF 作为本地导入来源，标准化结果进入 `content/packs/`。导入命令见 `docs/deployment.md`。

## 发布

GitHub Pages 工作流位于 `.github/workflows/deploy-pages.yml`。Supabase 项目 URL 和公开 anon key 使用 GitHub Actions Variables 注入，服务端密钥不进入前端构建或仓库。
