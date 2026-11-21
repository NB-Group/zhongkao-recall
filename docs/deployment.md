# 部署说明

## 导入内容

先将三份 PDF 提取为 UTF-8 文本，再运行：

```bash
python3 scripts/import_content.py \
  --wenyan-text work/pdf_text/wenyan.txt \
  --poetry-text work/pdf_text/poetry.txt \
  --words-text work/pdf_text/words.txt \
  --output content/packs/zhongkao-2024
```

导入器会移除页码、公众号推广文字、页眉和咨询信息，并验证 41 篇文言文、82 首诗词、150 个实词词条和 6 个虚词词条。

## Supabase

在项目中运行 `supabase db push` 应用 `supabase/migrations/`。首次使用前创建邮箱密码登录配置，并在客户端使用公开 anon key。所有用户表启用行级安全策略。

## GitHub Pages

开启仓库的 Pages 部署来源，让 `Deploy web app to GitHub Pages` 工作流使用 GitHub Actions。设置仓库变量 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。工作流会根据仓库名生成静态资源路径。
