# 播客平台设计方案
## Podcast Platform Design Proposal

> 基于当前代码库的完整设计方案，包括系统架构、用户流程和前端改进建议

---

## 📋 目录

1. [系统架构](#系统架构)
2. [用户流程](#用户流程)
3. [核心功能详解](#核心功能详解)
4. [技术栈](#技术栈)
5. [前端页面改进方案](#前端页面改进方案)
6. [实施建议](#实施建议)

---

## 🏗️ 系统架构

### 架构概览

播客平台采用前后端分离架构，由四个核心模块组成：

```
┌─────────────┐      API 请求      ┌─────────────┐
│   Frontend  │ ─────────────────> │   Backend   │
│  React 18   │                    │   FastAPI   │
│   Vercel    │ <───────────────── │   Railway   │
└─────────────┘      响应数据      └─────────────┘
       │                                   │
       │ 音频上传                          │ 数据存储
       ↓                                   ↓
┌─────────────┐                    ┌─────────────┐
│   Storage   │ <─── 文件访问 ──── │  Database   │
│ S3/R2 存储  │                    │ PostgreSQL  │
└─────────────┘                    └─────────────┘
```

### 模块说明

#### 🔵 Frontend（前端应用）
- **技术栈**: React 18 + TypeScript + Vite + Zustand
- **部署**: Vercel
- **职责**:
  - 用户界面渲染
  - 状态管理（Zustand）
  - API 密钥管理（localStorage）
  - LCS 算法实现（文本到时间映射）

#### 🟠 Backend（后端服务）
- **技术栈**: FastAPI + SQLAlchemy + AsyncPG
- **部署**: Railway
- **职责**:
  - RESTful API 服务
  - 音频处理管道
  - Whisper 转录调度
  - 数据库操作

#### 🟢 Database（数据库）
- **技术栈**: PostgreSQL + Alembic
- **部署**: Railway 托管
- **职责**:
  - 项目、录音、转录数据存储
  - 编辑操作记录
  - 导出任务管理

#### 🔴 Storage（对象存储）
- **技术栈**: S3 / Cloudflare R2
- **职责**:
  - 原始音频文件存储
  - 导出音频文件存储
  - 非持久化磁盘（Railway 限制）

---

## 🔄 用户流程

### 完整工作流程

```
1️⃣ 创建项目 → 2️⃣ 上传音频 → 3️⃣ AI 转录 → 4️⃣ 编辑文本 → 5️⃣ 导出音频
```

### 详细步骤

#### 1️⃣ 创建项目
- 用户输入项目标题
- 系统创建项目记录
- 进入项目工作区

#### 2️⃣ 上传音频
- 拖拽或选择音频文件（最大 200MB）
- 浏览器提取元数据（时长、采样率、声道）
- 上传至 S3/R2 存储
- 创建录音记录

#### 3️⃣ AI 转录
- 后端调用 OpenAI Whisper API
- 生成逐词时间戳（word-level timestamps）
- 存储转录结果到数据库
- 前端轮询状态更新

#### 4️⃣ 编辑文本
- 用户在文本编辑器中修改转录内容
- 删除文本触发 LCS 算法计算时间范围
- 自动保存编辑操作（1 秒防抖）
- 实时预览删除效果

#### 5️⃣ 导出音频
- 后端读取所有编辑操作
- 计算保留片段（keep segments）
- Pydub 拼接音频 + 30ms 交叉淡入淡出
- 降噪 + 标准化至 -16 LUFS
- 上传至 S3/R2 并返回下载链接

---

## 🎯 核心功能详解

### 1. 非破坏性编辑

**原理**: 原始音频永不修改，所有编辑操作存储为 `EditOperation` 记录。

**流程**:
```
用户删除文本 → LCS 算法计算时间范围 → 存储 EditOperation
                                              ↓
                                    导出时重放所有操作
                                              ↓
                                    生成 keep_segments 列表
                                              ↓
                                    Pydub 拼接 + 音频处理
```

**优势**:
- ✅ 可撤销任意编辑操作
- ✅ 保留完整编辑历史
- ✅ 支持多次导出不同版本

### 2. API 密钥管理

**安全策略**: 密钥仅存储在用户浏览器，后端从不持久化。

**实现细节**:
```typescript
// 前端 (localStorage)
localStorage.setItem('podcast_openai_key', userKey)

// Axios 拦截器
config.headers['x-openai-key'] = localStorage.getItem('podcast_openai_key')
config.headers['x-anthropic-key'] = localStorage.getItem('podcast_anthropic_key')

// 后端 (从请求头读取)
openai_key = request.headers.get('x-openai-key')
anthropic_key = request.headers.get('x-anthropic-key')
```

**优势**:
- ✅ 用户完全控制密钥
- ✅ 后端无需密钥管理
- ✅ 符合隐私最佳实践

### 3. LCS 词级对齐

**算法**: 最长公共子序列（Longest Common Subsequence）动态规划

**问题**: 将自由文本编辑转换为精确的音频时间范围

**解决方案**:
```typescript
// 1. 构建 DP 表
const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0))
for (let i = 1; i <= m; i++) {
  for (let j = 1; j <= n; j++) {
    if (originalWords[i-1] === editedWords[j-1]) {
      dp[i][j] = dp[i-1][j-1] + 1
    } else {
      dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1])
    }
  }
}

// 2. 回溯找到删除的词索引
const deletedIndices = []
while (i > 0 || j > 0) {
  if (i > 0 && (j === 0 || dp[i][j] === dp[i-1][j])) {
    deletedIndices.push(i - 1)
    i--
  } else {
    j--
  }
}

// 3. 映射到音频时间戳
const ranges = deletedIndices.map(idx => ({
  start_ms: words[idx].start_ms,
  end_ms: words[idx].end_ms
}))
```

**优势**:
- ✅ 正确处理重复词汇
- ✅ O(m×n) 时间复杂度
- ✅ 精确到词级别的时间对齐

---

## 🛠️ 技术栈

### 前端技术

| 技术 | 用途 |
|------|------|
| **React 18 + TypeScript** | 现代化前端框架 + 类型安全 |
| **Vite** | 快速构建工具 |
| **Zustand** | 轻量级状态管理 |
| **Axios** | HTTP 客户端 + 请求拦截器 |
| **Vercel** | 前端部署平台 |

### 后端技术

| 技术 | 用途 |
|------|------|
| **FastAPI** | 高性能异步 Python 框架 |
| **SQLAlchemy** | ORM + 异步数据库操作 |
| **AsyncPG** | PostgreSQL 异步驱动 |
| **Alembic** | 数据库迁移工具 |
| **Railway** | 后端部署平台 |

### AI & 音频处理

| 技术 | 用途 |
|------|------|
| **OpenAI Whisper** | 语音转文字 AI 模型 |
| **Pydub** | Python 音频处理库 |
| **FFmpeg** | 音频编解码引擎 |

### 存储 & 数据库

| 技术 | 用途 |
|------|------|
| **PostgreSQL** | 关系型数据库 |
| **S3 / Cloudflare R2** | 对象存储服务 |

---

## 🎨 前端页面改进方案

### 当前问题

❌ **缺少侧边栏导航**
- 项目切换需要返回列表页
- 无法快速访问其他功能

❌ **编辑器界面单调**
- 缺少视觉层次
- 信息组织不清晰

❌ **状态反馈不明显**
- 转录进度不可见
- 导出状态不清楚

### 改进方案

✅ **添加左侧导航栏**
- 显示项目列表
- 快速切换功能
- 最近项目快捷访问

✅ **使用卡片布局**
- 编辑器卡片
- 波形图卡片
- 统计信息卡片

✅ **添加状态指示器**
- 转录状态徽章（进行中/已完成）
- 导出进度条
- 加载动画

### 新界面设计预览

#### 布局结构
```
┌──────────┬────────────────────────────────┐
│          │  转录编辑器        [已转录] [导出] │
│ 侧边栏   │  ┌──────────────────────────┐  │
│          │  │ 文本编辑区      1,234 词 │  │
│ 我的项目 │  │                          │  │
│ 上传音频 │  │ 欢迎使用播客编辑平台...  │  │
│ 设置     │  └──────────────────────────┘  │
│          │                                │
│ 最近项目 │  ┌──────────────────────────┐  │
│ Episode  │  │ 音频波形    00:45 / 03:24│  │
│ 001      │  │         [波形图]         │  │
│          │  └──────────────────────────┘  │
│          │                                │
│          │  ┌────┐ ┌────┐ ┌────┐         │
│          │  │3:24│ │12处│ │0:45│         │
│          │  └────┘ └────┘ └────┘         │
└──────────┴────────────────────────────────┘
```

#### 视觉特点
- **侧边栏**: 280px 固定宽度，白色背景，右侧边框分隔
- **卡片**: 圆角 12-16px，1.5px 边框，白色背景
- **状态徽章**: 圆角胶囊形状，颜色编码（绿色=成功，蓝色=进行中）
- **统计卡片**: 大号数字显示关键指标

---

## 🚀 实施建议

### 1. 添加侧边栏组件

**文件**: `frontend/src/components/Sidebar/index.tsx`

**功能**:
- 项目列表展示
- 导航菜单（我的项目、上传音频、设置）
- 最近项目快捷访问
- 项目切换状态管理

**实现要点**:
```typescript
// Zustand store 扩展
interface AppStore {
  // ... 现有状态
  sidebarOpen: boolean
  toggleSidebar: () => void
  recentProjects: Project[]
  loadRecentProjects: () => Promise<void>
}

// 组件结构
<Sidebar>
  <SidebarHeader />
  <SidebarNav />
  <RecentProjects />
</Sidebar>
```

### 2. 卡片化布局

**文件**: `frontend/src/components/Card/index.tsx`

**功能**:
- 通用卡片容器组件
- 支持标题、内容、操作区域
- 统一样式和间距

**实现要点**:
```typescript
interface CardProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

// Tailwind CSS 类
className="bg-white rounded-xl border-1.5 border-gray-200 p-5 shadow-sm"
```

**应用场景**:
- `<EditorCard />` - 文本编辑器
- `<WaveformCard />` - 音频波形
- `<StatsCard />` - 统计信息

### 3. 状态指示器

**文件**: `frontend/src/components/StatusBadge/index.tsx`

**功能**:
- 转录状态显示（pending/transcribing/ready/error）
- 导出状态显示（pending/processing/done/error）
- 颜色编码和图标

**实现要点**:
```typescript
const statusConfig = {
  transcribing: { color: 'blue', icon: '⏳', text: '转录中' },
  ready: { color: 'green', icon: '✓', text: '已转录' },
  processing: { color: 'blue', icon: '⏳', text: '导出中' },
  done: { color: 'green', icon: '✓', text: '已完成' },
  error: { color: 'red', icon: '✕', text: '错误' }
}

// 组件
<StatusBadge status={recording.status} />
```

### 4. 响应式布局

**断点设计**:
```css
/* 移动端 */
@media (max-width: 768px) {
  .sidebar { display: none; }
  .main-content { width: 100%; }
}

/* 平板 */
@media (min-width: 769px) and (max-width: 1024px) {
  .sidebar { width: 240px; }
}

/* 桌面 */
@media (min-width: 1025px) {
  .sidebar { width: 280px; }
}
```

### 5. 性能优化

**建议**:
- ✅ 使用 `React.memo` 优化卡片组件
- ✅ 波形图使用 Canvas 渲染
- ✅ 虚拟滚动处理长项目列表
- ✅ 防抖处理文本编辑（已实现 1 秒）

---

## 📊 预期效果

### 用户体验提升

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| 项目切换步骤 | 3 步 | 1 步 | 66% ↓ |
| 状态可见性 | 低 | 高 | 显著提升 |
| 视觉层次 | 单调 | 清晰 | 显著提升 |
| 信息密度 | 低 | 适中 | 平衡优化 |

### 开发工作量估算

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| 侧边栏组件 | 2-3 天 | 高 |
| 卡片化布局 | 1-2 天 | 高 |
| 状态指示器 | 1 天 | 中 |
| 响应式适配 | 1-2 天 | 中 |
| 测试 & 优化 | 1-2 天 | 高 |
| **总计** | **6-10 天** | - |

---

## 🎯 下一步行动

### 短期（1-2 周）
1. ✅ 实现侧边栏组件
2. ✅ 卡片化现有编辑器界面
3. ✅ 添加状态徽章和进度指示

### 中期（3-4 周）
1. 🔄 优化波形图渲染性能
2. 🔄 添加键盘快捷键支持
3. 🔄 实现暗色主题

### 长期（1-2 月）
1. 📋 多人协作编辑
2. 📋 AI 辅助内容生成（show notes）
3. 📋 音频效果器（均衡器、压缩器）

---

## 📝 总结

本设计方案基于当前代码库的实际架构，提供了：

1. **清晰的系统架构图** - 展示四大核心模块及其交互
2. **完整的用户流程** - 从项目创建到音频导出的 5 步流程
3. **核心功能深度解析** - 非破坏性编辑、API 密钥管理、LCS 算法
4. **全面的技术栈说明** - 前后端、AI、存储技术选型
5. **可落地的前端改进方案** - 侧边栏、卡片布局、状态指示器
6. **详细的实施建议** - 组件设计、代码示例、工作量估算

通过实施这些改进，播客平台将获得更专业的用户界面、更清晰的信息架构和更流畅的用户体验。

---

**设计文档版本**: v1.0
**创建日期**: 2026-03-22
**设计工具**: Pencil (pencil-new.pen)
**作者**: Claude Code + Kiro AI
