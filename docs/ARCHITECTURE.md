# 架构

```text
Hermes Desktop plugin.template.js → widget + creation-ui.mjs
                       ↓ authenticated loopback HTTP
server.mjs → creation-service.mjs → 冻结任务/状态/锚点
    ↓ storage-mcp.mjs → image-storage.mjs → 输入输出与映射
    ↓ mcp-client.mjs → vendor/cowart 预构建 MCP/widget
Hermes MCP → mcp-proxy.mjs → 相同 storage-mcp 包装
当前 Hermes 会话 → 核心 image_generate → 供应商
                       ↓ claim / complete / fail 回调
                 creation-service → 持久化 → 画布插入
```

桥 API `/v1/tool` 与 postMessage `cowart-hermes/v1` 为 v1；任务 API `/v2/jobs`、`/v2/state`、`/v2/anchor` 为 v2。bridge 仅监听回环，校验 Host/Origin/token 和工具白名单。当前用户文件权限是安全边界，并非对同用户恶意进程的隔离沙箱。

任务包含 ID、会话、冻结请求 hash、页与锚点；供应商只收到 prompt、alias、model、size、有序 references，不收到内部 callback 身份。原子 claim 防重复付费，成功落盘后插图，失败终结任务；callback 失败不自动重生成。原始上游可能保留兼容副本，但外部资产映射指向规范路径，解析受真实目录约束。

Hermes 核心负责可信当前 turn 来源、approval 策略、工具 schema、provider 参数转发与生命周期 wrapper。仅安装 Desktop 插件/MCP 不能实现这些语义。preflight 检查磁盘新进程，不证明已运行 gateway 已加载相同模块。

安装时生成 config、token、插件与目标能力绑定；仓库不携带这些状态。vendor 是自包含发行运行时，其上游源码并不代表可从本仓离线重编译 tldraw；本仓确定性构建是对锁定预构建运行时及适配源码的打包。
