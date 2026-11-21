# 中考背诵调度工具实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个面向初中生的中考背诵工具，支持实词每日新学加间隔复习、已解锁诗文句段复习、学生账号、多端同步和 GitHub Pages 发布。

**Architecture:** 使用 pnpm workspace 管理 React/Vite/TypeScript 前端、内容导入脚本和共享领域逻辑。前端发布到 GitHub Pages，Supabase Auth 和 Postgres 保存账号与学习事件，IndexedDB 保存离线内容和待同步事件。内容包使用稳定 ID，后端通过复习事件触发器聚合学习状态，前端保留接口层以支持未来迁移到 PythonAnywhere。

**Tech Stack:** React, Vite, TypeScript, pnpm, CSS Modules, Supabase Auth, Supabase Postgres, Vitest, Playwright, Python 3.12 内容导入脚本。

**Spec:** `docs/superpowers/specs/2026-11-21-chinese-classics-spaced-repetition-design.md`

## Global Constraints

- 每日默认新实词数量为 5 个，默认复习上限为 30 张，两个设置均可修改。
- 首页把新学实词和诗文复习分成两个入口。
- 诗词按联或小节切分，文言文按自然段或语义段切分，实词按具体义项切分。
- 四档评分只更新卡片间隔，熟练状态由学生手动标记。
- 第一版使用班级群邀请码注册，用户名加密码登录，昵称可选，不收集邮箱、真实姓名、手机号、学校、班级和出生日期。
- 第一版不提供汉字手写识别，不把输入文字匹配当作书写能力证明。
- 所有用户数据通过 Supabase 行级安全策略隔离，客户端不包含服务端密钥。
- 原始 PDF 不进入公共仓库，公共仓库保存标准化内容包和导入脚本。
- 复习卡需要支持手机、平板和桌面端，主要操作目标至少 44 像素高。
- 动画必须尊重 `prefers-reduced-motion`。

## Review Focus

- PDF 版面错位和推广页眉。导入测试必须确认只保留篇目、作者、段落、义项、例句和出处。
- 同一字的多义项。调度测试必须确认每个义项拥有独立状态，语境不同不会互相覆盖。
- 复习事件重复上传。数据库测试必须确认相同事件 ID 不会重复计入失败次数或改变到期时间两次。
- 多设备同时复习。同步测试必须确认所有事件保留，状态按服务器接收顺序聚合。
- 日界线和时区变化。调度测试必须确认到期时间使用用户本地自然日，切换时区不会重写已生成的到期时间。

