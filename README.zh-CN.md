# Claude Code GUI

[English](README.md) | [简体中文](README.zh-CN.md)

一个**浏览器端**的 Claude Code 本地数据(`~/.claude`)可视化与管理界面,参考 OpenAI Codex 客户端的深色开发者工具风格(Codex/Linear 气质)。可浏览会话/转写(含工具调用与 diff)、管理 MCP / Skills / Memory / Settings / Plans、跨数据源全局搜索,以及一键 `claude --resume` 接回某个项目。

## 技术栈

Vue 3 · Vite · Naive UI · Tailwind · Pinia · Vue Router · TypeScript。
Node 桥接用 **Express 作为 Vite 中间件** → 单进程、单端口(5173)、同源、零 CORS。

## i18n(国际化)

自带轻量 i18n(无依赖):`src/i18n/{index,zh,en}.ts`。侧栏的 `中文 / EN` 开关即时切换全部界面文案,选择存到 `localStorage`。`t('key', {params})` 读取一个响应式 `locale`,所以任何用到它的模板都会在切换时重渲染。加新语言:放一个新字典文件并在 `index.ts` 注册即可。数据内容(会话标题、记忆、计划)按原样显示——只翻译界面外壳。

## 前置条件

- **Node.js ≥ 18**(用到了 ESM、`node:` 导入、`import.meta.url`)。
- 已安装并至少运行过一次 **Claude Code**——本工具读取它的 `~/.claude` 数据(经 `CLAUDE_CONFIG_DIR` 环境变量解析,默认 `~/.claude`)。

## 运行

```bash
npm install
npm run dev      # → http://127.0.0.1:5173
```

其它脚本:

```bash
npm run typecheck   # vue-tsc --noEmit
npm run build       # typecheck + vite build → dist/
npm start           # 独立桥接(端口 4317),托管 dist/ + /api
```

## 读取的数据(均在 `~/.claude/` 下)

| 域 | 位置 |
|---|---|
| 会话/转写 | `projects/<encoded-cwd>/<sessionId>.jsonl` |
| 子代理转写 | `projects/<enc>/<sessionId>/subagents/agent-*.jsonl` |
| 实时会话 | `sessions/<pid>.json` |
| MCP | `~/.claude.json`(`mcpServers` 全局 + 每项目) |
| Skills | `plugins/marketplaces/*/plugins/*/skills/*/SKILL.md` |
| Memory | `projects/<enc>/memory/*.md`(含 `MEMORY.md` 索引) |
| 用量统计 | `~/.claude.json` 每项目的 `last*` 字段 |

## 架构要点

- **转写解析**(`server/jsonl.ts`):流式读 JSONL,**只按根级行 `type`** 区分(另有嵌套的 `message.content[].type`,别混淆)。按 id 把 `tool_result` 配对回 `tool_use`。5MB 大转写约 200ms 解析;消息按窗口返回(`?offset&limit` 或 `?after=<uuid>`)。
- **路径安全**(`server/paths.ts`):根目录禁闭 + 穿越拒绝 + 文件名白名单。`:encoded`/`:id`/`:agentId` 均校验。
- **主题**:CSS 自定义属性 token(`src/styles/theme-tokens.css`)同时供 Tailwind 与 Naive UI `themeOverrides`(`src/theme.ts`)消费。

## 状态

- **v1(完成)**:会话列表 + 转写查看器(thinking、markdown、工具调用、Edit/Write diff、结果折叠、子代理线程可展开)、实时会话徽标、仪表盘。
- **v1.1(完成)**:MCP 服务器编辑器(`PUT /api/mcp/{global,project}`,Zod 校验 + 备份 + 原子写,保留 `.claude.json` 其余键);`/api/stats` 聚合每项目 `last*` 用量 → 仪表盘 token/成本/行数。
- **v1.2(完成)**:Skills 浏览器(遍历插件 marketplace + 用户技能,渲染 SKILL.md);Memory 查看器/编辑器(列表 + 渲染视图 + 原始编辑 + 增删,每次写前备份)。
- **v1.3(完成)**:Settings 编辑器(`settings.json` model + `includeCoAuthoredBy` + env 键值编辑 + 只读原始镜像;`config.json` API key 脱敏);Plans 阅读器/编辑器(首行 H1 标题,渲染 markdown + 原始编辑)。
- **编辑(完成)**:会话**重命名**(追加 `ai-title` 行)+ **删除**(转写 + 子代理 + `file-history/` + `session-env/`,删前备份);Skills 全 **CRUD**(新建 → 用户 `~/.claude/skills/`,编辑任意 `SKILL.md`,删除)。所有写入复用备份 + 路径禁闭;删除均有界面二次确认。
- **项目中心(完成)**:`/projects` 跨项目表 + `/projects/:encoded` 单项目聚合(最近会话、上次用量、项目 skills/MCP/memory 计数),各分区深链到对应模块。
- **接回 Claude(完成)**:一键 **resume** —— 在项目 cwd 开终端跑 `claude --resume <id>`。目前**仅 Windows**(见平台说明)。
- **全局搜索(完成)**:`/search` 跨会话 + 记忆 + 技能 + 计划,命中高亮片段、点击跳转。
- **i18n(完成)**:自带 中文 / English 开关。
- 生产构建已验证(`npm run build` → `dist/`,由 `npm start` 托管)。

### 后续可做
- 代码分割 `highlight.js`(`MarkdownBlock` chunk ~1MB,因注册了全部语言;改为按需导入常用语言)。
- 转写列表虚拟化(超长会话,目前是分页 load-more)。
- 大转写的 parse-index 缓存(按 uuid seek,免重复流式解析)。
- 项目级 `.claude/settings.json`(permissions/hooks)编辑器。
- resume 的 macOS/Linux 启动(目前仅 Windows)。

## 平台说明

- **resume**("继续会话" / 开终端跑 `claude --resume`)**仅 Windows**。macOS/Linux 上该端点返回 HTTP 501——其余功能全平台可用。欢迎贡献跨平台启动。
- 所有文件路径用 `path.join`/`path.resolve`;cwd 比较会归一化分隔符。已在 Windows 测试;除 resume 外应在 macOS/Linux 正常工作。

## 配置(环境变量)

- `CLAUDE_CONFIG_DIR` — 覆盖 Claude 数据目录(默认 `~/.claude`)。
- `PORT` — 独立服务器端口(`npm start`,默认 4317)。

## 协议

[MIT](./LICENSE) © KingLinH
