# MyArchive · 经历记忆库 MVP

面向国际高中生的多页面产品原型。它用于记录经历、浏览事件关系图、检索经历库，并通过 AI 协助整理素材。

当前是一个 **Vite 多页面应用**。配置 Supabase 后，事件、随手记和自定义分类以唯一一套云端数据为主存储，不区分用户，也不需要登录；浏览器本地存储作为读取缓存。未配置 Supabase 时仍使用项目内的 `data/` 文件接口，附件暂时保存在本机。

Supabase 开发项目已经完成共享结构迁移，Web 客户端会直接读写云端。`data/archive-data.json` 已一次性上传并核对为 35 条事件、31 条随手记。范围、安全边界和接入验收见 [云端数据库准备](docs/cloud-database.md)。

## 快速开始

```powershell
npm ci
npm run dev
```

打开 [http://127.0.0.1:5173/](http://127.0.0.1:5173/)。

常用命令：

```powershell
npm run check    # 检查页面入口、站内资源引用与遗留方案文件
npm run clean    # 清理生成的 dist/
npm run build    # 生成生产构建到 dist/
npm run verify   # 先检查，再构建
npm run preview  # 本地预览已构建版本
```

需要 Node.js `20.19+`、`22.12+` 或更新版本。

## 页面与入口

| 路径 | 作用 |
| --- | --- |
| `index.html` | 首页，唯一的首页实现 |
| `record.html` | 新建经历、上传资料、生成摘要 |
| `library.html` | 经历库与筛选 |
| `detail.html?id=...` | 记录详情、编辑和附件管理 |
| `chat.html` | 与经历助手对话和检索 |
| `calendar.html` | 按日期查看事件与随手记 |
| `notes.html` | 按时间查看所有随手记正文 |
| `atlas.html` | 事件关系星球 |
| `growth.html` | 个人成长画像、特质雷达与年度认知边界对比 |
| `settings.html` | 兼容入口，访问后自动回到首页 |

首页仅由 `home.js` 和 `home.css` 实现。不要再添加方案编号页面或方案选择页；历史十套首页设计已移出工作区并归档。

## 代码结构

| 文件 | 职责 |
| --- | --- |
| `app.js` | 页面壳、共享数据同步、记录、聊天和设置的页面初始化 |
| `home.js` / `home.css` | 首页结构与首页专属样式 |
| `memory-atlas.js` | Three.js 事件关系星球 |
| `growth-profile.js` | 可追溯画像评分规则、雷达图与证据交互 |
| `ai-client.js` | DeepSeek / GLM 请求封装 |
| `styles.css` | 除首页外的共享布局与组件样式 |
| `vite.config.js` | 多页面构建入口与本机文件存储接口 |
| `scripts/check-project.mjs` | 不依赖浏览器的项目完整性检查 |
| `supabase/migrations/` | Supabase 建表、索引和 RLS 迁移 |
| `docs/cloud-database.md` | Web 与手机端共同遵守的数据合同和验收边界 |
| `docs/mobile-database-integration.md` | 可直接交付给手机端伙伴的数据库接入、CRUD 和联调文档 |
| `docs/test-evidence.md` | 本地准备验证和待完成的云端测试证据 |

更完整的修改边界和数据约定见 [AGENTS.md](AGENTS.md)。

## 数据与 AI 接口

本机共享数据：

| 路径 | 内容 |
| --- | --- |
| `data/archive-data.json` | 经历记录和随手记 |
| `data/archive-data.backup.json` | 每次写入前自动保留的上一版记录 |
| `data/media/` | 上传的文件与照片 |

这两个位置已加入 `.gitignore`，不会被误提交。首次打开新版页面时，当前浏览器已有的事件、随手记和 IndexedDB 附件会自动合并迁移。共享文件接口由 Vite 的本地开发/预览服务器提供，因此应通过 `npm run dev` 或 `npm run preview` 使用。

浏览器保留的数据键：

| 存储 | 键 / 数据库 | 内容 |
| --- | --- | --- |
| `localStorage` | `ji-records-v1` | 经历记录本地副本与旧数据迁移来源 |
| `localStorage` | `ji-notes-v1` | 随手记本地副本与旧数据迁移来源 |
| `localStorage` | `ji-settings-v1` | 自定义分类与手动 API Key 覆盖 |
| `sessionStorage` | `ji-chat-v2` | 当前会话聊天记录 |
| IndexedDB | `ji-media-v1` / `uploads` | 旧附件迁移来源和共享接口不可用时的兜底 |

比赛演示可在被 Git 忽略的 `.env.local` 中配置 `VITE_DEEPSEEK_API_KEY` 和 `VITE_GLM_API_KEY`，启动 Vite 后页面会自动使用它们，评委无需填写 Key。当前请求从浏览器直接发往 DeepSeek 和 GLM，因此生产环境必须改为由受控服务端代理请求、保存密钥并执行鉴权；不要将真实生产 Key 放在浏览器中。

## Supabase 数据库准备

第一阶段只迁移经历记录、随手记和自定义分类。附件文件、聊天会话、AI Key 和 Web 部署不在这一阶段。

- 数据库迁移：`supabase/migrations/202608030001_archive_schema.sql`、`supabase/migrations/202608030002_shared_archive.sql`
- 客户端变量模板：`.env.example`
- 详细字段合同与双端验收：`docs/cloud-database.md`

不要把数据库密码或 `service_role` Key 写入任何以 `VITE_` 开头的变量。本机只在被 Git 忽略的 `.env.local` 中配置项目 URL、publishable key 和比赛演示用 AI Key。当前共享模式没有账号隔离：任何拿到 publishable key 的客户端都能读写整库，因此只适合个人开发演示，不能直接作为公开生产架构。

## 当前限制

- Web 已使用单一共享 Supabase 数据；手机端读取与写入仍待实测。
- 当前没有身份认证或用户隔离，公开部署前必须补回访问控制。
- 附件仍只在当前项目目录或当前浏览器中保存，手机端不能取得附件本体。
- 没有自动化浏览器测试；每次修改交互或布局后，至少运行 `npm run verify` 并手动检查受影响页面。
- `app.js` 目前是集中式页面控制器。功能改动应先定位对应 `init*` 函数，避免无关重构。
