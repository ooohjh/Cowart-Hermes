# 本地构建与 GitHub 发布

## 发布门禁
当前仅本地准备，未创建远程仓库、未 commit/push、未上传。**公开发布前必须确认适配代码作者与许可证、tldraw 使用/再分发边界、核心兼容获得方式。** 不把 adapter-only 描述成适用于普通新装 Hermes 的一键整合版。

```sh
python scripts/validate.py
python build-portable.py
python audit-portable.py
git status --short
git add --dry-run .
```

构建使用本仓 vendor 和许可，无网络、无 npm install，无旧 dist/cache 私有依赖。ZIP 使用固定时间、权限、排序与 ZIP_STORED，跨压缩库版本没有压缩差异。改变任意输入都会改变 manifest/ZIP SHA；先完成文档再做最终构建。构建两次比 SHA 验证重复性；manifest 必须验证全部路径、唯一性及解压后字节。

`release-assets/` 被 Git 忽略，只作为 Release 附件；不要 `git add -f`。源码仓库追踪 vendor，`.gitattributes` 禁止换行自动变换以保持 vendor 原字节。供应商原始依赖的可重编译性不在此承诺范围内。

## 人工确认之后才运行的发布命令
以下是说明，不是本次已执行操作。将 OWNER 替换为实际账号；VERSION 根据审核后的版本决定，不猜用户名。先登录 GitHub，检查提交清单不含私密信息。

```sh
git init -b main
git add .
git diff --cached --stat
git commit -m "Prepare Cowart-Hermes source distribution"
gh repo create OWNER/cowart --private --source .
git push -u origin main
gh release create VERSION release-assets/*.zip release-assets/SHA256SUMS.txt release-assets/AUDIT.json --repo OWNER/cowart --draft --title "Cowart-Hermes adapter-only" --notes "Requires compatible Hermes core; see README and licensing scope."
```

先私有仓库和 draft Release，许可证及兼容说明确认后再由维护者决定公开。CI 仅离线测试与打包，最小 contents:read，不自动发布、不使用 provider secrets。检查 GitHub 大文件限制和 vendored 资源是否适合源码追踪；不采用 LFS 指针替代必须随包存在的运行时。
