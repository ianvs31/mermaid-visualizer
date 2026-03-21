# Mermaid Visualizer

一个面向 `Mermaid flowchart` 的可视化编辑器。当前默认版本是基于 `React 19 + React Flow + Zustand + Mermaid + ELK` 的 `v2`，用于在画布编辑、Mermaid 文本、实时预览之间做 round-trip；仓库中同时保留了一个更早期的 `legacy` 静态版本，方便对照和回归。

## 当前状态

- 默认入口：`/`
- legacy 入口：`/legacy/index.html`
- 当前编辑器语言以中文 UI 为主，面向流程图编辑和 Mermaid round-trip
- 当前仓库仍处于早期整理阶段，文档、测试和实现已经具备基础闭环，但还有明显的性能和稳定性优化空间

## 已实现能力

### 画布编辑

- React Flow 画布编辑：节点拖拽、连线、框选、删除、撤销、重做
- 底部工具条支持两种工具模式：
  - `选择` 模式
  - `手型` 平移模式
- 画布元素创建：
  - `起止`
  - `步骤`
  - `判断`
  - `泳道`
- 节点支持：
  - 双击改名
  - 单选后直接键入进入 rename
  - 快速连接箭头
  - 多选后统一修改填充/描边
- 泳道支持：
  - 拖拽区域创建
  - 尺寸调整
  - 标题双击编辑
- 对齐辅助：
  - 网格吸附
  - 拖拽对齐参考线

### Mermaid round-trip

- Mermaid 文本和画布模型双向同步
- 右侧代码面板支持直接编辑 Mermaid 文本
- 代码变更后会自动尝试解析并同步到画布
- 右侧同时提供 Mermaid 实时预览
- `Ctrl/Cmd + Enter` 可强制应用代码到画布

### 语法支持范围

当前解析器聚焦 `flowchart / graph` 的常见子集：

- 方向：`LR / RL / TB / BT / TD`
- 节点形态：
  - 起止 / 终止
  - 过程节点
  - 判断节点
- 连线与连线标签
- `subgraph ... end`
- 分区方向 `direction`
- `class`
- `style`
- 编辑器扩展元数据：
  - `%% editor:lane`
  - `%% editor:appearance`
  - `%% editor:empty-label`

对当前不支持或不完全支持的 Mermaid 语句，编辑器会尽量保留到 `rawPassthroughStatements`，避免直接丢失文本信息。

### 自动布局与互操作

- ELK 自动布局
- 浏览器文件工作流：
  - 新建图表
  - 打开 Mermaid 文件
  - 打开 draw.io 文件
  - 下载 Mermaid / JSON / draw.io XML
- draw.io / diagrams.net XML 导入：
  - 支持 `mxGraphModel`
  - 支持 `mxfile`
  - 支持压缩 `diagram` payload
- 导出能力：
  - 下载 Mermaid
  - 下载 JSON bundle
  - 下载 draw.io XML
  - 复制 draw.io XML
  - 复制编辑器 JSON bundle
  - 复制 Markdown Mermaid 代码块
- 本地草稿持久化：
  - 默认保存到 `localStorage`
  - 刷新页面后优先恢复最近一次草稿

## 快速开始

```bash
npm install
npm run dev
```

