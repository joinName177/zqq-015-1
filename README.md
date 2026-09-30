# zqq-015 · 成语字源与语义DNA图谱

纯前端成语字源考据与语义拓扑分析系统。用户输入任意成语，系统拆解为四字金石甲骨字形溯源、典故出处时间轴与原文引证、语义流变路径，并测算生成该成语的"语义DNA"（本义/引申义/比喻义占比环形图及核心义原），支持任意两个成语的语义亲缘度交叉比对演算。

另设「古文成语识别」模式：粘贴一段古文，系统以「内置词典精确匹配 + 四字格构词特征推测」双策略标出疑似成语片段，逐片展示置信度与证据（词典、出处、结构、语义、上下文信号），可逐条确认加入对比队列，选定甲、乙后一键进入双词亲缘对比。识别引擎对输入做充分防御，解析失败仅返回带警告的安全结果，不破坏当前文本与已确认内容。

## 架构说明（分层架构：核心层 / 端口层 / 适配器层）

- `src/core`：领域模型（`OracleChar`、`AllusionSource`、`SemanticEvolutionStep`、`SemanticDNA`、`IdiomProfile`、`KinshipResult`、`IdiomCandidate`、`IdiomRecognitionResult`）、欧氏DNA几何距离、义原Jaccard相似度算法，以及古文成语识别引擎（精确匹配 + 四字格构词特征推测，纯函数、异常安全）。
- `src/ports`：端口层契约（`IdiomRepositoryPort` 典籍成语检索端口、`KinshipPort` 亲缘度比对端口、`IdiomRecognizerPort` 古文成语识别端口）。
- `src/adapters`：适配器层（内置甲骨文字典与通用汉字语义生成适配器、亲缘比对分析适配器、古文成语识别适配器，含约120条带出处的成语词典 `idiom-lexicon.ts`）。
- `src/ui`：原生 CSS 宣纸墨韵古典视觉呈现层，包含金石甲骨卡片、历史时间轴、语义DNA甜甜圈图表、双词亲缘竞技场，以及古文识别模式（原文高亮标注、置信度条、证据列表、逐条确认与对比队列）。

## 本地运行

```bash
npm install
npm run dev
```

## 构建验证

```bash
npm run build
```

## Docker 容器化部署

```bash
docker compose up --build
```
访问：`http://localhost:8015`