### Task 1: Workspace scaffold and shared contracts

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `packages/domain/package.json`
- Create: `packages/domain/src/types.ts`
- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/index.ts`
- Create: `vitest.config.ts`
- Test: `packages/domain/src/ids.test.ts`

**Interfaces:**
- Produces `ContentPack`, `Piece`, `Segment`, `Sense`, `Card`, `ReviewGrade`, `LearningState`, `ReviewEvent` and `QueueItem` types for all later tasks.
- Produces `makePieceId(packId: string, sourceKey: string): string` and `makeCardId(contentVersion: string, cardKey: string): string`.

- [ ] **Step 1: Write failing contract tests**

  Test stable ID generation for identical inputs, distinction between different segment indexes, and the four review grades.

- [ ] **Step 2: Run `pnpm vitest run packages/domain/src/ids.test.ts` and verify it fails because the workspace is not scaffolded.**

- [ ] **Step 3: Create the pnpm workspace and shared domain contracts.**

  Keep content identifiers string-based and versioned. Use discriminated unions for `piece`, `segment`, `sense`, and card kinds.

- [ ] **Step 4: Run the focused test and the TypeScript type check.**

- [ ] **Step 5: Commit the scaffold and contracts.**

### Task 2: Content normalization and validation

**Files:**
- Create: `scripts/import_content.py`
- Create: `scripts/validate_content.py`
- Create: `content/packs/zhongkao-2024/manifest.json`
- Create: `content/packs/zhongkao-2024/pieces.json`
- Create: `content/packs/zhongkao-2024/segments.json`
- Create: `content/packs/zhongkao-2024/senses.json`
- Create: `content/packs/zhongkao-2024/cards.json`
- Create: `scripts/tests/test_import_content.py`
- Create: `scripts/tests/fixtures/layout_noise.txt`

**Interfaces:**
- Consumes the locally extracted source text from the three supplied PDFs.
- Produces a versioned content pack with the counts and source tags required by the design.
- Produces `validate_pack(path: Path) -> ValidationReport` for CI and local verification.

- [ ] **Step 1: Write failing parser tests for page markers, page footers, promotion text, grade headings, author lines, word senses, and the `非考试篇目` tag.**

- [ ] **Step 2: Run `python3 -m pytest scripts/tests/test_import_content.py -q` and verify the parser tests fail.**

- [ ] **Step 3: Implement normalization from text exports.**

  Preserve source wording and line breaks, assign stable keys, retain source notes, and separate title/author lines from poem text. Keep the original PDF outside the repository.

- [ ] **Step 4: Generate and validate the initial pack.**

  Require 41 normalized prose pieces, the manually reviewed poetry count from the source, 150 numbered real-word entries, 6 function-word entries, no page markers, and no promotion text.

- [ ] **Step 5: Commit the pack and importer with a validation report.**

### Task 3: Spaced-repetition domain logic

**Files:**
- Create: `packages/domain/src/scheduler.ts`
- Create: `packages/domain/src/queue.ts`
- Create: `packages/domain/src/time.ts`
- Test: `packages/domain/src/scheduler.test.ts`
- Test: `packages/domain/src/queue.test.ts`
- Test: `packages/domain/src/time.test.ts`

**Interfaces:**
- Produces `computeNextLearningState(input: ReviewInput): LearningState`.
- Produces `buildDailyQueue(input: QueueInput): QueueItem[]`.
- Produces `getLocalDayKey(date: Date, timeZone: string): string`.

- [ ] **Step 1: Write failing tests for new-card steps of 10 minutes, 1 day and 3 days.**

- [ ] **Step 2: Write failing tests for grades `again`, `hard`, `good`, and `easy` using the exact interval multipliers 1.0 reset, 1.5, 2.3 and 3.5.**

- [ ] **Step 3: Write failing queue tests for overdue priority, same-day failed cards, the 5-card new-item target, the 30-card default cap, separate vocabulary and prose queues, and the 10-minute slice.**

- [ ] **Step 4: Implement the pure scheduler and queue functions.**

  Store due times as ISO timestamps, derive the day key with the user timezone, preserve the four self-rating grades, and keep manual `mastered` separate from interval updates.

- [ ] **Step 5: Run all domain tests and verify deterministic output for fixed timestamps.**

- [ ] **Step 6: Commit the domain package.**

### Task 4: Supabase schema, RLS and review-event aggregation

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `supabase/migrations/0002_review_event_trigger.sql`
- Create: `supabase/tests/rls.sql`
- Create: `supabase/tests/review_event_cases.sql`
- Create: `apps/web/src/lib/backend.ts`
- Create: `apps/web/src/lib/supabase.ts`
- Test: `apps/web/src/lib/backend.test.ts`

**Interfaces:**
- Produces `BackendClient` with `getSession`, `getSettings`, `getLearningStates`, `getPieceProgress`, `appendReviewEvent`, `setPieceProgress`, and `updateSettings`.
- The database exposes an idempotent review-event insert path keyed by `event_id`.

- [ ] **Step 1: Write SQL cases for user isolation, duplicate event IDs, same-card events, and two-device event ordering.**

- [ ] **Step 2: Run the SQL cases against a local Supabase/Postgres test instance and verify they fail before migrations.**

- [ ] **Step 3: Add profiles, settings, learning states, review events and piece progress tables.**

  Add user-scoped RLS policies. Keep content packs static and reference them through stable IDs.

- [ ] **Step 4: Add the server-side review-event trigger or function.**

  Insert each event once, lock the corresponding learning state, apply the grade transition, and update the aggregate state. A repeated event ID returns the existing result without applying the transition twice.

- [ ] **Step 5: Implement the browser backend adapter and tests for session, settings, event append and sync error mapping.**

- [ ] **Step 6: Run SQL and TypeScript tests, then commit the schema and adapter.**

### Task 5: Offline cache and synchronization

**Files:**
- Create: `apps/web/src/lib/offline-db.ts`
- Create: `apps/web/src/lib/sync-queue.ts`
- Create: `apps/web/src/hooks/useSync.ts`
- Test: `apps/web/src/lib/sync-queue.test.ts`

**Interfaces:**
- Produces `queueReviewEvent(event: ReviewEvent): Promise<void>`.
- Produces `flushPendingEvents(): Promise<SyncResult>`.
- Produces `useSyncStatus(): { online: boolean; pendingCount: number; lastError?: string }`.

- [ ] **Step 1: Write failing tests for offline event persistence, reconnect flush, duplicate event handling and content-version mapping.**

- [ ] **Step 2: Implement IndexedDB stores for content cache, learning-state cache and pending review events.**

- [ ] **Step 3: Implement reconnect flushing with bounded retries and user-visible sync status.**

- [ ] **Step 4: Run sync tests with fake network transitions and verify no event is lost.**

- [ ] **Step 5: Commit the offline layer.**

### Task 6: Application shell, authentication and pages

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/routes.tsx`
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/pages/AuthPage.tsx`
- Create: `apps/web/src/pages/TodayPage.tsx`
- Create: `apps/web/src/pages/ReviewSessionPage.tsx`
- Create: `apps/web/src/pages/ContentPage.tsx`
- Create: `apps/web/src/pages/SettingsPage.tsx`
- Create: `apps/web/src/components/ReviewCard.tsx`
- Create: `apps/web/src/components/QueueSummary.tsx`
- Create: `apps/web/src/components/ProgressList.tsx`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/global.css`
- Test: `apps/web/src/pages/ReviewSessionPage.test.tsx`

