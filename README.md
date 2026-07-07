# upstream-dashboard

这是一个基于 React + TypeScript + Vite + Ant Design + ECharts 的本地看板，用来查看 openEuler + 鲲鹏/昇腾相关开源项目的适配、版本、验证状态和维护者信息。

## 环境要求

- Node.js 18 或更高版本
- npm

## 本地运行

克隆项目后进入项目目录：

```bash
git clone <your-repo-url>
cd dashboard
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

如果 5173 端口已被占用，Vite 会自动换到其他端口，例如 `5174`。

## 生成渲染产物

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

## 数据文件

项目数据存放在：

```text
src/data/kunpengProjects.json
src/data/ascendProjects.json
```

开发模式下，页面通过本地 Vite API 读写这两个 JSON 文件。管理员设置页也会把新增数据写回对应 JSON 文件。

## 管理员模式

点击右上角“管理模式”进入管理员模式。当前密码写在前端代码中，仅适合本地演示或内部调试使用。

管理员模式支持：

- 新增、编辑、删除项目
- 新增、编辑、删除版本
- 设置维护者
- 通过 JSON 添加软件信息

## 常用页面

- `/overview`：总览看板
- `/software/kunpeng`：鲲鹏软件列表
- `/software/ascend`：昇腾软件列表
- `/admin/settings`：管理员 JSON 添加页

## 开发校验

运行 TypeScript 检查：

```bash
npx tsc --noEmit
```

完整构建校验：

```bash
npm run build
```
