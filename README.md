# upstream-dashboard

`upstream-dashboard` 是 openEuler 生态开源项目支持看板，用于展示鲲鹏/昇腾相关开源项目的分类、版本、硬件型号、验证结果和维护者信息。

项目基于 React + TypeScript + Vite + Ant Design + ECharts 构建。前端页面是静态产物，由 Nginx 托管；运行时数据保存在容器内 `/project-data`，并由容器内同步脚本定时从远端仓库刷新。

## 目录

- [功能范围](#功能范围)
- [环境要求](#环境要求)
- [本地运行](#本地运行)
- [数据来源](#数据来源)
- [数据维护](#数据维护)
- [运行时数据刷新](#运行时数据刷新)
- [构建与预览](#构建与预览)
- [Docker 部署](#docker-部署)
- [常用页面](#常用页面)
- [开发校验](#开发校验)

## 功能范围

- 总览看板：展示鲲鹏/昇腾项目数量、通过率、分类分布和待关注项。
- 软件列表：展示项目名称、分类、版本、硬件型号、验证状态和维护者信息。
- 真实数据：容器启动时从远端仓库同步到 `/project-data`，页面运行时从 `/runtime-data` 读取。
- 本地模板：`src/data/templates` 只保存 JSON 格式参考，不作为页面真实数据。
- 页面刷新：页面顶部展示上次刷新时间，并提供手动刷新按钮。
- 部署方式：构建 Docker 镜像，远端拉取镜像运行。

页面不提供新增、编辑、删除或管理员登录。数据修改通过更新远端数据仓中的 JSON 完成。

## 环境要求

本地开发需要：

- Node.js 18 或更高版本
- npm

容器部署需要：

- Docker 或兼容 OCI 镜像的构建/运行环境

## 本地运行

安装依赖：

```bash
npm install
```

启动前端开发服务：

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

如果要在本地调试运行时数据接口，可以另开一个终端启动同步服务：

```bash
DATA_DIR=/tmp/upstream-dashboard-data npm run sync:server
```

手动同步一次远端数据：

```bash
DATA_DIR=/tmp/upstream-dashboard-data npm run sync:data
```

Vite 已把 `/api/data` 和 `/runtime-data` 代理到本地同步服务的 `3001` 端口。


## 数据来源

真实数据来自两个远端数据仓，容器内同步脚本会分别稀疏克隆对应目录：

| 领域 | 默认仓库 | 默认目录 | 说明 |
| --- | --- | --- | --- |
| 鲲鹏 | `https://gitcode.com/openeuler/openeuler-docker-images.git` | `tests` | 读取 `tests/<软件名称>/results/*.json`。 |
| 昇腾 | `https://github.com/MrZ20/ascend-testdata.git` | `project` | 读取 `project/<软件名称>/<软件名称>.json`，并可运行同目录 CI 脚本。 |

容器启动时会先同步远端数据，把解析后的结果写入运行时目录：

```text
/project-data/kunpeng/_index.md
/project-data/kunpeng/*.json
/project-data/ascend/_index.md
/project-data/ascend/*.json
/project-data/metadata.json
```

Nginx 通过 `/runtime-data` 暴露容器内 `/project-data`，前端优先读取这里的数据。`metadata.json` 中的 `lastSyncedAt` 用于页面展示上次刷新时间。容器删除后这份运行时数据会一起删除，下次启动会重新从远端同步。

仓库内的 `src/data` 只保留格式模板：

```text
src/data/templates/kunpeng.template.json
src/data/templates/ascend.template.json
```

`src/data/templates` 不会被页面读取，只用于维护数据时参考字段格式。远端数据不可用且 `/project-data` 为空时，页面会显示空列表和“等待同步”，不会展示假数据。


## 数据维护

真实数据应维护在各自远端数据仓里。本仓库只维护页面代码、同步脚本和字段模板。

### 鲲鹏数据

鲲鹏同步脚本读取：

```text
tests/<软件名称>/results/*.json
```

没有 JSON 的软件目录会跳过；同名项目只保留第一次解析到的内容；`_index.md` 由同步脚本自动生成，不需要远端提供。

### 昇腾数据

昇腾同步脚本读取：

```text
project/<软件名称>/<软件名称>.json
```

如果 JSON 中配置了 `script`，例如：

```json
{
  "name": "vllm-ascend",
  "category": "训练加速",
  "upstream": "https://github.com/vllm-project/vllm-ascend",
  "branch": "main",
  "maintainer": {
    "name": "lisi",
    "email": "lisi@example.com"
  },
  "supportedVersions": [
    {
      "version": "main",
      "hardware": "Ascend 910B; Ascend 910C",
      "ci": "",
      "ciDate": "",
      "integratedDate": "2026-07-06"
    }
  ],
  "script": "ci-result.sh"
}
```

同步脚本会先把该软件目录同步到本地临时目录，再在同目录查找并运行该脚本，然后重新读取 JSON，把最新的 `ci` 和 `ciDate` 写入运行时数据。部署环境默认执行这个本地脚本；本地验证时可以设置 `ASCEND_CI_RUN_SCRIPTS=0` 跳过脚本执行。

本仓库提供两个模板文件供参考：

```text
src/data/templates/kunpeng.template.json
src/data/templates/ascend.template.json
```

### 通用字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 项目名称。 |
| `category` | 是 | 项目分类。 |
| `upstream` | 否 | 上游仓库或主页地址。 |
| `maintainer` | 否 | 维护者信息，包含 `name` 和 `email`。 |
| `supportedVersions` | 是 | 支持版本列表。 |

### 鲲鹏字段

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

### 昇腾字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `branch` | 否 | 看护分支，未填写时页面默认显示 `main`。 |
| `supportedVersions[].version` | 是 | 支持版本号。 |
| `supportedVersions[].hardware` | 是 | 硬件型号，多个值用英文分号 `;` 分隔。 |
| `supportedVersions[].ci` | 否 | CI 验证结果：`pass`、`fail` 或 `null`。 |
| `supportedVersions[].ciDate` | 否 | CI 验证日期。 |
| `supportedVersions[].integratedDate` | 是 | 集成日期。 |
| `script` | 否 | 同目录 CI 刷新脚本文件名，例如 `ci-result.sh`。 |


## 运行时数据刷新

容器内的数据同步脚本会从远端仓库拉取最新数据。全量同步逻辑：

1. 稀疏克隆鲲鹏数据仓的 `KUNPENG_TESTS_PATH`，默认 `tests`。
2. 稀疏克隆昇腾数据仓的 `ASCEND_PROJECTS_PATH`，默认 `project`。
3. 分别解析两个领域的 JSON，生成 `/project-data/kunpeng` 和 `/project-data/ascend`。
4. 写入 `/project-data/metadata.json`，其中包含 `lastSyncedAt`，前端用它显示上次刷新时间。
5. 原子替换运行时目录，避免页面读到半更新状态。

容器首次启动会先执行一次同步，再启动 Nginx 对外服务。首次同步成功后，后台自动刷新默认一天一次：

```text
SYNC_INTERVAL_SECONDS=86400
```

页面右上角按领域刷新：鲲鹏页面显示一个“刷新数据”按钮；昇腾页面显示一个“刷新数据”下拉按钮，可选择“所有”“仅项目”“仅 CI”。自动同步和手动同步共用同一个锁，避免同时写数据。

昇腾软件列表支持单项目刷新：

| 接口 | 说明 |
| --- | --- |
| `POST /api/data/ascend/all/refresh` | 刷新全部昇腾项目，并执行可用 CI 脚本。 |
| `POST /api/data/ascend/project/refresh` | 刷新全部昇腾项目 JSON，不执行 CI 脚本，并尽量保留已有 CI 结果。 |
| `POST /api/data/ascend/ci/refresh` | 使用容器本地项目缓存执行 CI 脚本，不重新拉取远端仓库。 |
| `POST /api/projects/ascend/<name>/all/refresh` | 刷新单个昇腾项目，并执行该项目 CI 脚本。 |
| `POST /api/projects/ascend/<name>/project/refresh` | 稀疏拉取 `project/<name>`，刷新该软件项目 JSON，不运行 CI 脚本，并尽量保留已有 CI 结果。 |
| `POST /api/projects/ascend/<name>/ci/refresh` | 使用容器本地项目缓存执行该软件 CI 脚本，不重新拉取远端仓库。 |

“仅 CI”依赖容器内的项目缓存；如果缓存不存在，需要先执行“所有”或“仅项目”。单项目刷新只 upsert 对应项目 JSON，不会覆盖整个昇腾列表。

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

项目使用一个 Dockerfile 完成前端构建、Nginx 托管和运行时数据同步。

构建镜像：

```bash
docker build -t upstream-dashboard:latest .
```

如果站点部署在子路径，可以通过 `VITE_BASE_PATH` 指定前端资源基础路径：

```bash
docker build --build-arg VITE_BASE_PATH=/upstream-dashboard/ -t upstream-dashboard:latest .
```

本地运行容器，运行时数据直接保存在容器内：

```bash
docker run --rm \
  -p 8080:8080 \
  upstream-dashboard:latest
```

访问地址：

```text
http://127.0.0.1:8080
```

常用运行参数：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATA_DIR` | `/project-data` | 容器内运行时数据目录；容器删除后数据随容器删除。 |
| `KUNPENG_REPO_URL` | `https://gitcode.com/openeuler/openeuler-docker-images.git` | 鲲鹏数据仓库。 |
| `KUNPENG_BRANCH` | `master` | 鲲鹏数据分支。 |
| `KUNPENG_TESTS_PATH` | `tests` | 鲲鹏测试结果目录。 |
| `ASCEND_REPO_URL` | `https://github.com/MrZ20/ascend-testdata.git` | 昇腾数据仓库。 |
| `ASCEND_BRANCH` | `main` | 昇腾数据分支。 |
| `ASCEND_PROJECTS_PATH` | `project` | 昇腾项目数据目录。 |
| `ASCEND_CI_RUN_SCRIPTS` | `1` | 是否执行昇腾 JSON 中配置的 CI 脚本；本地验证可设为 `0`。 |
| `PROJECT_SOURCE_DIR` | `/project-data/_source-cache` | 昇腾项目原始目录缓存，用于“仅 CI”刷新时避免重新拉取远端仓库。 |
| `SYNC_INTERVAL_SECONDS` | `86400` | 自动同步间隔，单位秒。 |
| `SYNC_SERVER_PORT` | `3001` | 容器内同步服务端口，只监听 `127.0.0.1`。 |
| `SYNC_LOCK_STALE_SECONDS` | `7200` | 同步锁超过该秒数会被视为过期锁并清理。 |

远端部署时，推荐构建并推送镜像到镜像仓库，再在服务器拉取运行：

```bash
docker pull <registry>/<namespace>/upstream-dashboard:<tag>
docker run -d \
  --name upstream-dashboard \
  -p 8080:8080 \
  <registry>/<namespace>/upstream-dashboard:<tag>
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