**Interfaces:**
- Consumes the shared domain functions, `BackendClient`, content pack and sync hooks.
- Produces the student flows for invite-link registration, username/password auth, separate vocabulary and prose queues, piece unlock, review rating, manual mastery and settings.

- [ ] **Step 1: Write failing component tests for answer reveal, four rating buttons, an interrupted card, separate task entry points and manual mastery.**

- [ ] **Step 2: Build the auth page and protected app shell.**

  Use an Edge Function to validate the invite-link hash and create a confirmed Supabase user with a synthetic internal email. The browser exposes only username, password, nickname and invite-link fields.

- [ ] **Step 3: Build Today, Review Session, Content and Settings pages.**

  Keep the main copy in plain Chinese. Make the first action on Today the selected task, and keep queue counts secondary.

- [ ] **Step 4: Add responsive styling and motion.**

  Use the approved paper, ink, jade and warm-yellow tokens. Use CSS transitions around 180 milliseconds, visible focus states, minimum 44-pixel controls and reduced-motion fallbacks.

- [ ] **Step 5: Run component tests and a local browser smoke test for mobile and desktop widths.**

- [ ] **Step 6: Commit the application shell.**

### Task 7: PWA, deployment and repository documentation

**Files:**
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/public/manifest.webmanifest`
- Create: `apps/web/public/icons/*`
- Create: `.github/workflows/deploy-pages.yml`
- Create: `.env.example`
- Create: `README.md`
- Create: `docs/content-pack-format.md`
- Create: `docs/deployment.md`
- Test: `tests/e2e/auth-and-review.spec.ts`

**Interfaces:**
- Produces a static GitHub Pages build with environment-injected Supabase URL and anonymous key.
- Produces documentation for local setup, content import, Supabase migration, GitHub Pages deployment and future backend replacement.

- [ ] **Step 1: Add PWA manifest and service-worker caching for the app shell and active content pack.**

- [ ] **Step 2: Add GitHub Pages build and deployment workflow.**

  The workflow must fail when required public environment variables are missing and must never print secrets.

- [ ] **Step 3: Add Playwright coverage for registration, login, queue start, rating, offline event queueing and reconnect sync.**

- [ ] **Step 4: Run `pnpm test`, `pnpm build`, the Supabase SQL checks and the Playwright smoke suite.**

- [ ] **Step 5: Commit deployment documentation and run a preview build.**

### Task 8: Full verification and release review

**Files:**
- Modify: `README.md`
- Create: `work/release-verification.md`

- [ ] **Step 1: Validate the content pack counts and absence of PDF layout noise.**

- [ ] **Step 2: Verify the complete daily flow with a fresh student account and two browser profiles.**

- [ ] **Step 3: Verify RLS with two users and confirm neither can read the other user's settings or review events.**

- [ ] **Step 4: Verify an offline review, reconnect upload, duplicate event and content-version migration.**

- [ ] **Step 5: Run the final test and build commands, capture their output in `work/release-verification.md`, and perform the final security review.**

- [ ] **Step 6: Commit the verified release.**

## Plan Self-Review

- The content import task covers all three source classes and keeps source PDFs out of the public repository.
- The domain task covers new learning, review intervals, daily caps, separate queues, local day boundaries and manual mastery.
- The database task covers account isolation, event idempotency and multi-device aggregation.
- The offline task covers the design's first-login online boundary and pending-event behavior.
- The UI task covers authentication, the two home entry points, card reveal, four ratings, progress browsing and responsive visual requirements.
- The deployment task covers GitHub Pages, PWA behavior and future backend replacement documentation.
- The release task verifies every explicit product requirement with current-state evidence.
