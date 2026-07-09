# 仓库架构与概要

这份文档给第一次接触项目的人看。项目是一个静态 openEuler + 鲲鹏/昇腾开源项目支持看板，展示项目分类、集成版本、硬件型号、验证结果和维护者信息。

## 技术栈

- React：渲染页面。
- TypeScript：约束数据结构和组件参数。
- Vite：本地开发服务器和静态构建工具。
- Ant Design：表格、菜单、分页等 UI 组件。
- ECharts：总览页分类图。
- React Router：管理 `/overview`、`/software/kunpeng`、`/software/ascend` 等路由。
- Nginx：Docker 镜像中托管 Vite 构建后的静态产物。

## 数据在哪里

项目数据按类型和项目拆分为多个 JSON：

```text
src/data/kunpeng/_index.md
src/data/kunpeng/<项目名称>.json
src/data/ascend/_index.md
src/data/ascend/<项目名称>.json
```

鲲鹏和昇腾分开存储，各自只保留自己页面和验证流程需要的字段。`_index.md` 决定展示顺序。页面通过 `projectStore` 访问数据，`projectStore` 在 Vite 构建时用 `import.meta.glob` 合并这些项目 JSON。

运行时不提供写入 API、管理员模式或页面内编辑能力。数据变更通过修改 JSON 文件并重新构建镜像完成。

## 目录结构

```text
.
├── Dockerfile
├── nginx.conf
├── .dockerignore
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── README.md
├── ARCHITECTURE.md
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx
    │   └── theme.ts
    ├── layout/
    │   └── AppLayout.tsx
    ├── data/
    │   ├── kunpeng/
    │   │   ├── _index.md
    │   │   └── <项目名称>.json
    │   └── ascend/
    │       ├── _index.md
    │       └── <项目名称>.json
    ├── domain/
    │   ├── projectTypes.ts
    │   ├── projectStore.ts
    │   ├── projectNormalize.ts
    │   ├── projectStats.ts
    │   └── projectFormat.ts
    ├── pages/
    │   ├── overview/
    │   │   └── OverviewPage.tsx
    │   └── software/
    │       ├── SoftwareListPage.tsx
    │       ├── ProjectTable.tsx
    │       ├── projectTableColumns.tsx
    │       ├── projectTableRenderers.tsx
    │       ├── MaintainerTag.tsx
    │       └── tableRows.ts
    └── styles/
        ├── global.css
        ├── layout.css
        ├── table.css
        └── overview.css
```

## 运行流程

```text
index.html
  -> src/main.tsx
    -> src/app/App.tsx
      -> AppLayout
        -> OverviewPage / SoftwareListPage
```

数据流：

```text
src/data/{kunpeng,ascend}/_index.md + 项目 JSON
        |
        v
projectStore 构建时按 _index.md 顺序合并，projectNormalize 规范化字段
        |
        v
页面通过 useProjects() 读取 projects
        |
        v
Vite build 生成 dist 静态产物
        |
        v
Docker 镜像用 Nginx 托管 dist
```

## 核心文件

### `Dockerfile`

使用多阶段构建：第一阶段用 Node.js 安装依赖并执行 `npm run build`，第二阶段用 Nginx 托管 `dist/`。镜像默认监听 `8080`。

### `nginx.conf`

负责静态资源缓存和 React Router history fallback。访问 `/overview` 或 `/software/kunpeng` 这类前端路由时，Nginx 会回退到 `index.html`。

### `vite.config.ts`

只保留 Vite + React 基础配置。`VITE_BASE_PATH` 可在构建镜像时指定，用于子路径部署。

### `src/domain/projectStore.ts`

项目数据的前端入口。它负责：

- 使用 `import.meta.glob` 在构建时读取项目 JSON。
- 按 `_index.md` 顺序合并数据，并为项目生成运行时 `id`。
- 调用 `projectNormalize.ts` 对页面所需字段做轻量规范化。
- 提供 `useProjects()` 给总览和列表页面读取数据。

### `src/domain/projectTypes.ts`

定义 `Project`、`VersionInfo`、`Maintainer`、`SummaryStats` 等核心类型。

### `src/pages/software/SoftwareListPage.tsx`

同时服务鲲鹏和昇腾软件列表。功能包括搜索、展开历史版本、项目名称列拖拽调宽和维护者复制。

### `src/pages/software/ProjectTable.tsx`

软件列表表格入口，只负责表格状态、展开状态、列宽拖拽和 Ant Design Table 装配。列定义放在 `projectTableColumns.tsx`，单元格渲染函数放在 `projectTableRenderers.tsx`。

## 页面说明

### 总览看板

路径：`/overview`

- 左侧展示鲲鹏项目统计。
- 右侧展示昇腾项目统计。
- 下方展示两类项目的分类图。
- 待关注项展示功能失败、性能回退和 CI 不通过。

### 软件列表

路径：

```text
/software/kunpeng
/software/ascend
```

鲲鹏关注上游版本、openEuler 版本、功能验证和性能验证；昇腾关注看护分支、硬件型号和 CI 验证结果。

## 当前限制

- 页面是静态站，运行时不能新增、编辑或删除数据。
- 数据变更需要通过代码提交修改 JSON 文件，再重新构建镜像。
- 目前没有自动化测试目录，修改共享数据结构后需要至少运行 `npm run build` 或 `npx tsc --noEmit`。

## 关键决策

1. 数据拆成 `src/data/kunpeng/` 与 `src/data/ascend/` 下的多项目 JSON，两类项目不再共享无关字段。
2. 页面只在构建时静态合并 JSON 数据，不再使用本地 API、generated JSON 文件或 localStorage 保存项目数据。
3. 功能验证只有通过/不通过，未填用 `null` 表示。
4. 性能验证只有提升/持平/回退。
5. 总览统计只看每个项目的最新支持版本，也就是 `supportedVersions[0]`。
6. 部署产物以 Docker 镜像为准，远端通过拉取镜像运行。

## 推荐阅读顺序

1. `src/domain/projectTypes.ts`
2. `src/domain/projectStore.ts`
3. `src/domain/projectNormalize.ts`
4. `src/pages/software/SoftwareListPage.tsx`
5. `src/pages/software/ProjectTable.tsx`
6. `src/pages/software/projectTableColumns.tsx`
7. `src/pages/software/projectTableRenderers.tsx`
8. `src/pages/overview/OverviewPage.tsx`
9. `Dockerfile`
10. `nginx.conf`
