# 安全与隐私

不要公开提交凭证、.env、config.json、bridge-token.txt、生成 plugin.js、local binding、画布、图片、日志、探测 ledger 或用户截图。安装目录不是可分享源码目录。

桥仅监听回环并验证 Host/Origin/token；禁止反向代理到公网。安全边界是当前操作系统用户，持有本机文件读取权限的程序可能读取 token；这不是恶意本机代码沙箱。上游统计、嵌入和 AI 服务可能访问网络。

请不要在公开 issue 附敏感内容。仓库尚未指定私有安全报告邮箱/入口；公开仓库前维护者应设置 GitHub private vulnerability reporting。紧急情况先停用本包，保留必要脱敏证据，并经已确认的私密渠道联系维护者。

`audit-portable.py` 是启发式检查与完整 manifest 校验，不代表绝无秘密或全面安全认证。提交前仍需人工审查。付费测试必须有明确预算授权，本仓测试不会调用供应商。
