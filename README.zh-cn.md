<div align="center">

# RVC DATASET STUDIO

**浏览器原生声乐特征测量与 Applio / RVC 高质量语音模型训练数据集录音工作站**

[![Release](https://img.shields.io/badge/release-v0.1.0-AD283B?style=flat-square&labelColor=13161A)](https://github.com/mastermaiolo/rvc-dataset-studio)
[![许可证](https://img.shields.io/badge/许可证-MIT%20%7C%20CC0-E9E5DC?style=flat-square&labelColor=13161A)](LICENSE)
[![生产环境](https://img.shields.io/badge/生产环境-rvc--dataset--studio.vercel.app-C86D51?style=flat-square&labelColor=13161A)](https://rvc-dataset-studio.vercel.app)
[![音频引擎](https://img.shields.io/badge/音频引擎-AudioWorklet%20%2B%20YIN-38BDF8?style=flat-square&labelColor=13161A)](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
[![隐私安全](https://img.shields.io/badge/隐私-100%25%20纯前端本地%20(零上传)-10B981?style=flat-square&labelColor=13161A)](docs/GUIDE.md#privacy)
[![目标平台](https://img.shields.io/badge/目标-Applio%20%2F%20RVC%20v2-818CF8?style=flat-square&labelColor=13161A)](https://github.com/IAHispano/Applio)

<br/>

[English (UK)](README.md) · [Português (Brasil)](README.pt-br.md) · [Português (Portugal)](README.pt-pt.md) · [Español](README.es-es.md) · **简体中文**

<br/>

<img src="assets/readme/hero.svg" alt="RVC Dataset Studio 核心画布" width="100%"/>

</div>

<br/>

> **纯浏览器端录音棚与声乐特征分析工作站**：精准测量个人音域与舒适音高、自动校准训练曲目键位、主动平衡不同声区（胸声/混声/头声），一键录制无压缩的高质量训练数据集，专为 [**Applio**](https://github.com/IAHispano/Applio) 与 **RVC** 声音模型量身打造。
>
> 🔒 **100% 客户端本地隐私保护：** 任何音频均不会离开您的浏览器。无后端服务器、无账号系统、无 Cookie、无行为追踪。支持作为 Progressive Web App (PWA) 完全离线运行。
>
> 🔗 **线上生产环境部署：** [rvc-dataset-studio.vercel.app](https://rvc-dataset-studio.vercel.app)

> [!IMPORTANT]
> **道德声音 AI 契约与使用准则：**
> 仅录制并克隆**您自己的声音**，或拥有明确、可追溯书面许可的合法声音。本项目为独立开源工具，与 Applio、RVC、Suno 或任何商业音乐生成平台均无商业附属关系。

---

## 01 / 导航目录

- [02 / 项目概览](#02--项目概览)
- [03 / 核心能力与工程设计](#03--核心能力与工程设计)
- [04 / 工作区与展示画廊](#04--工作区与展示画廊)
- [05 / 控制面板与键盘人机工效](#05--控制面板与键盘人机工效)
- [06 / 神经网络训练与 Applio 工作流](#06--神经网络训练与-applio-工作流)
- [07 / 隐私体系与本地存储架构](#07--隐私体系与本地存储架构)
- [08 / 安装部署与本地开发](#08--安装部署与本地开发)
- [09 / 系统架构与工程目录结构](#09--系统架构与工程目录结构)
- [10 / 常见故障排查与边缘场景处理](#10--常见故障排查与边缘场景处理)
- [11 / 项目渊源与技术沿革](#11--项目渊源与技术沿革)

---

## 02 / 项目概览

训练高质量的 RVC（Retrieval-based Voice Conversion）或 Applio 语音模型，对训练语料的声音纯净度、干声质感以及声区平衡性有着极高要求。非专业录音环境往往伴随房间浑浊混响、数字削顶失真（Clipping）或强行拉扯声带导致的破音破裂。

RVC Dataset Studio 将声乐教学理论与机器学习声学工程深度融合：依据使用者实测音域动态移调练习曲目、主动平衡换声区（Passaggio）过渡、对每一条录音执行自动化质检，并将符合规范的训练数据集直接打包导出。

<br/>

<div align="center">
  <img src="assets/readme/at-a-glance.svg" alt="RVC Dataset Studio 项目概览" width="100%"/>
</div>

<br/>

### 核心架构优势

| 架构支柱 | 技术实现机制 | 录音实际应用价值 |
|---|---|---|
| **零服务端纯前端隐私** | Web Audio API 捕获与浏览器本地 IndexedDB 存储 | 音频文件绝不出本机；零服务器传输、零追踪、零泄漏 |
| **个性化声乐音域校准** | 30 秒实测导引（检测音域、舒适音高与 LTAS 频谱） | 自动将所有练习曲目自适应平移至您的声线（从男低音到女高音） |
| **换声区与声区主动平衡** | 黄金配比：胸声（25–35%）、混声（25–35%）、头声（15–25%）、念白（10–20%） | 杜绝训练出的 AI 模型在高音区尖叫破音、挤卡或拖拽胸声质量 |
| **实时 YIN 音高监测器** | 亚采样级 YIN 基频（$f_0$）探测，实时显示 $\pm\text{cents}$ 偏差 | 录音期间在卡拉 OK 提词器上直接提供直观的音准偏离反馈 |
| **自动化录音质检 (QC)** | 有效发声时长分析、削顶失真硬核拦截（$> -1\text{ dBFS}$）与底噪检测 | 自动剔除受污染的录音片段，防范劣质音频破坏神经网络权重 |
| **Applio 即插即用打包** | 纯客户端生成 16/24 位 WAV、README 及 `dataset_info.json` | 自动配置推荐的超参数配置（RMVPE、ContentVec、目标采样率与轮数） |

---

## 03 / 核心能力与工程设计

<br/>

<div align="center">
  <img src="assets/readme/capabilities.svg" alt="RVC Dataset Studio 核心能力" width="100%"/>
</div>

<br/>

### 1. 声区构成、换声区与防范 AI 模型拉扯失真
神经网络声学特征嵌入模型（如 ContentVec）在面对超出训练数据音色范围的旋律时，往往难以进行合理泛化。若数据集中全部为重机能胸声，则推理目标歌曲一旦进入换声区（Passaggio，如男声的 D4–G4），RVC 模型便会机械地向上硬拖胸声重量，导致严重的人工电音毛刺、尖锐鼻音挤压或直接发生八度破音裂音。

RVC Dataset Studio 在曲目库中严格把控各声区占比：
- **胸声机能 (25–35%)：** 奠定声音的基础质感、温暖度与核心发声能量。
- **混声 / 换声区机能 (25–35%)：** 跨越换声点的关键枢纽，确保歌曲高潮旋律平滑过渡。
- **头声 / 假声机能 (15–25%)：** 声带边缘薄膜震动，防范高音弱声塌陷失控。
- **自然生活念白 (10–20%)：** 提供真实的口语共振峰特征与清晰的吐字咬字。

训练库中融入的声乐教学手段：
- *半闭合声道练习 (SOVT)：* 通过 "ng" 汽笛音和唇颤音平衡声门下气压。
- *咽音 Twang 技巧：* 采用 "Nay" 与 "Gee" 诱导声带高效闭合，避免拖拽沉重肌肉机能。
- *元音收窄窄化技巧：* 在高音区主动修饰开元音为稍聚拢的形态（如 "Ah" $\rightarrow$ "Uh/Oh"）。

### 2. YIN 音高追踪与提词器卡拉 OK 联动
系统基于经典的 **YIN 音高检测算法**，在客户端毫秒级解算声波信号的基频（$f_0$）与非周期性分量。
- **实时音准偏差指示：** 在提词器歌词上方直接浮现音高音分偏离度（$\pm\text{cents}$）。
- **基准音合成器：** 通过耳机提前回放目标基准音阶，辅助歌手在倒计时期间找准首音。
- **动态曲线引导：** 为汽笛滑动音阶与声调语言（如汉语普通话四声）生成动态音高走势轮廓。

### 3. 录音质量即时监测与动态余量校准
在正式录制前，5 秒预检程序即对输入信号与室内声学完成诊断：
- **数字削顶失真截获：** 实时监控并拦截峰值超过 $-1\text{ dBFS}$ 的失真信号。
- **环境背景底噪控制：** 确保房间环境底噪稳定在 $-24\text{ dBFS}$ 以下（理想指标 $<-60\text{ dBFS}$）。
- **有效发声时长校验：** 确保录音包含有效声带振动信号，而非录入无效房间静音。
- **全键盘极速审听复核：** 敲击 **Enter** 即刻收录，敲击 **R** 瞬间重录。

---

## 04 / 工作区与展示画廊

<br/>

<div align="center">
  <img src="assets/readme/showcase.svg" alt="RVC Dataset Studio 工作区展示" width="100%"/>
</div>

<br/>

### 录音工作流的 4 大核心界面

| 工作区 / 阶段 | 核心任务 | 功能细节 |
|---|---|---|
| **01 / 声乐音域建档** | 音域测试与授权协议 | 30 秒实测流程（汽笛滑动音、口语念白、舒适音高）；音域分类判定；多语言选择 |
| **02 / 录音室提词看板** | 录音免手动操控 HUD | 逐音节卡拉 OK 提词器、节拍倒计时（"准备 · 吸气"）、基准音引导、实时音准指示徽章 |
| **03 / 单条录音质检审听** | 音频验证卡片 | 音频波形回放、有效发声时长核验、dBFS 峰值电平、背景底噪检测、[Enter] 与 [R] 快捷键 |
| **04 / 数据集音域图谱** | 覆盖率分析与导出 | 半音分布直方图、各声区占比监控、"我的歌词" 生成器、ZIP 或长单轨 WAV 导出 |

<br/>

<details>
<summary><strong>展开浏览收录的内容库与语言包（点击展开）</strong></summary>
<br/>

1. **练习题库体系 (`content/`)：**
   规范的 JSON 题库，经严格 Schema 校验（`schema/`）。涵盖长音保持、音阶滑动、大跳音程、高速咬字吐字与各声区平滑连接练习。
2. **多语言发音包：**
   包含 **English**、**Português (Brasil)**、**Español** 以及带有拼音注音和声调轮廓的 **中文（普通话）**。
3. **“我的歌词”专属生成器：**
   支持粘贴个人自创歌曲段落。系统自动拆分音节并生成 4 种训练模式：自然朗读、旋律演唱、快速吐字与慢速长音。所有歌词仅保存在本地 `localStorage`。
4. **Applio 参数清单 (`dataset_info.json`)：**
   随音频文件一同打包导出，推荐目标采样率（40k/48k）、RMVPE 音高提取、ContentVec 模型匹配及推荐训练 Epoch 周期。

</details>

---

## 05 / 控制面板与键盘人机工效

<br/>

<div align="center">
  <img src="assets/readme/control-surface.svg" alt="RVC Dataset Studio 控制面板" width="100%"/>
</div>

<br/>

### 录音全键盘快捷键

专为歌手站立于麦克风前进行免鼠标盲操设计：

| 按键 | 触发动作 | 使用场景 |
|---|---|---|
| <kbd>空格键</kbd> | **开始录制 / 停止录制** | 启动录音倒计时（"准备 · 吸气"）或中止当前录音 |
| <kbd>回车键</kbd> | **采纳当前录音** | 保存至 IndexedDB 并自动切换至下一条练习题 |
| <kbd>R 键</kbd> | **放弃并重录** | 丢弃当前录音并立即重新进入本题倒计时 |
| <kbd>T 键</kbd> | **播放参考基准音** | 在耳机中播放目标基准起始音 |
| <kbd>M 键</kbd> | **静音参考音频引导** | 开启或关闭合成器辅助伴奏音 |
| <kbd>←</kbd> / <kbd>→</kbd> | **上一题 / 下一题** | 在题库曲目列表之间自由前后跳转 |

### 录音动态余量与增益校准

1. 必须佩戴**全封闭式耳机**（半开放式耳机极易将伴奏音漏入麦克风，污染 AI 声音模型）。
2. 保持与麦克风防喷罩之间 **15–20 cm** 的恒定距离。
3. 调节话放增益，确保在最大音量演唱时峰值电平处于 **$-12\text{ dBFS}$ 至 $-6\text{ dBFS}$** 区间，绝不可触碰 $0\text{ dBFS}$（数字削顶）。
4. 确保房间安静底噪低于 **$-60\text{ dBFS}$**（在未做声学装修的环境中，可利用衣柜、毛毯或厚重窗帘阻隔反射）。

---

## 06 / 神经网络训练与 Applio 工作流

导出数据集后，在 **Applio** 或 **RVC** 中的训练标准步骤如下：

### 1. 解压与目录结构
将导出的 ZIP 压缩包直接解压至 Applio 的数据集目录中：
```
Applio/
└── assets/
    └── datasets/
        └── YourVoiceName/      # 仅使用英文字符（严禁空格及特殊符号）
            ├── take_001.wav
            ├── take_002.wav
            ├── dataset_info.json
            └── README.md
```

### 2. Preprocess（预处理）
- 选择与目标底模一致的采样率（**40 kHz** 或 **48 kHz**）。
- 保持**自动切片 (Automatic Slicing) 开启**。Applio 会在特征提取阶段自动二次切分成微片段，单条录音的时长仅用于照顾呼吸节奏。

### 3. Extract（特征提取）
- **音高提取算法 ($f_0$ 方法)：** 务必选用 `rmvpe`。模型旋律感与音准精度直接取决于此。
- **声学特征嵌入模型 (Embedder)：** 选用 `contentvec`。训练时采用的 Embedder 在后续推理时必须完全一致。

### 4. Train（模型训练）
- 设置每隔 **10–50 轮 (Epochs)** 自动保存一次权重 Checkpoint。
- **以听感盲听评判 Checkpoint：** 切勿机械迷信 Loss 损失曲线或固定轮数。使用同一段干声测试音频在不同 Checkpoint 下推理对比，挑选音色最自然、机械感最轻的版本。
- 训练完成后构建索引文件 (Index)。

### 5. 核心推理转换参数指南

| 参数 | 职能解析与推荐配置 |
|---|---|
| **Pitch Shift (变调)** | 将输入参考歌曲转调至*您的*舒适发声自然音域，避免跨越过多半音强行变调。 |
| **Pitch Extractor** | 保持 `rmvpe`，兼顾歌唱旋律与口语语调的极佳稳定性。 |
| **Index Rate (检索率)** | 控制特征索引拉取原声相似度的强度（推荐 $0.60–0.85$）。该参数不控制旋律走势。 |
| **Protect (辅音保护)** | 保护无声音节、清辅音及呼吸气口（推荐 $0.20–0.33$）。数值越小保护越强；$0.50$ 为完全关闭。 |
| **Formant Shift** | Quefrency 与 Timbre 默认基准值为 **1.0**。微调范围建议在 $0.95–1.05$ 之间。 |

---

## 07 / 隐私体系与本地存储架构

RVC Dataset Studio 恪守严格的数据零留存隐私防线：

- **音频流处理：** 麦克风音频仅在系统内存中通过 `AudioWorklet` 流式处理，直接编码写入浏览器的本地 `IndexedDB`。
- **零服务端留存：** 任何音频片段、发声分析指标、歌词文本绝不向任何云端上传。
- **本地设置：** 音域偏好与自定义歌词只保存在浏览器的 `localStorage` 中。
- **PWA 离线工作站：** 首次加载后，Service Worker 缓存所有静态前端资源，即使断网或在隔音录音室中亦可顺畅运行。
- **法规遵从：** 严格遵循 **欧盟 GDPR 第 6(1)(a) 条** 以及国际数据隐私保护条款。

---

## 08 / 安装部署与本地开发

### 环境要求

- **Node.js：** $\ge 20.0$
- **包管理器：** `npm`（推荐）
- **现代化浏览器：** 最新版本 Chrome、Edge、Firefox 或 Safari（桌面端及 iOS）。麦克风输入必须在 HTTPS 或 `localhost` 环境下运行。

### 本地启动流程

```bash
# 克隆代码仓库
git clone https://github.com/mastermaiolo/rvc-dataset-studio.git
cd rvc-dataset-studio

# 安装依赖
npm install

# 启动本地开发热更新服务器 (http://localhost:5173)
npm run dev

# 执行全套规范校验（代码规范 + 类型检查 + 题库 Schema 验证 + 单元测试 + 构建）
npm run check
```

### 常用命令脚本

| 脚本命令 | 职能说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run typecheck` | 执行 TypeScript 静态类型检查 |
| `npm run lint` | 执行 ESLint 代码规范扫描 |
| `npm test` | 执行基于合成音频信号的 Vitest 单元测试 |
| `npm run validate:content` | 校验练习题库 JSON 文件是否符合 Schema 规范 |
| `npm run build` | 编译构建生产环境静态资源到 `dist/` |

### 生产环境部署 (Vercel)

本录音工作室已作为全静态 Web 应用程序部署至 Vercel：[**rvc-dataset-studio.vercel.app**](https://rvc-dataset-studio.vercel.app)。

- **静态托管与自动化构建：** 在 [Vercel](https://vercel.com) 上接入自动化 CI/CD（构建命令 `npm run build`，输出目录 `dist`）。
- **安全加固与 HTTP 标头 (`vercel.json`):** 实施严格的 Content-Security-Policy (CSP)、`Permissions-Policy: microphone=(self)`、HSTS 以及 Service Worker no-cache 缓存失效策略。

---

## 09 / 系统架构与工程目录结构

<br/>

<div align="center">
  <img src="assets/readme/architecture.svg" alt="RVC Dataset Studio 系统架构" width="100%"/>
</div>

<br/>

### 目录结构组织

```
rvc-dataset-studio/
├── content/                   # 练习题库与语言发音包 (CC0 1.0)
│   ├── en/                    # 英语练习
│   ├── pt-BR/                 # 巴西葡萄牙语练习
│   ├── es/                    # 西班牙语练习
│   └── zh/                    # 汉语普通话练习（拼音注音与声调轮廓）
├── schema/                    # 题库 JSON 校验规范
├── docs/                      # 详细技术指南与跨平台测试备忘
│   ├── GUIDE.md               # 英文版录音与 Applio 训练指南
│   ├── GUIA.pt-BR.md          # 葡语版录音与 Applio 训练指南
│   ├── BROWSER_TESTING.md     # AudioWorklet 跨浏览器兼容性说明
│   └── LANGUAGE_PACKS.md      # 社区贡献新语言包指导文档
├── src/
│   ├── audio/                 # AudioContext、AudioWorklet 录音与伴奏合成器
│   ├── analysis/              # YIN 音高算法、VAD、LTAS/FFT、单条 QC 质检与音域图谱
│   ├── bank/                  # 题库类型模型与音域动态自适应定位
│   ├── lyrics/                # “我的歌词”音节拆分引擎与题目动态生成器
│   ├── storage/               # IndexedDB 本地音频存储与 localStorage 配置
│   ├── export/                # 纯前端 ZIP 打包 (fflate) 与长轨 WAV 导出
│   ├── i18n/                  # 界面多语言翻译文本（en 为基准对照）
│   └── ui/                    # Preact 响应式组件与 Signals 状态机
├── scripts/                   # 校验与构建自动化脚本
├── tests/                     # Vitest 测试套件（合成音高测试、VAD、WAV、ZIP）
├── public/                    # 静态媒体资源与 PWA 配置文件
├── vercel.json                # 安全响应头规范 (CSP, Permissions-Policy)
└── assets/
    └── readme/                # 模块化矢量 SVG 设计视觉资产
```

---

## 10 / 常见故障排查与边缘场景处理

<br/>

<div align="center">
  <img src="assets/readme/failure-modes.svg" alt="RVC Dataset Studio 故障排查" width="100%"/>
</div>

<br/>

### 常见故障与应对策略

<details>
<summary><strong>1. 数字削顶失真劣化 (&gt; -1 dBFS)</strong></summary>
<br/>

峰值超过 $-1\text{ dBFS}$ 会削平声波顶部，产生极其刺耳的方波失真。ContentVec 会将这种金属毛刺当成您的原声固有特征学习进模型。请务必执行 5 秒动态余量测试，将最强唱腔的峰值维持在 $-12$ 至 $-6\text{ dBFS}$。

</details>

<details>
<summary><strong>2. 操作系统与浏览器自带的“麦克风音频增强”陷阱</strong></summary>
<br/>

操作系统或浏览器的“声音清晰化处理”（回声消除、降噪抑噪与自动增益）会强行切除声乐共振峰并产生不自然的机械相位抵消。本工作站已在 `getUserMedia` 请求中强制索取纯净原声。若浏览器强行开启降噪，页面顶部将弹出警告。请在操作系统音频控制台中关闭所有“麦克风增强”。

</details>

<details>
<summary><strong>3. 开放式耳机串音渗漏污染数据集</strong></summary>
<br/>

如果半开放式耳机的伴奏引导音泄漏进麦克风，模型在演唱该音阶时便会附带不可抹除的正弦波背景噪音。请始终选用全封闭式监听耳机，并适度调小监听音量。

</details>

<details>
<summary><strong>4. 换声区挤卡与高音破音</strong></summary>
<br/>

强行拖拽沉重胸声越过换声点会导致训练出的模型音色尖叫撕裂。请积极利用半闭合声道练习（"ng" 汽笛滑动音）与元音收窄技巧（将 "Ah" 微调向 "Uh/Oh"），顺畅过渡至混声。

</details>

---

## 11 / 项目渊源与技术沿革

<br/>

<div align="center">
  <img src="assets/readme/provenance.svg" alt="RVC Dataset Studio 项目渊源" width="100%"/>
</div>

<br/>

### 开源传承与社区渊源

- **声学与神经网络工程：** Master Maiolo · MAIOLO / SYSTEMS LAB。
- **线上生产环境部署：** [rvc-dataset-studio.vercel.app](https://rvc-dataset-studio.vercel.app)。
- **生态兼容性：** 完全兼容 Applio、RVC v2、SoftVC 及开源语音克隆训练框架。
- **独立项目说明：** 与 Applio、RVC、Suno 或第三方平台无商业利益关联。

### 许可证规范

- **应用程序核心源码：** [MIT 许可证](LICENSE)。
- **练习题库与数据规范 (`content/`, `schema/`):** [CC0 1.0 全球通用（公有领域）](content/LICENSE)。
- **内置字体家族：** SIL Open Font License 1.1。

---

<div align="center">
<sub>MAIOLO / SYSTEMS LAB · RVC DATASET STUDIO · 浏览器原生语音模型录制工作站</sub>
</div>
