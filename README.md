# upstream-dashboard

这是一个基于 React + TypeScript + Vite + Ant Design + ECharts 的静态看板，用来查看 openEuler + 鲲鹏/昇腾相关开源项目的适配、版本、验证状态和维护者信息。

项目适合部署到 GitHub Pages：页面在构建时读取 `src/data` 下按项目拆分的 JSON 数据，运行时不再提供新增、编辑、删除或管理员登录能力。需要更新数据时，直接修改项目 JSON 文件并重新构建即可。

## 环境要求

- Node.js 18 或更高版本
- npm

## 本地运行

克隆项目后进入项目目录：

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

浏览器访问终端输出的地址，默认通常是：

```text
http://127.0.0.1:5173
```

如果 5173 端口已被占用，Vite 会自动换到其他端口。

## 数据维护

项目数据按类型和项目拆分存放：

```text
src/data/kunpeng/_index.md
src/data/kunpeng/<项目名称>.json
src/data/ascend/_index.md
src/data/ascend/<项目名称>.json
```

`_index.md` 决定该类型项目的展示顺序。项目 JSON 源文件不需要填写 `id` 和 `type`：`id` 在构建时按顺序生成，`type` 由所在目录推断。修改、新增或删除软件信息时，直接编辑对应项目 JSON，并同步调整 `_index.md`。页面运行时不会写回数据文件。

## 生成静态页面

执行生产构建：

```bash
npm run build
```

构建结果会生成到：

```text
dist/
```

本地预览构建后的页面：

```bash
npm run preview
```

然后访问终端输出的预览地址。

## GitHub Pages 部署

仓库已经包含 GitHub Actions 工作流：

- `.github/workflows/deploy.yml`：push 到 `main` 时构建并发布正式站点。
- `.github/workflows/preview.yml`：创建或更新 PR 时构建独立预览，路径形如 `https://<owner>.github.io/<repo>/pr-preview/pr-123/`；PR 关闭时自动清理预览。

GitHub 仓库需要做两项设置：

1. `Settings -> Pages -> Build and deployment -> Source` 选择 `Deploy from a branch`，分支选择 `gh-pages`，目录选择 `/ (root)`。
2. `Settings -> Actions -> General -> Workflow permissions` 选择 `Read and write permissions`，允许 workflow 写入 `gh-pages` 分支并评论 PR 预览地址。

正式站点地址通常是：

```text
https://<owner>.github.io/<repo>/
```

如果之后绑定自定义域名，可以在 workflow 中把 `VITE_BASE_PATH` 调整为 `/`。

## 常用页面

- `/overview`：总览看板
- `/software/kunpeng`：鲲鹏软件列表
- `/software/ascend`：昇腾软件列表

## 开发校验

运行 TypeScript 检查：

```bash
npx tsc --noEmit
```

完整构建校验：

```bash
npm run build
```
