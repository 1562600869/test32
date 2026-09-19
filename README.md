# 电影购票系统

Vue 3 + Vite 前端，Express + MySQL 后端。本 README 重点说明选座下单的
并发锁定、订单状态机、失败展示与本地运行方式。

## 本地运行

```bash
# 后端（需要本地 MySQL，先执行 database/init.sql；已有库再执行 database/migrations/001_seat_lock_ttl.sql）
cd backend && npm install && npm run dev        # 默认 3000 端口

# 前端
cd frontend && npm install
npm run dev        # 开发服务器 5173，/api 代理到 3000
npm run build      # 产出 frontend/dist
npm run preview    # 本地预览构建产物
npm test           # 自动化测试（node --test，无需额外依赖）
```

Docker 不是运行前提；`docker-compose.yml` 仅为可选部署方式。

## 座位锁与 TTL

- 点击「确认选座」即创建 `pending` 订单并锁定座位，锁 TTL 为 **15 分钟**
  （`orders.expires_at = 创建时间 + 15 分钟`，后端常量 `LOCK_TTL_MINUTES`）。
- 并发语义由数据库唯一索引保证：`order_seats` 的生成列唯一索引
  `unique_active_showtime_seat (showtime_id, seat_id, active_flag)` 确保
  同一场次同一座位最多存在一条有效（`reserved`/`sold`）记录。
  两人同时锁定同一座位时，最多一人成功；失败方收到 **409 SEAT_CONFLICT**，
  响应包含 `showtime_id` 与 `conflict_seats`（座位行列坐标）。
- TTL 到期后由后端定时任务（每分钟，且**服务启动时立即执行一次**）把
  过期 `pending` 订单置为 `expired` 并释放座位。进程在「锁定后、支付前」
  崩溃时，重启后第一轮扫描即释放过期锁，座位不会被永久占死；
  已支付（`paid`）订单不参与过期扫描，不会被当成未支付。

## 订单状态机

```
pending(锁定中) --支付成功--> paid(已支付)
pending(锁定中) --到达 expires_at--> expired(已过期，座位释放)
pending(锁定中) --用户取消--> cancelled(已取消)
paid --退票/退款--> refunded(已退款)
```

- `paid` / `expired` / `cancelled` / `refunded` 均为终态，不可再支付。
- **支付幂等**：重复调用支付接口，订单已是 `paid` 时返回 200 +
  `already_paid: true`（不生成第二笔有效票）；状态翻转使用
  `UPDATE ... WHERE status='pending'` 条件更新保证原子性。
  前端另有 in-flight 去重：支付请求未返回前重复点击共享同一 Promise。

## 冲突矩阵

| 场景 | 服务端结果 | 前端表现 |
| --- | --- | --- |
| 两人同时锁同一座位 | 一人 201，另一人 409 `SEAT_CONFLICT`（含场次 ID + 坐标） | 失败方看到内联错误条，冲突座位立即置灰、移出已选，并以服务端数据静默刷新座位图 |
| 锁定后 TTL 到期 | 订单置 `expired`，座位释放 | 支付页倒计时归零显示「订单已过期」，订单列表归入「已过期」 |
| 重复点击支付 | 仅一次生效；后续返回 `already_paid` | 按钮处理中禁用 + in-flight 去重，直接跳转订单详情 |
| 支付已过期订单 | 400 `ORDER_EXPIRED` | 支付页显示过期提示，不再允许支付 |
| 后端不可达 / 超时 | 网络错误 / `TIMEOUT` | 选座页、支付页显示错误态卡片 + 「重试」按钮，不白屏 |
| 管理端更换有锁定/已售座位的场次影厅 | 409 `SHOWTIME_SEATS_HELD`（含 `showtime_id`） | 管理端弹窗提示含场次 ID 的错误 |
| 管理端删除有锁定/已售座位的场次 | 409 `SHOWTIME_SEATS_HELD`（含 `showtime_id`） | 同上 |

## 离线 / 失败展示约定

- 所有 API 错误经 `frontend/src/utils/apiErrors.js` 分类为
  `network` / `timeout` / `conflict` / `expired` / `server` / `unknown`，
  页面据此渲染错误态（含是否可重试），禁止只在控制台报错。
- 选座页区分：加载中 / 加载失败（可重试）/ 空座位数据 / 正常座位图。
- 选座 SVG 支持键盘操作（Tab 聚焦、Enter/Space 选择），每个座位带
  `aria-label`（行、列、可选/已选/已售/VIP），另有 `aria-live` 区域播报已选数量。

## 跨标签页规则

**以服务端为准**。同一账号在多个标签页打开时，座位锁定状态以服务端为准：
标签页重新可见（`visibilitychange`）时选座页静默刷新座位图；
本地已选座位仅是未提交的草稿，提交时若与服务端冲突，按 409 冲突流程处理
（本地不让任何标签页的状态覆盖服务端）。

## 自动化测试

`cd frontend && npm test`（Node 内置 `node --test`，不引入新依赖）：

- `tests/seat-conflict.test.js`：冲突占座后座位图状态回正、409 文案含场次 ID 与坐标
- `tests/order-ttl.test.js`：TTL 到期释放、已支付订单不受过期扫描影响（假时钟 `mock.timers`）
- `tests/payment-idempotency.test.js`：并发重复支付只发一次请求、`already_paid` 幂等成功
- `tests/offline-ui.test.js`：断网 / 超时 / 409 / 5xx 到 UI 错误态的映射

测试全部使用注入时钟 / 事件驱动（deferred Promise），无固定 sleep。

## 数据库迁移

- 全新部署：执行 `database/init.sql`。
- 已有数据库：追加执行 `database/migrations/001_seat_lock_ttl.sql`
  （新增 `orders.expires_at`、`expired` 状态、座位唯一索引改造）。
