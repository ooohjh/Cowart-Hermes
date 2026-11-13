# Cowart-Hermes

把 Cowart 画布接入 Hermes Desktop 与当前会话图像工具的 Windows 适配器。包含可维护的适配源码、预构建 Cowart MCP/widget、离线测试、确定性打包工具。

> **发布状态：adapter-only，核心兼容及适配代码许可待确认。** 普通新装 Hermes 不保证可用，安装器会拒绝不兼容核心。本仓不包含 Hermes 核心补丁，也不是一键升级整个 Hermes 的安装器。发布到公网前须完成 [发布门禁](docs/PUBLISHING.md)。

## 功能
- Desktop 双面板与选区驱动创建卡；空白取消选择/Escape 隐藏，不丢失草稿；仅抑制上游图片生成表单。
- 显式 alias/model/size 与有序参考图；文本模式不附带参考图。
- 冻结任务、requestHash、session、原子 claim → complete/fail；重复回调幂等，不自动重试收费请求。自动闭环依赖兼容 Hermes 核心。
- 用户主动请求与代理自行发起请求区分；unknown 是未知证据，不等于验证通过。
- 本地输入/输出统一命名、签名识别扩展名、SHA256 校验与受限资产映射；不移动历史图片。

## 快速开始
1. Windows 10/11、Node.js ≥22、可用 Hermes Desktop，以及通过 `core-preflight.py` 的兼容 Hermes Python 环境。
2. 阅读 [中文安装指南](INSTALL.zh-CN.md)、[核心要求](core-integration/README.md) 和 [许可边界](LICENSE)。不运行 npm install，不安装上游/tldraw 依赖。
3. 将发布 ZIP 完整解压到固定可写目录；运行 `install.cmd`，通过后运行 `start.cmd`。
4. Hermes Desktop 执行 Reload desktop plugins；已有会话 `/reload-mcp`。核心更新则需要从会话外完整重启 gateway。
5. 打开 Cowart，选择图片或 AI holder，设置模式/模型/尺寸，提交到当前 Hermes 会话；观察任务成功或失败，不要通过重复点击进行付费诊断。

配置图像供应商及凭证是目标用户责任，包中没有密钥。离线安装不代表离线生图。

## 源码开发与离线验证
```sh
python scripts/validate.py
python build-portable.py
python audit-portable.py
```
不下载依赖、不调用供应商、不注册 MCP、不修改活动 Hermes 配置。验证创建隔离 HOME/HERMES_HOME 和临时目录；完整结果在被 Git 忽略的 `release-assets/`。

## 目录
```text
*.mjs / widget-bridge.js / plugin.template.js  适配源码
portable.mjs / install.cmd                    目标机安装与生命周期
core-preflight.py / core-integration/         核心兼容检测和接口说明
model-capabilities.json                      匿名历史能力观察
vendor/cowart/                               原始预构建上游及源码/许可
THIRD-PARTY-LICENSES/                         锁定依赖许可副本
scripts/ tests/                              本地零付费测试
build-portable.py / audit-portable.py         离线确定性构建与审计
docs/                                        架构、配置、发布与维护
release-assets/                              ZIP、校验和、验证报告（不提交）
```

## 升级、卸载与限制
先停止服务并备份数据，卸载旧注册，再在新目录安装；不覆盖旧目录，不复制 token/plugin.js。卸载保留画布与图片，详见安装指南。未提供隐私画布截图，也不把示意图冒充运行截图。macOS/Linux、另一台物理机、付费生成全链路没有在本次发布整理中验证。上游统计与外部嵌入可能联网。

[架构](docs/ARCHITECTURE.md) · [配置](docs/CONFIGURATION.md) · [贡献](CONTRIBUTING.md) · [安全](SECURITY.md) · [发布](docs/PUBLISHING.md)
