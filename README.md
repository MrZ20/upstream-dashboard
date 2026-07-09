# upstream-dashboard

`upstream-dashboard` 是一个静态开源项目支持看板，用于展示 openEuler 生态中鲲鹏/昇腾相关开源项目的分类、版本、硬件型号、验证结果和维护者信息。

项目基于 React + TypeScript + Vite + Ant Design + ECharts 构建。页面在构建阶段读取 `src/data` 下的 JSON 数据，运行时只负责展示，不提供新增、编辑、删除、管理员登录或数据写回能力。

## 目录

- [功能范围](#功能范围)
- [环境要求](#环境要求)
- [本地运行](#本地运行)
- [数据维护](#数据维护)
- [构建与预览](#构建与预览)
- [Docker 部署](#docker-部署)
- [常用页面](#常用页面)
- [开发校验](#开发校验)

## 功能范围

当前项目是纯静态前端应用：

- 总览看板：展示鲲鹏/昇腾项目数量、通过率、分类分布和待关注项。
- 软件列表：展示项目名称、分类、版本、硬件型号、验证状态和维护者信息。
- 数据来源：构建时读取仓库内 JSON 文件。
- 数据更新：通过修改 JSON 文件并重新构建完成。
- 部署方式：构建 Docker 镜像，远端拉取镜像运行。

## 环境要求

本地开发需要：

- Node.js 18 或更高版本
- npm

容器部署需要：

- Docker 或兼容 OCI 镜像的构建/运行环境

## 本地运行

克隆项目并进入目录：

```bash
git clone <your-repo-url>
cd upstream-dashboard
```

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

## 数据维护

项目数据按领域拆分存放，每个软件一个 JSON 文件：

```text
src/data/kunpeng/_index.md
src/data/kunpeng/<项目名称>.json
src/data/ascend/_index.md
src/data/ascend/<项目名称>.json
```

`_index.md` 控制页面展示顺序。项目 JSON 不需要填写 `id` 和 `type`：`id` 会在构建时按顺序生成，`type` 会由所在目录自动推断。

### 新增软件

1. 判断软件属于鲲鹏还是昇腾。
2. 在对应目录新增 `<项目名称>.json`，文件名建议和 `name` 保持一致。
3. 按对应领域的 JSON 模板填写软件信息。
4. 在对应 `_index.md` 中添加 `- <项目名称>.json`，放到希望展示的位置。
5. 运行 `npm run build`，确认 JSON 格式和页面构建正常。

### 修改或删除软件

- 修改软件：直接编辑对应项目 JSON。
- 删除软件：删除对应项目 JSON，并从 `_index.md` 删除对应行。
- 调整顺序：只调整 `_index.md` 中的文件顺序。
- 修改完成后：运行 `npm run build` 进行校验。

### 通用字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 项目名称。 |
| `category` | 是 | 项目分类。 |
| `upstream` | 否 | 上游仓库或主页地址。 |
| `maintainer` | 否 | 维护者信息，包含 `name` 和 `email`。 |
| `supportedVersions` | 是 | 支持版本列表。 |

### 鲲鹏字段

鲲鹏项目通常包含上游最新版本、openEuler 版本、功能验证和性能验证信息。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `latestVersion` | 否 | 上游最新版本。 |
| `supportedVersions[].version` | 是 | 支持版本号。 |
| `supportedVersions[].openEuler` | 否 | openEuler 版本，多个值用英文分号 `;` 分隔。 |
| `supportedVersions[].hardware` | 是 | 硬件型号，多个值用英文分号 `;` 分隔。 |
| `supportedVersions[].functional` | 否 | 功能验证结果：`pass`、`fail` 或 `null`。 |
| `supportedVersions[].functionalDate` | 否 | 功能验证日期。 |
| `supportedVersions[].performance` | 否 | 性能验证结果：`improvement`、`stable`、`regression` 或 `null`。 |
| `supportedVersions[].performanceDate` | 否 | 性能验证日期。 |
| `supportedVersions[].integratedDate` | 是 | 集成日期。 |

鲲鹏 JSON 示例：

```json
{
  "name": "ExampleLib",
  "category": "基础库&加速库",
  "upstream": "https://github.com/example/example-lib",
  "latestVersion": "1.2.3",
  "maintainer": {
    "name": "zhangsan",
    "email": "zhangsan@example.com"
  },
  "supportedVersions": [
    {
      "version": "1.0.0",
      "openEuler": "openEuler 24.03 LTS; openEuler 22.03 LTS SP3",
      "hardware": "Kunpeng 930; Kunpeng 920B",
      "functional": "pass",
      "functionalDate": "2026-07-06",
      "performance": "stable",
      "performanceDate": "2026-07-06",
      "integratedDate": "2026-07-06"
    }
  ]
}
```

### 昇腾字段

昇腾项目通常包含看护分支、硬件型号和 CI 验证信息。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `branch` | 否 | 看护分支，未填写时页面默认显示 `main`。 |
| `supportedVersions[].version` | 是 | 支持版本号。 |
| `supportedVersions[].hardware` | 是 | 硬件型号，多个值用英文分号 `;` 分隔。 |
| `supportedVersions[].ci` | 否 | CI 验证结果：`pass`、`fail` 或 `null`。 |
| `supportedVersions[].ciDate` | 否 | CI 验证日期。 |
| `supportedVersions[].integratedDate` | 是 | 集成日期。 |

昇腾 JSON 示例：

```json
{
  "name": "ExampleModel",
  "category": "训练加速",
  "upstream": "https://github.com/example/example-model",
  "branch": "main",
  "maintainer": {
    "name": "lisi",
    "email": "lisi@example.com"
  },
  "supportedVersions": [
    {
      "version": "1.0.0",
      "hardware": "Ascend 910B; Ascend 910C",
      "ci": "pass",
      "ciDate": "2026-07-06",
      "integratedDate": "2026-07-06"
    }
  ]
}
```

## 构建与预览

执行生产构建：

```bash
npm run build
```

构建产物会生成到：

```text
dist/
```

本地预览生产构建：

```bash
npm run preview
```

## Docker 部署

项目使用一个多阶段 `Dockerfile` 完成构建和运行：

1. Node.js 阶段安装依赖并执行 `npm run build`。
2. Nginx 阶段托管 `dist/` 静态产物。

构建镜像：

```bash
docker build -t upstream-dashboard:latest .
```

如果站点部署在子路径，可以通过 `VITE_BASE_PATH` 指定前端资源基础路径：

```bash
docker build --build-arg VITE_BASE_PATH=/upstream-dashboard/ -t upstream-dashboard:latest .
```

本地运行容器：

```bash
docker run --rm -p 8080:8080 upstream-dashboard:latest
```

访问地址：

```text
http://127.0.0.1:8080
```

远端部署时，推荐构建并推送镜像到镜像仓库，再在服务器拉取运行：

```bash
docker pull <registry>/<namespace>/upstream-dashboard:<tag>
docker run -d --name upstream-dashboard -p 8080:8080 <registry>/<namespace>/upstream-dashboard:<tag>
```

## 常用页面

- `/overview`：总览看板。
- `/software/kunpeng`：鲲鹏软件列表。
- `/software/ascend`：昇腾软件列表。

## 开发校验

运行 TypeScript 检查：

```bash
npx tsc --noEmit
```

完整构建校验：

```bash
npm run build
```
