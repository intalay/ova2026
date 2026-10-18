# Results 每日接入骨架：集成说明

## 当前交付与事实边界

独立源码基线来自 `ova2026-sync-verification/remote-final/source`，其本地核验清单对应 main `f165c455c8bbaf03c27be52b39ae61e7d7a5eed7`。没有操作浏览器、远程 Git、线上表、RLS、cron 或凭证。受保护的 Results route、results-query、queries 和首页文件没有改动。

历史成绩已经由唯一集成进程完成导入，这不能证明自动同步运行过。当前挂载必须使用 `automaticUpdates="disabled"`、`syncState={null}`。组件显示 **Historical results / Automatic updates not enabled / Last successful sync: Not recorded**。不使用页面加载时间、导入时间或比赛日期替代成功同步时间。

## 首版最小挂载

由唯一集成进程修改 `src/routes/results.tsx`。新增 import：

```tsx
import { ResultsUpdateStatus } from "@/components/ResultsUpdateStatus";
```

在 `Browse results` 的 `Section` 后、统计模块前添加：

```tsx
<ResultsUpdateStatus
  eventId={selection.eventId || null}
  dataMode={selection.dataMode}
  automaticUpdates="disabled"
  syncState={null}
/>
```

这一步不依赖新表或新的服务调用，未知数量显示 `Not confirmed`，未知比赛日期沿用 `Date to be determined`。All events 没有任意赛事的默认官方链接，提示选择赛事。Synthetic 模式明确标为演示数据，并隐藏真实赛事入口。

组件复用 `AppShell.Card`、`module-heading`、当前 Montserrat/UNSII 字体与 primary/card/muted/destructive 色彩、圆角和移动端卡片层。没有全局 CSS、字体、身份或导航变更。三项事实在手机单列、sm 以上三列；官方入口有 44px 点击区、键盘焦点与新标签说明。未进行浏览器视觉验收，遵守本进程禁止浏览器操作的约束。

## 可选：展示已记录成绩数量和最近比赛日期

必须从**完整的当前赛事及 data_mode 数据**计算，不能使用当前六行分页或把团队的部分历史冒充整场赛事总数。现有 `competitionQuery` 已按完整分页读取公开比赛；若该查询在集成处可用且成功，可使用：

```tsx
import { summarizeRecordedResults } from "@/lib/result-sync/normalize";

const updateSummary =
  competition.isSuccess && selection.eventId && selection.dataMode !== "all"
    ? summarizeRecordedResults(competition.data.matches, selection.eventId, selection.dataMode)
    : null;

// 给上面的 ResultsUpdateStatus 增加 summary={updateSummary}。
```

`competition` 是调用方现有/新增的 `useQuery(competitionQuery)` 结果变量，示例不是已挂载的代码。卡片事实描述整场所选赛事，不跟随 team/date 的局部结果。没有完整成功读取时省略 summary。`source_date` 仅表达比赛日期，`starts_at: null` 不会被补成虚假开赛时间。

## 逐赛事官方入口

`sources.ts` 中的两个准确映射来自本地导入包：

- TIMU `event_57082766dc86cb3d705e2c4eebe9599c` → `tid=3960`。
- AES `event_070bb34b268b3e11e73be5e4c6444b77` → 本地包内该赛事的 AES event URL。没有把用户给出的另一条 AES division 示例硬套给它。

当前 AES 多个 division 属于同一 event，使用该 event 官方入口。MyTeam 没有被冒充为 TIMU/AES，暂不在本接入范围。新赛事需在目录新增准确映射，或由调用方传入经过人工核对的 `source`，仍会检查 eventId、dataMode、https、精确 hostname/path、上游 eventId，并拒绝账号密码、非默认端口、hash、重定向参数及多余查询参数。此验证只保护**展示链接**，不代表具有抓取许可，也不是通用 SSRF 网络防护；本实现根本没有 URL fetch。

