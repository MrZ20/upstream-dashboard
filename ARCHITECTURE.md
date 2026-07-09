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
│   ├── sync-data.mjs
│   └── sync-server.mjs
├── src/
│   ├── app/
│   ├── layout/
│   ├── data/
│   │   ├── kunpeng/
│   │   │   └── _index.md
│   │   ├── ascend/
│   │   │   └── _index.md
│   │   └── templates/
│   │       ├── kunpeng.template.json
│   │       └── ascend.template.json
│   ├── domain/
│   │   ├── projectTypes.ts
│   │   ├── projectStore.tsx
│   │   ├── projectNormalize.ts
│   │   ├── projectStats.ts
│   │   └── projectFormat.ts
│   ├── pages/
│   │   ├── overview/
│   │   └── software/
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

仓库内 `src/data` 不再保存真实项目数据，只保留：

- `src/data/kunpeng/_index.md`：空索引，用于构建期结构兜底。
- `src/data/ascend/_index.md`：空索引，用于构建期结构兜底。
- `src/data/templates/*.template.json`：字段格式参考，不会被页面读取。

项目 JSON 不存 `id`，也不需要存页面用的中文 `type`。前端读取时按目录生成 `id` 并推断类型。

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
        | 成功时使用运行时数据
        v
ProjectProvider -> normalizeProject -> 页面
        ^
        |
        | 失败或为空时回退
        |
src/data/{kunpeng,ascend}/_index.md 空索引，页面显示等待同步/空列表
```

容器同步流程：

```text
docker/entrypoint.sh
  -> 清理旧同步锁和旧版 bundled-seed 假数据
  -> 启动 scripts/sync-server.mjs
  -> 先执行一次 scripts/sync-data.mjs
  -> 成功后启动每日同步循环 scripts/sync-data.mjs --loop --delay-first
  -> 启动 nginx
```

远端同步流程：

```text
sync-data.mjs
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
  -> git sparse-checkout set project/<name>
  -> 读取 project/<name>/<name>.json
  -> all 刷新：拉取项目目录并执行 script
  -> project 刷新：拉取项目目录，不执行 script，并尽量保留已有 ci/ciDate
  -> ci 刷新：不拉取远端仓库，使用容器本地缓存执行 script 并刷新 ci/ciDate
  -> 只更新 /project-data/ascend/<name>.json 和 ascend/_index.md
```

## 核心文件

### `src/domain/projectStore.tsx`

前端数据入口。它负责：

- 使用 `import.meta.glob` 读取仓库内空索引，作为构建期兜底。
- 优先从 `/runtime-data` 读取运行时数据。
- 运行时数据不可用时回退为空列表，不展示模板假数据。
- 提供 `useProjects()`，包含项目列表、加载状态、刷新状态、上次刷新时间和手动刷新方法。

### `scripts/sync-data.mjs`

远端数据导入脚本。它不会逐个 JSON `curl`，而是分别稀疏克隆鲲鹏和昇腾数据仓需要的目录后，在本地遍历 JSON。昇腾项目如果配置了 `script`，脚本也随项目目录一起同步到本地临时目录，再由同步脚本执行。

### `scripts/sync-server.mjs`

容器内同步接口，只监听 `127.0.0.1`：

- `POST /api/data/kunpeng/refresh`：刷新鲲鹏数据。
- `POST /api/data/ascend/all/refresh`：刷新昇腾项目数据并运行 CI 脚本。
- `POST /api/data/ascend/project/refresh`：刷新昇腾项目数据，不运行 CI 脚本。
- `POST /api/data/ascend/ci/refresh`：使用本地项目缓存刷新昇腾 CI 结果。
- `POST /api/projects/ascend/<name>/all|project|ci/refresh`：按范围刷新单个昇腾项目。
- `POST /api/projects/ascend/<name>/ci/refresh`：刷新单个昇腾项目 CI 结果。
- `GET /api/data/status`：查看同步状态和 metadata。
- `GET /runtime-data/*`：本地开发时用于托管运行时数据，Docker 中主要由 Nginx 直接托管。

### `docker/entrypoint.sh`

容器入口。它负责初始化容器内 `/project-data` 数据目录、启动同步服务、先同步一次远端数据、启动每日同步循环，并最终启动 Nginx。

### `nginx.conf`

负责三类请求：

- `/runtime-data/`：读取容器内 `/project-data` 中的运行时 JSON，不缓存。
- `/api/data/`：代理到容器内同步服务。
- 其他路径：托管静态资源和 React Router history fallback。

## 当前边界

- 页面不提供编辑数据能力。
- 数据刷新只负责拉取远端仓库 JSON 并替换容器内运行时数据。
- 如果远端仓库不可用或没有解析到项目，容器内旧运行时数据会保留；首次启动且没有旧数据时页面为空列表。容器删除后 `/project-data` 会随容器删除，下次启动重新同步。
- 前端静态资源不需要因数据刷新重新构建；只有页面代码变化才需要重新构建镜像。

## 推荐阅读顺序

1. `src/domain/projectTypes.ts`
2. `src/domain/projectStore.tsx`
3. `src/domain/projectNormalize.ts`
4. `src/pages/software/SoftwareListPage.tsx`
5. `src/pages/software/ProjectTable.tsx`
6. `src/pages/software/projectTableColumns.tsx`
7. `src/pages/software/projectTableRenderers.tsx`
8. `src/pages/overview/OverviewPage.tsx`
9. `scripts/sync-data.mjs`
10. `Dockerfile`
11. `nginx.conf`
