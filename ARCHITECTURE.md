# 仓库架构与概要

这份文档给第一次接触项目的人看。项目是一个在浏览器里运行的 openEuler + 鲲鹏/昇腾开源项目支持看板，展示项目分类、集成版本、硬件型号、验证结果和维护者信息。

## 技术栈

- React：渲染页面。
- TypeScript：约束数据结构和组件参数。
- Vite：本地开发服务器、构建工具，并提供开发期 JSON 写入 API。
- Ant Design：表格、表单、弹窗、菜单等 UI 组件。
- ECharts：总览页分类图。
- React Router：管理 `/overview`、`/software/kunpeng`、`/software/ascend`、`/admin/settings` 等路由。

## 数据在哪里

项目数据只有两份 JSON：

```text
src/data/kunpengProjects.json
src/data/ascendProjects.json
```

鲲鹏和昇腾分开存储，各自只保留自己页面和验证流程需要的字段。页面通过 `ProjectContext` 访问数据，`ProjectContext` 通过 Vite 本地 API 读写 JSON 文件。

管理员登录态仍保存在浏览器 `localStorage` 的 `dashboard_auth` 中；项目数据不再保存在项目数据 localStorage 中。

## 目录结构

```text
.
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── README.md
├── ARCHITECTURE.md
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types/
    │   └── index.ts
    ├── data/
    │   ├── kunpengProjects.json
    │   └── ascendProjects.json
    ├── contexts/
    │   ├── AuthContext.tsx
    │   └── ProjectContext.tsx
    ├── components/
    │   ├── Layout.tsx
    │   ├── AdminGate.tsx
    │   ├── ProjectFormModal.tsx
    │   ├── VersionFormModal.tsx
    │   ├── MaintainerModal.tsx
    │   └── MaintainerTag.tsx
    ├── pages/
    │   ├── Overview.tsx
    │   ├── SoftwareList.tsx
    │   └── AdminSettings.tsx
    └── styles/
        └── global.css
```

## 运行流程

```text
index.html
  -> src/main.tsx
    -> src/App.tsx
      -> AuthProvider
      -> ProjectProvider
      -> AppLayout
        -> Overview / SoftwareList / AdminSettings
```

数据流：

```text
src/data/*.json
        |
        v
Vite /api/projects
        |
        v
ProjectContext
        |
        v
页面通过 useProjects() 读取 projects
        |
        v
管理员新增/编辑/删除
        |
        v
Vite API 写回对应 JSON 文件
```

## 核心文件

### `vite.config.ts`

除了 Vite 基础配置外，还注册了 `projects-json-api` 插件。它负责读取和写入 `src/data` 下的两个 JSON 文件。

本地开发 API：

- `GET /api/projects`：合并返回鲲鹏和昇腾项目。
- `GET /api/projects/:domain`：读取单类项目，`:domain` 为 `kunpeng` 或 `ascend`。
- `POST /api/projects/:domain`：新增项目并写入对应 JSON。
- `PUT /api/projects/:domain/:id`：更新项目，必要时在两个 JSON 间移动。
- `DELETE /api/projects/:domain/:id`：删除项目。

### `src/contexts/ProjectContext.tsx`

项目数据的前端入口。它负责：

- 加载 `/api/projects`。
- 将后端返回的项目列表放进 React 状态。
- 提供 `dispatch` 给页面执行新增、编辑、删除、维护者设置、版本维护。
- 在每次写入后重新加载数据。

### `src/types/index.ts`

定义 `Project`、`VersionInfo`、`Maintainer` 等核心类型。

### `src/pages/SoftwareList.tsx`

同时服务鲲鹏和昇腾软件列表。功能包括搜索、筛选、列显示控制、展开历史版本、项目名称列拖拽调宽、维护者复制、管理员操作列。

### `src/pages/AdminSettings.tsx`

管理员 JSON 添加页。输入 JSON 后先生成预览，再保存到对应数据文件。

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

### 管理员设置

路径：`/admin/settings`

只有进入管理员模式后才能看到。它用于通过 JSON 添加软件信息，并直接写入 `src/data` 下的对应文件。

## 当前限制

- Vite 中的写 JSON API 主要面向本地开发和内部调试，不是生产后端。
- 管理员密码写在前端代码中，不是安全权限系统。
- 目前没有自动化测试目录，修改共享数据结构后需要至少运行 `npm run build` 或 `npx tsc --noEmit`。

## 关键决策

1. 数据拆成 `kunpengProjects.json` 与 `ascendProjects.json`，两类项目不再共享无关字段。
2. 页面读写统一走 `/api/projects`，不再使用旧的 `projectData.ts` 或项目数据 localStorage。
3. 功能验证只有通过/不通过，未填用 `null` 表示。
4. 性能验证只有提升/持平/回退。
5. 总览统计只看每个项目的最新支持版本，也就是 `versions[0]`。
6. 管理员模式仍然是前端本地开关，真正权限控制需要后端接入后再补。

## 推荐阅读顺序

1. `src/types/index.ts`
2. `src/contexts/ProjectContext.tsx`
3. `vite.config.ts`
4. `src/pages/SoftwareList.tsx`
5. `src/pages/Overview.tsx`
6. `src/pages/AdminSettings.tsx`
