# MyArchive Win 后端 READY 交接

更新日期：2026-08-05 18:19（Asia/Shanghai）

> 本回执只记录脱敏接口合同与验收结果。未写入数据库密码、`service_role`、secret key、publishable key 值、AI key、完整 Bearer token 或正式记录正文。

## 1. 结论

- 手机共库 API：**已实现**，采用方案 A：App -> Win 本地 API -> Supabase。
- 共享 Supabase 数据库：project ref `wpekwxjyniytfciemymk`，区域 `ap-northeast-1`（Tokyo）。
- Web 与 API 是否确认读写同一张 `records` 表：**是**。API 通过同一 Supabase 项目的 `records`、`notes`、`categories` 读写；Web 仍由 `cloud-store.js` 直接读取同一组表。
- API 服务代码：`C:\Users\杨博夫\Documents\经历平台MVP\mobile-api\`。
- 当前实现 commit：`3e296a5`（本次交付的实现提交）。
- 本次未完成项：本机没有 MuMu/ADB，无法执行实体模拟器的 `adb reverse` 验收；实体手机没有可用的 LAN/HTTPS 地址。

## 2. 服务位置与启动

- 仓库：`https://github.com/helloalbert2010/MyArchive.git`
- Win 服务启动：`npm run dev:api`
- 服务监听：`HOST=127.0.0.1`、`PORT=8787`
- API Base URL（Win）：`http://127.0.0.1:8787`
- API Base URL（MuMu）：执行 `adb -s 127.0.0.1:7555 reverse tcp:8787 tcp:8787` 后使用 `http://127.0.0.1:8787`
- API Base URL（实体手机）：当前未提供。实体手机的 `127.0.0.1` 指向手机本身，不能直接复用 Win 地址；需要后续受控 LAN/HTTPS 暴露方案。
- Web 服务仍独立运行：`npm run dev` -> `http://127.0.0.1:5173`
- MuMu 是否需要 `adb reverse`：**需要**（当前设备环境未安装/启动 ADB，未执行）。

## 3. 脱敏环境变量

服务读取被 Git 忽略的 `.env.local`；`.env.example` 只包含空变量名和用途，不含值。服务端使用 `SUPABASE_*`，不会读取或要求手机携带 `VITE_*` 客户端配置。

| 变量名 | 用途 | 必需 | 已配置 | 脱敏样例 |
| --- | --- | --- | --- | --- |
| `HOST` | HTTP 监听地址 | 否 | 是 | `127.0.0.1` |
| `PORT` | HTTP 监听端口 | 否 | 是 | `8787` |
| `TZ` | 日期计算时区 | 否 | 是 | `Asia/Shanghai` |
| `CORS_ORIGIN` | 本机/Web 调试来源 | 否 | 是 | `*`（仅 loopback 联调） |
| `MAX_BODY_BYTES` | 请求体上限 | 否 | 是 | `1048576` |
| `DATABASE_TIMEOUT_MS` | 数据库请求超时 | 否 | 是 | `10000` |
| `AGENT_TIMEOUT_MS` | Agent 请求超时 | 否 | 是 | `30000` |
| `SUPABASE_URL` | Supabase 项目地址 | 是 | 是 | `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | 是 | 是 | `<redacted>` |
| `AGENT_API_URL` | 可选受控 Agent 地址 | 否 | 否 | 空 |
| `AGENT_API_KEY` | 可选服务端 Agent key | 否 | 否 | 空 |

## 4. 实际 API 合同

所有响应均为 `application/json; charset=utf-8`，并设置 `Cache-Control: no-store`。当前本机阶段无 App 认证 Header；手机只发送 `Content-Type: application/json`。

### `GET /health`

数据库可达时返回 `200`：

```json
{
  "service": "myarchive-api",
  "status": "ok",
  "supabaseConfigured": true,
  "databaseReachable": true,
  "agentConfigured": false,
  "version": "1.0.0",
  "timestamp": "<ISO 8601>"
}
```

数据库环境缺失时返回 `503`：`SUPABASE_NOT_CONFIGURED`；数据库上游失败返回 `502`：`UPSTREAM_UNREACHABLE` 或 `UPSTREAM_ERROR`。

### `GET /api/records`

返回创建时间降序的完整 camelCase 数组：

```json
{
  "records": [
    {
      "id": "record-id",
      "title": "经历标题",
      "category": "研究和探究",
      "occurredOn": "2026-08-05",
      "description": "原始记录",
      "aiDescription": "",
      "keywords": [],
      "uncertainties": [],
      "files": [],
      "photos": [],
      "needsDate": false,
      "createdVia": "mobile",
      "createdAt": "<ISO 8601>",
      "updatedAt": "<ISO 8601>"
    }
  ]
}
```

无数据时 `records` 为 `[]`。

### `GET /api/archive/snapshot`

```json
{
  "snapshot": {
    "totalRecords": 37,
    "domainCount": 8,
    "aiReadyCount": 20,
    "weeklyRecordDays": [0, 2, 5],
    "categories": ["学术竞赛", "研究和探究", "艺术活动"]
  }
}
```

`totalRecords` 与同一时刻 `/api/records` 数量一致；`weeklyRecordDays` 使用 `Asia/Shanghai`，周一为 0、周日为 6；`categories` 合并 11 个默认分类与 `categories` 表自定义分类并去重。

### `GET /api/categories`

```json
{
  "categories": ["学术竞赛", "体育竞赛", "研究和探究", "艺术活动"]
}
```

### `POST /api/records`

请求接受 `title`、`category`、`occurredOn`、`description`。正文去首尾空白后不得为空；日期可为 `null`/空字符串，或真实 `YYYY-MM-DD`。服务端生成 `record-mobile-<uuid>` ID，填充空数组、`aiDescription: ""`、`createdVia: "mobile"` 和 `needsDate`。

成功返回 `201`：`{ "record": <完整 camelCase 记录> }`。错误：空正文 `400 EMPTY_DESCRIPTION`，无效日期 `400 INVALID_DATE`。

### `POST /api/notes`

请求：`{ "content": "一段随手记", "noteDate": "2026-08-05" }`。

成功返回 `201`：

```json
{
  "receipt": {
    "captureId": "note-mobile-<uuid>",
    "createdAt": "<ISO 8601>",
    "kind": "text",
    "status": "saved",
    "transcriptionStatus": "not_requested"
  }
}
```

错误：空正文 `400 EMPTY_CONTENT`，无效日期 `400 INVALID_DATE`。

### `POST /api/assistant/messages`

接受 `{ "message": "...", "conversationId": "可选" }`。当前没有 `AGENT_API_URL`/`AGENT_API_KEY`，因此有效消息返回 `503 AGENT_NOT_CONFIGURED`；空消息返回 `400 EMPTY_MESSAGE`，超过 8000 字符返回 `400 MESSAGE_TOO_LONG`。不会返回假回复。

### 统一错误形状

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "可直接显示给用户的中文错误"
  }
}
```

