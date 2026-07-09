# 仓库架构与概要

这份文档给第一次接触项目的人看。项目是 openEuler + 鲲鹏/昇腾开源项目支持看板，展示项目分类、支持版本、硬件型号、验证结果和维护者信息。

## 技术栈

- React：渲染页面。
- TypeScript：约束数据结构和组件参数。
- Vite：本地开发服务器和静态构建工具。
- Ant Design：表格、菜单、分页等 UI 组件。
- ECharts：总览页分类图。
- React Router：管理 `/overview`、`/software/kunpeng`、`/software/ascend` 等路由。
- Nginx：Docker 镜像中托管 Vite 构建后的静态产物。
- Node.js：容器内运行数据同步脚本和本地同步接口。

## 目录结构

```text
.
├── Dockerfile
├── nginx.conf
├── docker/
│   └── entrypoint.sh
├── scripts/
│   ├── sync-data.mjs          # 同步 CLI 薄入口
│   ├── sync-server.mjs        # 本地/容器内同步 HTTP 接口
│   └── sync/                  # 同步实现模块
├── src/
│   ├── app/
│   ├── layout/
│   ├── data/
│   │   └── templates/         # 字段模板，不参与页面数据加载
│   ├── domain/                # 前端数据模型、运行时数据 client、刷新 client
│   ├── pages/
│   │   ├── overview/
│   │   └── software/
│   │       └── columns/       # 软件列表表格列定义
│   └── styles/
└── README.md
```

## 数据模型

真实数据只存在于容器内运行时数据目录 `/project-data`。容器内同步脚本会分别从鲲鹏数据仓的 `KUNPENG_TESTS_PATH` 和昇腾数据仓的 `ASCEND_PROJECTS_PATH` 稀疏克隆数据，再生成页面需要的数据结构：

```text
/project-data/kunpeng/_index.md
/project-data/kunpeng/*.json
/project-data/ascend/_index.md
/project-data/ascend/*.json
/project-data/metadata.json
```

仓库内 `src/data/templates` 只保存字段格式参考，不会被页面读取。项目 JSON 不存 `id`，也不需要存页面用的中文 `type`；前端读取时按目录生成 `id` 并推断类型。

## 运行流程

页面启动流程：

```text
index.html
  -> src/main.tsx
    -> src/app/App.tsx
      -> ProjectProvider
        -> AppLayout
          -> OverviewPage / SoftwareListPage
```

数据读取流程：

```text
/runtime-data/{kunpeng,ascend}/_index.md + 项目 JSON
        |
        v
runtimeDataClient -> normalizeProject -> ProjectProvider -> 页面
```

如果 `/runtime-data` 不可用或为空，页面保持空列表并显示“等待同步”，不会展示模板假数据。

容器同步流程：

```text
docker/entrypoint.sh
  -> 清理旧同步锁
  -> 启动 scripts/sync-server.mjs
  -> 先执行一次 scripts/sync-data.mjs
  -> 成功后启动每日同步循环 scripts/sync-data.mjs --loop --delay-first
  -> 启动 nginx
```

远端同步流程：

```text
scripts/sync-data.mjs
  -> scripts/sync/sync-service.mjs
    -> 稀疏克隆 KUNPENG_REPO_URL 的 KUNPENG_TESTS_PATH，默认 tests
    -> 读取 tests/<软件名称>/results/*.json 生成鲲鹏运行时数据
    -> 稀疏克隆 ASCEND_REPO_URL 的 ASCEND_PROJECTS_PATH，默认 project
    -> 读取 project/<软件名称>/<软件名称>.json 生成昇腾运行时数据
    -> 如果昇腾 JSON 配置 script，则执行同步到本地临时目录中的同目录脚本并回读 JSON
    -> 生成 kunpeng/_index.md、ascend/_index.md 和项目 JSON
    -> 写 metadata.json(lastSyncedAt)
    -> 原子替换容器内 /project-data 下的数据
```

昇腾单项目刷新流程：

```text
POST /api/projects/ascend/<name>/all|project|ci/refresh
  -> all 刷新：拉取 project/<name> 并执行 script
  -> project 刷新：拉取 project/<name>，不执行 script，并尽量保留已有 ci/ciDate
  -> ci 刷新：不拉取远端仓库，使用容器本地缓存执行 script 并刷新 ci/ciDate
  -> 只更新 /project-data/ascend/<name>.json 和 ascend/_index.md
```

## 核心模块

### `src/domain/projectStore.tsx`

前端状态入口。它只负责保存项目列表、加载状态、刷新状态、上次刷新时间和 `useProjects()` 上下文。运行时数据读取和刷新接口调用分别下沉到 `runtimeDataClient.ts` 和 `refreshClient.ts`。

### `src/domain/runtimeDataClient.ts`

读取 `/runtime-data`，解析 `_index.md`，按顺序加载项目 JSON，并统一调用 `normalizeProject`。运行时数据不可用时返回空列表。

### `src/domain/refreshClient.ts`

封装页面手动刷新所需的 HTTP 接口，包括按领域刷新和昇腾单项目刷新。

### `src/pages/software/columns/*`

软件列表列定义按职责拆分：公共列、鲲鹏列、昇腾列、维护者列、刷新列。`projectTableColumns.tsx` 只负责组合列。

### `scripts/sync/*`

同步实现模块：

- `config.mjs`：环境变量和 CLI 参数。
- `utils.mjs`：文件、Git 稀疏克隆、目录替换等通用工具。
- `normalize-project.mjs`：远端项目 JSON 归一化。
- `kunpeng-source.mjs`：鲲鹏测试结果读取。
- `ascend-source.mjs`：昇腾项目 JSON 读取和项目缓存。
- `ascend-ci.mjs`：昇腾 CI 脚本执行和结果回写。
- `runtime-store.mjs`：写入 `/project-data`、维护 `_index.md` 和 `metadata.json`。
- `lock.mjs`：同步锁。
- `sync-service.mjs`：组合完整同步流程。

### `scripts/sync-server.mjs`

容器内同步接口，只监听 `127.0.0.1`。Nginx 把 `/api/data/*`、`/api/projects/*` 转发到它，本地开发时 Vite 也代理这些路径。

### `docker/entrypoint.sh`

容器入口。它负责初始化 `/project-data`、启动同步服务、先同步一次远端数据、启动每日同步循环，并最终启动 Nginx。

### `nginx.conf`

负责三类请求：

- `/runtime-data/`：读取容器内 `/project-data` 中的运行时 JSON，不缓存。
- `/api/data/` 和 `/api/projects/`：代理到容器内同步服务。
- 其他路径：托管静态资源和 React Router history fallback。

## 当前边界

- 页面不提供编辑数据能力。
- 数据刷新只负责拉取远端仓库 JSON 并替换容器内运行时数据。
- 如果远端仓库不可用或没有解析到项目，容器内旧运行时数据会保留；首次启动且没有旧数据时页面为空列表。容器删除后 `/project-data` 会随容器删除，下次启动重新同步。
