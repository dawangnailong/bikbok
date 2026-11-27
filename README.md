# bikbok

一个纯前端、可本地运行的虚拟主播搭档沙盒。玩家既是主播的经纪人，也是直播搭档：可以控制开播／下播、直播标题和分区，录入弹幕、干预经济数据、创建与接取商单，并通过润色回复或重新生成分支来探索不同经营路线。

界面采用 Google Material 风格，支持桌面端与移动端。默认提供无需联网和 API Key 的本地演示搭档，也可以接入 DeepSeek 等 OpenAI 兼容聊天接口。

## 核心玩法

- **直播状态**：直播中的玩家输入与 AI 可见回复共同构成直播内容；下播后的对话仅作为私下交流归档。
- **本地经营结算**：直播回合归档后，本地评分器计算互动、新颖、分区契合、争议、风险、商业契合和疲劳，并更新粉丝、观众、热度、平台风险与打赏。
- **可替换评分包**：内置默认直播与背德直播 DLC。背德商品模板包括性玩具、枪械、兴奋剂、伏地魔的圣器和黑暗超能量体。
- **商单系统**：累计商单、最近四件窗口、单件持有、查看／接取工具、履约证据、达标评分、放弃和奖励结算均由游戏本体管理。自动产生器默认返回空，可手动创建商单或预设下一次输出。
- **手动弹幕**：默认没有自动弹幕。玩家录入的近期弹幕会进入下一轮直播提示词。
- **分支历史**：润色 AI 回复或重新生成时会创建新分支，保留原分支；每个回合保存结算前后快照。
- **chat-demo 导入**：支持从 `deepseek-ai/chat-demo` 导出的格式 3 ZIP 导入消息树和分支。`REQUEST`／`RESPONSE` 分别映射为玩家与 AI 正文，`THINK` 不进入玩法。

## 本地运行

建议使用 Node.js 22 LTS，并使用支持 IndexedDB、Web Worker 和 WebAssembly 的现代浏览器。

```bash
npm install
npm run dev
```

终端会显示本地访问地址，通常为 `http://localhost:5173`。

### 生产构建

```bash
npm run build
npm run preview
```

构建结果位于 `dist/`。部署时需要支持静态单页应用；项目包含 PWA Service Worker，建议通过 HTTPS 或 localhost 访问。

### 其他命令

```bash
npm run lint
```

## 接入真实模型

在页面右上角打开“设置”，选择“OpenAI 兼容接口”并填写：

- Base URL：默认为 `https://api.deepseek.com/v1`
- Model：默认为 `deepseek-chat`
- API Key：由用户自己的模型服务商提供

请求由浏览器直接发送到所配置的 `/chat/completions` 接口，项目没有应用后端或密钥代理。因此，自定义服务必须允许浏览器跨域访问；如遇 CORS 限制，需要由接口提供方解决，或在自行部署时增加受控代理。

模型设置和 API Key 保存在当前浏览器的 localStorage 中。请勿在公共或不可信设备上保存密钥，也不要把真实密钥写入源码或提交到仓库。

## 数据与隐私

- 会话、分支、回合快照、评分、弹幕、商单和经营状态保存在当前浏览器的 IndexedDB。
- 模型设置与当前会话 ID 保存在 localStorage。
- 数据不会自动跨浏览器或跨设备同步。
- 清除站点数据会删除本地存档，建议定期在“数据”页面导出 JSON 备份。
- 只有配置真实模型后，提示词所需的人设、直播状态和近期对话才会发送给相应模型服务。

## 导入与导出

### 导入 chat-demo ZIP

“数据”页面支持 `export_format_version: 3` 的 chat-demo 导出包，包括：

- `manifest.json`
- `chat_sessions/{session_id}.json`
- `chat_session_index.json`
- 基于 `id`／`parent_id` 的消息树
- 基于 `current_message_id` 的当前分支选择

每条根到叶路径会导入为一条 bikbok 分支。附件只计数并跳过；导入回合默认视为下播后的私下交流，不追溯直播评分、打赏或商单。

### bikbok 备份

可以导出当前会话或全部会话为 JSON，也可以重新导入 bikbok JSON 备份。

## 项目结构

```text
src/
├── components/          # 聊天区、直播控制台、对话框与 Material 组件
├── game/
│   ├── defaults.ts      # 初始状态、人设与商品模板
│   ├── engine.ts        # 回合归档、分支和直播结算编排
│   ├── prompt.ts        # 主播人设与直播上下文提示词
│   ├── scoring.ts       # 本地规则、语义增强与商单达标评分
│   ├── sponsors.ts      # 商单窗口、持有、履约和奖励生命周期
│   └── types.ts         # 游戏数据模型
├── services/
│   ├── chatDemoImport.ts# chat-demo ZIP 适配器
│   ├── db.ts            # IndexedDB 与 localStorage 持久化
│   ├── model.ts         # 演示搭档、OpenAI 兼容接口与工具循环
│   ├── semantic.ts      # 语义 Worker 调度与回退
│   └── semantic.worker.ts
├── App.tsx              # 应用状态与交互编排
└── App.css              # Material 风响应式界面
```

## 技术栈

React 19、TypeScript、Vite、Tailwind CSS、Lucide、IndexedDB、Transformers.js、fflate、vite-plugin-pwa。

## 当前边界

- 这是纯前端单机项目，没有账号、云同步或多人服务。
- 默认演示搭档使用本地规则生成文本，不等同于真实 LLM。
- 自动弹幕和自动商单产生器按设计默认留空，由玩家录入、创建或预设。
- 语义模型体积较大且按需加载，不属于默认评分的必要依赖。
