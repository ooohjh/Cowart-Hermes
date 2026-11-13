# 配置

首次安装读取下列环境变量，未指定时从当前目标环境发现，不继承开发机路径。

|变量|含义/默认|
|---|---|
|COWART_PYTHON|Hermes 使用的 Python，可显式指定|
|HERMES_SOURCE|发现 Hermes 源码的候选目录|
|HERMES_HOME|显式目标 profile；不指定则由 Hermes API 发现|
|COWART_PORT|43189；端口冲突拒绝，不杀进程|
|COWART_CANVAS|目标 home/cowart-data/canvas|
|COWART_IMAGE_OUTPUT|canvasDir/images|
|COWART_IMAGE_INPUT|imageOutputDir/input|

`config.example.json` 只是相对路径语义示例，**不要直接重命名为 config.json**：安装器还必须发现 Hermes、生成 instanceId 和绝对目标路径。安装后修改配置需停止本包服务并备份；不要手工修改 Hermes config.yaml。能力同步会写入目标 Hermes tools，因此核心目录必须可写。

可选存储示例：用户可自行把输出指定为 `E:/Hermes Image`、输入为 `E:/Hermes Image/input`；这不是安装默认。命名为 `cowart inputYYYY-MM-DDNN.ext` / `Hermes cowartYYYY-MM-DDNN.ext`，两套每日序号独立，从01开始，自然超过99。文件签名确定扩展名，已有文件不覆盖；不可写时明确报错。

供应商 alias 必须在目标 Hermes 自行配置，能力表中的 alias 不是随包可用账号。证据按模型/操作/尺寸分开；修改表后使用 `node sync-capabilities.mjs --target <Hermes源码>` 及 `--check`，不要手改镜像或提交 local binding。参考 [能力证据](CAPABILITIES.md)。