## 接入接口与关闭方式

`runDailyResultSync({ sourceKey })` 默认返回 `{ status: "not_configured", reason: "disabled" }`。即使显式 `enabled: true`，内置 TIMU/AES adapter 仍返回 job outcome `not_configured / adapter_missing`，不会发出网络请求。不配置持久化 store 返回 `storage_missing`。没有注册 HTTP endpoint、定时任务或启用开关。

adapter 接口只接收已绑定赛事和 Toronto 运行日期，由特定 provider 的服务端实现负责已获准的传输、协议、分页和 ID 映射。结果返回 `{ complete: true, records, officialUpdatedAt: null | ISO }`。填一个 API 地址不等于实现未知协议；本接口没有任意 URL 或全局密钥输入。源未明确提供更新时间时 `officialUpdatedAt` 必须为 null。

归一化格式严格复用 `Match` 字段：现有稳定 `id/event_id/division_id/team_*_id`，`source_date`、nullable `starts_at`、`score_a/score_b`（赢的局数）、nullable `sets[{a,b}]`、`data_mode`，以及 venue/court。adapter 必须通过现有导入映射解析 ID，不能用队名/日期重新造 ID。已完成比赛必须有不同的非空双方比分；未完成使用 `status: "scheduled"` 和 null 比分/sets，拒绝占位 0–0。缺失逐局分数保持 null。重复相同 ID/内容去重，冲突或部分读取整批失败；不跨赛事或 real/synthetic 写入。

## 状态与持久化提案（未部署）

`model.ts` 的 `ResultSyncStore` 要求：

1. `acquire` 在 source/event/data_mode 范围内原子获得运行租约；同日成功去重、并发运行跳过、失败允许重试。日期按 America/Toronto。
2. `commit` 在一个事务内校验现有比赛身份并按稳定 ID upsert、记录成功状态和 run 日志；不删除源本次未返回的旧记录，不把 final 降为 pending。记录中 received 为去重后的行数。
3. `fail` 追加安全失败码并保留完整 lastSuccess 与旧成绩。记录失败本身无法落盘时返回 `persisted: false`，绝不假装成功。

未来 schema 可使用 `result_sync_sources`（主键 source_key，event_id/data_mode/provider/enabled=false）、`result_sync_runs`（run_id、scope、run_date、status、started/finished、received/changed/unchanged、failure_code）和 `result_sync_state`（scope 唯一、last_run_id、last_success_at、official_updated_at、completed_results、latest_match_date、lease/fencing token）。需要独立设计原子运行锁、每日成功唯一约束、重试、进程崩溃后的 lease 恢复及受限公共状态投影。**本次没有 migration SQL，也没有改变权限/RLS。**

`in-memory-store.server.ts` 只用于本地测试：验证基本原子行为、去重及失败保留，没有多进程持久性或崩溃恢复能力，不能接生产 job。默认入口不会选择该 store。生产 store 还必须把既有导入行和 source/上游 ID 映射纳入身份核验。

## 真实每日接入仍缺什么

- 确认 TIMU/AES 允许的访问方式、条款及授权；有正式 API 优先使用其文档。不得绕过反爬。
- 实现各自 adapter，包括协议解析、完整分页/空结果核验、稳定 ID 映射、超时、限流和脱敏错误；用官方样本做回归。
- 实现并审查数据库事务、状态持久化和运行锁；确认可读状态的权限边界。当前数据表没有能证明自动同步成功的事实。
- 完成以上后才由授权集成进程配置每日一次调度并启用。当前不承诺实时、不启用每十分钟抓取，也不发送通知。

## 验证

新增测试覆盖默认关闭/未配置、上游失败保留成功事实、并发与同日重入、跨日相同 ID、纠正比分、整批回滚、pending 排除统计、安全事件链接、历史/失败/未知/演示 UI。具体命令及最终结果见交付目录 `verification-report.txt`。
