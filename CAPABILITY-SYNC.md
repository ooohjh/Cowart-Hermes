# 图像能力同步与操作隔离（schema 6）

唯一维护源：本目录 `model-capabilities.json`。Hermes 的 `tools/image_generation_capabilities.json` 是生成副本，禁止单独编辑。

```text
node sync-capabilities.mjs --target <目标 Hermes 源码目录>
node sync-capabilities.mjs --target <目标 Hermes 源码目录> --check
```

同步先要求目标 `tools/image_generation_explicit.py` 声明 `CAPABILITY_SCHEMA = 6`。1.0.11 安装器在任何注册之前额外运行 `core-preflight.py`：真实导入无凭证 validator，以离线 fixture 验证 generate 通过/edit 拒绝，并用 AST 检查 handler/provider 的 operation-aware 调用。此检查不是核心补丁安装，也不是活跃 gateway 已重载的证明；目标必须预先具有兼容核心，之后重新检查 live schema。便携包只同步能力 JSON/本机绑定，不修改核心 Python，不修改聊天/生图端点。

同步生成两个仅本机使用的绑定文件：`capability-binding.local.json`、Hermes tools 下的 `image_generation_capability_binding.local.json`。包含本机路径与规范 SHA-256，不包含凭证。不得分发绑定文件；目标机器重新生成。规范哈希：递归排序对象键，保留数组顺序，UTF-8、非 ASCII 不转义、无空白 JSON。

服务器创建 job 前和 Hermes 执行 provider 前分别读回两表，版本/哈希/绑定缺失或漂移均拒绝请求。同步后重启 bridge 以更新 Node 导入缓存；Hermes core 改动需要实际运行进程重新加载，不能把新进程测试称为当前 gateway 热加载。

保留已有全部 images.generate 实测尺寸，包括 API requestSize 与预期输出 width/height 不同的历史条目。images.edit 单独为 unknown，不代表 unsupported，也不允许通过生成证据放行。真实参考参数决定操作，operation 提示不能绕过。测试中的 verified-edit fixture 仅用于离线 SDK mock，不是真实供应商证据。

无付费回归：
- `node --test tests/*.test.mjs`
- `node tests/ui-operation.mjs`（拦截画布写入及 jobs；生成可选、编辑未知、Enter 拦截）
- `node tests/ui-selection.mjs`（19 个选择/隐藏生命周期断言）
- 隔离 HERMES_HOME 后运行 Hermes `tests/tools/test_image_operation_gate.py` 等图像回归。
- `tests/fresh-runtime-preflight.py` 在 gateway 同解释器及 PYTHONPATH 下运行；不读取凭证、不请求 SDK，不存在的参考路径在读图前拒绝。

本轮未调用付费生成或编辑。每次付费验证仍需单独批准。