已实现：`INVALID_JSON`、`EMPTY_DESCRIPTION`、`EMPTY_CONTENT`、`INVALID_DATE`、`EMPTY_MESSAGE`、`MESSAGE_TOO_LONG`、`NOT_FOUND`、`BODY_TOO_LARGE`、`SUPABASE_NOT_CONFIGURED`、`AGENT_NOT_CONFIGURED`、`UPSTREAM_UNREACHABLE`、`UPSTREAM_ERROR`、`AGENT_TIMEOUT`。

## 5. 数据映射与网络限制

- `records.occurred_on -> occurredOn`、`ai_description -> aiDescription`、`needs_date -> needsDate`、`created_via -> createdVia`、`created_at -> createdAt`、`updated_at -> updatedAt`。
- `keywords`、`uncertainties`、`files`、`photos` 始终返回数组。
- 服务时区：`Asia/Shanghai`。
- 请求体上限：`1048576` bytes。
- 数据库超时：10 秒；Agent 超时：30 秒。
- CORS：本机阶段 `*`；服务只绑定 `127.0.0.1`，不对局域网匿名暴露。
- 认证：本机/MuMu 阶段无 App Header；数据库 publishable key 只留在 Win 服务环境，不下发手机。
- HTTPS / 局域网：当前没有实体手机地址；若要开放 LAN/HTTPS，必须先增加应用级认证、限流和受控域名。

## 6. 实测证据

- 测试时间：2026-08-05 18:16（Asia/Shanghai）。
- `GET /health`：`200`，JSON，`status=ok`，`databaseReachable=true`，`agentConfigured=false`。
- 基线 records 数量：37。
- `/api/archive/snapshot.totalRecords`：37，与 records 一致。
- `/api/categories`：数组，11 个分类（默认分类合并后）。
- 合同测试创建 ID：`record-mobile-41755022-9898-4e14-ba90-c2a3c0629e63`；随手记 ID：`note-mobile-89f53f81-e638-4148-b587-5e448a559ea2`。
- 合同测试 API 回读：通过；Supabase 直接回读：通过；精确 ID 清理：通过；基线恢复：通过。
- Web 可见性测试 ID：`record-mobile-152e1177-476b-443c-8a12-2e57c92c0fa1`；生产 Web 经历库刷新后可见，精确删除后 Web 刷新不可见。
- 异常合同：`INVALID_JSON`、`EMPTY_DESCRIPTION`、`INVALID_DATE`、`BODY_TOO_LARGE`、`EMPTY_MESSAGE`、`AGENT_NOT_CONFIGURED`、`NOT_FOUND`、`SUPABASE_NOT_CONFIGURED` 均返回预期状态码和 JSON 错误。
- MuMu `adb reverse`：未通过/未执行。本机 `adb` 不在 PATH，常见 MuMu 路径无 `adb.exe`，无 MuMu/ADB 进程和常见 ADB 监听端口。
- 未通过项：仅设备侧 ADB/MuMu 网络验证和实体手机 LAN/HTTPS 验证未完成。

## 7. 手机端需要变更的内容

- `EXPO_PUBLIC_API_BASE_URL`：MuMu 保持 `http://127.0.0.1:8787`，执行 reverse 后联调；实体手机待提供 LAN/HTTPS 地址。
- 新增 Header / 认证：无。
- 路径或 JSON 与本文档的差异：无；字段为 camelCase。
- 允许手机端开始真实联调：**是（Win API、Supabase 共库、Web 回读和错误合同已通过；设备 ADB 验证待补）**。