默认开发地址通常是 [http://localhost:5173](http://localhost:5173)。

## 可用脚本

```bash
npm run dev
npm run build
npm run test
npm run test:e2e
npm run test:watch
```

首次运行 Playwright 时，如果浏览器尚未安装，先执行：

```bash
npx playwright install
```

## 使用方式

### 基本工作流

1. 在画布上通过底部工具条创建节点或泳道。
2. 使用拖拽、快速连接和样式工具整理流程。
3. 在右侧代码面板查看或编辑 Mermaid 文本。
4. 在右侧实时预览中确认渲染结果。
5. 通过右下角帮助按钮完成 draw.io 导入、导出复制和画布设置。

### 键盘快捷键

- `Space + 左键拖拽`：平移
- `V`：切换到选择模式
- `H`：切换到手型模式
- `Shift + 1`：适配视图
- `Shift + 2`：重置到 100%
- `Ctrl/Cmd + 0`：重置视口
- `Ctrl/Cmd + Enter`：应用当前 Mermaid 代码
- `Delete / Backspace`：删除选中内容
- `Ctrl/Cmd + Z`：撤销
- `Ctrl/Cmd + Shift + Z`：重做
- `Ctrl/Cmd + C / X / V`：复制、剪切、粘贴

### 入口说明

- `v2`：主入口，默认使用 FigJam 风格交互
- `/?ui=classic`：通过 URL 参数切换到 classic 交互预设
- `legacy/index.html`：旧版静态实现，保留作对照

## 项目结构

- `src/App.tsx`
  负责主编辑器编排：React Flow、快捷键、Mermaid 预览、右侧面板、工具条与交互逻辑
- `src/app/store.ts`
  Zustand 状态中心，负责历史记录、剪贴板、模型同步、节点/分组更新
- `src/app/parser.ts`
  Mermaid flowchart -> 内部 `DiagramModel`
- `src/app/serializer.ts`
  `DiagramModel` -> Mermaid flowchart
- `src/app/layout.ts`
  ELK 自动布局封装
- `src/app/import-drawio.ts`
  draw.io / diagrams.net XML 导入
- `src/app/export.ts`
  draw.io XML / JSON bundle / Markdown Mermaid 导出
- `src/app/reactflow-mapper.ts`
  将内部模型映射为 React Flow 的 nodes / edges
- `src/components/*`
  画布工具条、上下文样式工具条、视口控件、节点渲染等 UI 组件
- `src/styles/app.css`
  当前主样式文件
- `legacy/`
  早期原型版本
- `e2e/`
  Playwright 端到端回归用例（工具条创建、快速连接、草稿恢复、文件工作流）
- `.github/workflows/ci.yml`
  持续集成：Vitest、构建、Playwright

## 自动化测试

当前仓库已有一批比较实用的单元测试和 UI 集成测试，重点覆盖：

- Mermaid 解析与序列化 round-trip
- draw.io 导入与导出
- Store 历史、复制粘贴、样式更新
- 工具条与 inline rename
- 关键节点渲染与选择样式
- App 级别的基础交互流程
- Playwright 端到端回归：
  - 工具条创建与泳道模式
  - FigJam 风格快速连接
  - 本地草稿刷新恢复
  - 文件下载与 Mermaid 文件重新打开

推荐回归顺序：

```bash
npm run test
npm run build
npm run test:e2e
```

## 已知限制

- 解析器当前聚焦 `flowchart` 常见子集，复杂链式连线和更高级 Mermaid 语法仍会降级为 passthrough。
- draw.io 导入目前偏“结构导入”：
  - 会尽量保留节点、连线、方向和泳道几何信息
  - 原始样式只做有限映射，不是完整 fidelity round-trip
- 当前仍然缺少“保存到本地原文件”的正式保存动作；文件工作流以打开、新建、下载为主。
- 本地草稿基于 `localStorage`，适合单浏览器恢复，不包含跨设备同步、版本历史或冲突处理。
- 实现集中度较高，`src/App.tsx`、`src/app/store.ts`、`src/styles/app.css` 体量都已经偏大，后续维护成本会上升。
- Mermaid 和 ELK 已经做了延迟加载，但相关 chunk 仍然偏大，大图场景下的解析、预览渲染和自动布局仍会继续成为性能瓶颈。

## 下一阶段建议

### 1. 稳定性优先

- 为 draw.io 导入、Mermaid 解析失败、剪贴板失败补全更细粒度的错误提示
- 补一个真正的“保存到文件”动作，而不只是下载导出
- 继续拆分 `src/App.tsx` / `src/app/store.ts` / `src/styles/app.css`

### 2. 性能优化

- 继续减少高频编辑路径里的全量 `structuredClone`、全量序列化和布局触发
- 进一步拆分 Mermaid 相关 chunk，降低当前延迟加载包体
- 为大图场景引入更细粒度的 store 订阅和渲染边界

### 3. 功能扩展

- 补齐 draw.io 导出后的再导入保真度和样式映射
- 扩展更多 Mermaid flowchart 语法覆盖范围
- 提升 draw.io 双向互操作的一致性
- 增加分享、快照、只读预览等协作型能力

## 技术栈

- React 19
- TypeScript
- Vite
- React Flow (`@xyflow/react`)
- Zustand
- Mermaid
- ELK (`elkjs`)
- Vitest + Testing Library
- Playwright
