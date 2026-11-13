# Hermes 核心集成要求（不含补丁）

当前交付明确为 adapter-only。检查过本地 Hermes 工作树：存在已修改文件及未跟踪的图像相关模块，基线 SHA 为 `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`。这个 SHA 仅是审查基线，**不是兼容版本承诺**。尚未对干净基线重放补丁、证明所有改动来源/许可并完成完整核心回归，因此不把当前工作树 diff 打包为可安装补丁。

## 必需接口
- `tools/image_generation_explicit.py`：CAPABILITY_SCHEMA=6，按操作区分 validate_route / operation_for。
- `tools/image_generation_approval.py`：POLICY_VERSION=1；仅可信 user_direct/cowart_user_submit 来源可授权 unknown，工具自述字段无效。
- `tools/image_generation_cowart.py`：LIFECYCLE_VERSION=1；任务头、session/hash 核验、原子 claim、成功 complete 与终态 fail。
- `tools/image_generation_tool.py` 与 `plugins/image_gen/openai/__init__.py`：显式路由、有序引用、操作验证、approval 参数、尺寸实测与生命周期接入。
- `agent/turn_context.py`、`agent/tool_executor.py`、`agent/agent_runtime_helpers.py`、`model_tools.py`：可信当前 turn/user 来源传递；委派、cron 不能伪装主动请求。

执行 `python core-preflight.py <兼容Hermes源码>`（必须使用该 Hermes 的 Python）。测试使用 mock，不调用供应商；缺模块应失败，不应绕过 preflight。通过后仍需验证活动 image_generate schema，必要时从会话外完整重启 gateway。

后续交付独立补丁必须：确定许可、标明基线 SHA、只筛选相关 hunks、对干净工作树 `git apply --check`、隔离 HOME 完整测试、记录 patch hash 与实时 schema 验收。不将用户配置、凭证、能力 local binding 或完整私有 Hermes 树加入仓库。
