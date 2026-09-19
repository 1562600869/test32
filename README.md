# 电影购票系统

Vue 3 + Vite 前端，Express + MySQL 后端。本文档重点说明选座下单的并发、状态机与失败语义。

## 快速开始

```bash
# 数据库
mysql -u root -p < database/init.sql
mysql -u root -p movie_ticket_system < database/migrations/002_order_lock_ttl.sql  # 已有库升级
cd backend && npm install && npm run seed && npm run dev   # 默认 :3000

# 前端
cd frontend && npm install
npm run build      # 产出 frontend/dist
npm run preview    # 本地预览构建产物（默认 :4173）
npm run dev        # 开发模式（:5173，/api 代理到 :3000）
npm test           # 前端自动化测试（node:test，无需额外依赖）
```

## 订单状态机

```
                创建订单（锁定座位，占用 order_seats，expires_at = now + TTL）
                │
                ▼
        ┌─── pending（已锁定）───┐
        │           │           │
   pay  │     TTL 到期│     用户取消│ cancel
        ▼           ▼           ▼
      paid      expired     cancelled
     （已支付）  （已过期）   （已取消）
```

- **锁定 TTL**：默认 15 分钟，可用环境变量 `ORDER_LOCK_TTL_MINUTES` 覆盖（见 `backend/src/config.js`）。创建订单时写入 `orders.expires_at`。
- **过期释放**：三条路径共同保证锁定不会永久占座——
  1. 定时任务每分钟清扫（`backend/src/scheduler/orderScheduler.js`）；
  2. **进程重启时立即清扫一次**（崩溃恢复：锁定后、支付前崩溃，重启后过期锁自动释放）；
  3. 惰性过期：读取座位图 / 支付时按 `expires_at` 即时判定，过期 pending 订单视为已过期。
- **终态保护**：`expired` / `cancelled` / `paid` 均为终态；`expire` 事件只作用于 `pending`，**已支付订单永远不会被当成未支付或被过期清扫**。
- **支付幂等**：对 `paid` 订单重复调用支付接口返回相同成功结果（`already_paid: true`），不会产生第二笔有效票；并发重复支付由 `SELECT ... FOR UPDATE` + 乐观版本号串行化。
- 前端同语义纯逻辑见 `frontend/src/utils/orderLock.js`（`transition` / `isLockExpired`），由 `frontend/tests/orderLock.test.js` 用假时钟覆盖。

## 冲突矩阵

同一场次同一座位的并发/异常场景（“锁定”= 存在未过期的 `reserved` 座位记录）：

| 场景 | 结果 | 语义 |
| --- | --- | --- |
| 两人同时点同一座位并提交 | 恰好一人 201，另一人 409 `SEAT_CONFLICT` | `order_seats` 唯一键 `(showtime_id, seat_id, status)` 保证最多一人锁定成功 |
| 锁定未过期，他人再选同座 | 后者 409 `SEAT_CONFLICT` | 响应含 `showtime_id` 与冲突座位坐标 `seats: [{row, col}]` |
| 锁定已过期，他人再选同座 | 后者 201 | 过期锁已被清扫/惰性判定释放 |
| 重复支付同一订单 | 都返回成功 | 幂等，仅一笔有效票（`already_paid` 标记） |
| 支付时已过期 | 409 `ORDER_STATE_CONFLICT`（status=expired） | 订单转入 `expired`，座位释放 |
| 管理端改影厅/删场次（有锁定或已售座位） | 409 `SHOWTIME_LAYOUT_LOCKED` | 响应含 `showtime_id`，布局不被覆盖 |
| 进程崩溃（锁定后支付前） | 重启后启动清扫释放过期锁 | 不会永久占座；已支付订单不受影响 |

后端错误统一为 `{ message, code, ...details }`（`backend/src/errors`），前端归一化为公开错误类型
`ApiError / NetworkError / TimeoutError / SeatConflictError / ConflictError`（`frontend/src/utils/errors.js`）。

## 离线 / 失败展示

- **后端不可达 / 超时**：`request.js` 归一化为 `NetworkError` / `TimeoutError`；选座页与支付页渲染带**重试**按钮的错误态，空数据渲染空态，禁止只打 console。视图状态解析见 `frontend/src/utils/uiState.js`。
- **409 占座冲突**：选座页顶部横幅显示含场次 ID 与座位坐标的诊断文案，冲突座位从已选移除，并立即重新拉取座位图回到服务端真实态（可选/已售），不会出现双方都显示“已选”或白屏。
- **支付结果不确定**（网络错误/超时）：自动按服务端订单状态重新查询；已支付则直接跳转，仍待支付则提示可重试，查询失败则要求用户点击“重新查询订单状态”，避免重复支付。
- **可访问性**：座位图 SVG 每个座位可 Tab 聚焦（`role="checkbox"`），Enter/Space 切换，`aria-label` 含行、列与状态（如“3排5座，已选”），已选数量通过 `aria-live="polite"` 播报。

## 跨标签页规则

已选座位状态**以服务端为准**：本地“已选”仅是未提交的意图。窗口重新聚焦时选座页自动刷新座位图，其他标签页（或其他用户）的锁定/出票会反映到本页；本地未提交的已选不会覆盖服务端状态，提交时若冲突按 409 流程处理。

## 测试

```bash
cd frontend && npm test
```

使用 Node 内置 `node:test`（无新增依赖），覆盖：并发占座冲突、TTL 释放（`mock.timers` 假时钟，无固定 sleep）、支付幂等、后端断开/超时/409 时的 UI 错误态。
