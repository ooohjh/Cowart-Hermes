# 能力数据与证据边界

## Historical evidence

model-capabilities.json 保留原维护树的 schema 6、alias/model、供应商公开 baseURL、操作、尺寸与状态。历史 evidence 指向本说明；原始探测 ledger、prompt、生成图和绝对路径均不分发。该整理没有新增供应商调用，也没有把 unknown 提升为 verified。

`verified` 表示维护环境中的历史观察，不是供应商 API 合同、跨账号/未来版本保证或本次复测结果。未公开原始付费证据，因此接收方不能仅凭本仓独立重演这些历史结论。generate 的证据不能继承到 edit，502 不能推断尺寸不支持。用户主动请求允许尝试 unknown 与 verified 状态相互独立。

发布来源：适配器版本 1.0.15；上游运行时来自已校验的原便携 ZIP（SHA256 c1bf49622ede41fc394e6176b3ea0e32d24cd5b428d1e809fcfa23b96ba39f97），其 vendor 与第三方许可字节保留。当前整理包因新增文档、确定性构建及匿名证据，SHA 不应与历史 ZIP 相同。
