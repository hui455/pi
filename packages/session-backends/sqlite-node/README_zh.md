# @earendil-works/pi-session-backend-sqlite-node

用于 `@earendil-works/pi-agent-core` 会话的 Node sqlite 会话后端。提供 `node:sqlite` 适配器（`SqliteDatabase` 实现）、SQLite 会话仓库、迁移、物化视图和可选的 FTS 搜索。

```ts
await using repository = new SqliteSessionRepository(options);
const search = createSqliteSessionSearch(options);
const session = await repository.create({ cwd });
await session.appendMessage(message);

const hits = [];
for await (const hit of search.search("needle")) hits.push(hit);
```

仓库惰性拥有一个共享的数据库连接。搜索是同一规范数据库之上的独立服务：仓库不暴露 `search()`。FTS 表和触发器在首次非空白搜索时惰性创建；当 FTS 首次创建时，搜索会从规范条目执行一次性的重建。此后，SQLite 触发器保持 FTS 与规范条目的插入、删除和负载更新同步。
