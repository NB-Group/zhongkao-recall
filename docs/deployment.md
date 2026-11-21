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

在项目中运行 `supabase db push` 应用 `supabase/migrations/`，并在客户端使用公开 anon key。所有用户表启用行级安全策略。

### 学生邀请码注册

`supabase/functions/register-student/` 负责验证班级群链接并创建学生账号。原始链接不进入仓库。部署者在本地临时设置链接并只把 SHA-256 哈希写入 Supabase Secret：

```bash
INVITE_LINK='从班级群复制的完整链接'
export STUDENT_INVITE_SHA256="$(printf '%s' "$INVITE_LINK" | shasum -a 256 | awk '{print $1}')"
supabase secrets set STUDENT_INVITE_SHA256="$STUDENT_INVITE_SHA256"
supabase functions deploy register-student
unset INVITE_LINK STUDENT_INVITE_SHA256
```

浏览器只提交邀请码链接到 Edge Function。服务端使用 `SUPABASE_SERVICE_ROLE_KEY` 创建已确认的内部账号，前端不会接触服务密钥。

## GitHub Pages

开启仓库的 Pages 部署来源，让 `Deploy web app to GitHub Pages` 工作流使用 GitHub Actions。设置仓库变量 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。工作流会根据仓库名生成静态资源路径。
