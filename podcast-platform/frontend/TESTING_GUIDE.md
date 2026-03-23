# 🧪 播客平台测试指南

**版本**: v2.0.0  
**更新时间**: 2026-03-24  
**状态**: 生产就绪

---

## 📋 测试前准备

### 1. 确认服务器运行

**后端 API**:
```bash
curl http://localhost:8000/health
# 预期输出: {"status":"ok"}
```

**前端开发服务器**:
```bash
curl http://localhost:5173
# 预期输出: HTML 页面
```

**API 代理**:
```bash
curl http://localhost:5173/api/health
# 预期输出: {"status":"ok"}
```

### 2. 准备测试数据

**API Keys**:
- OpenAI API Key (用于 Whisper 转录)
- Anthropic API Key (用于 Claude 内容生成)

**测试音频文件**:
- 格式: mp3, wav, m4a
- 时长: 建议 1-5 分钟
- 大小: < 25MB

---

## 🎯 功能测试清单

### 阶段 1: 初始设置 (5 分钟)

#### 1.1 打开应用
- [ ] 在浏览器打开 http://localhost:5173
- [ ] 页面正常加载
- [ ] 看到 API Key 设置对话框

#### 1.2 设置 API Keys
- [ ] 输入 OpenAI API Key
- [ ] 输入 Anthropic API Key
- [ ] 点击保存
- [ ] 对话框关闭
- [ ] Keys 保存到 localStorage

**验证方法**:
```javascript
// 在浏览器控制台执行
localStorage.getItem('openai_api_key')
localStorage.getItem('anthropic_api_key')
```

---

### 阶段 2: 项目管理 (5 分钟)

#### 2.1 查看项目列表
- [ ] 左侧 Sidebar 显示项目列表
- [ ] 看到现有项目 (如果有)
- [ ] 项目名称正确显示

#### 2.2 创建新项目
- [ ] 点击 "New Project" 按钮
- [ ] 输入项目名称
- [ ] 输入项目描述 (可选)
- [ ] 点击创建
- [ ] 新项目出现在列表中
- [ ] 自动选中新项目

#### 2.3 切换项目
- [ ] 点击不同的项目
- [ ] 右侧内容区域更新
- [ ] 显示对应项目的录音列表

**测试 API**:
```bash
# 获取项目列表
curl http://localhost:8000/projects

# 创建项目
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Project","description":"Test"}'

# 获取项目详情
curl http://localhost:8000/projects/{project_id}
```

---

### 阶段 3: 音频上传 (10 分钟)

#### 3.1 上传音频文件
- [ ] 点击 "Upload Recording" 按钮
- [ ] 选择音频文件
- [ ] 看到上传进度
- [ ] 上传成功提示
- [ ] 文件出现在录音列表

#### 3.2 验证上传
- [ ] 录音名称正确显示
- [ ] 文件大小正确显示
- [ ] 上传时间正确显示
- [ ] 状态显示为 "pending"

**测试 API**:
```bash
# 上传音频
curl -X POST http://localhost:8000/projects/{project_id}/recordings \
  -F "file=@/path/to/audio.mp3"

# 获取录音列表
curl http://localhost:8000/projects/{project_id}/recordings
```

---

### 阶段 4: AI 转录 (15-30 分钟)

#### 4.1 开始转录
- [ ] 点击 "Transcribe" 按钮
- [ ] 看到转录开始提示
- [ ] 状态更新为 "transcribing"
- [ ] 显示转录进度 (如果有)

#### 4.2 等待转录完成
- [ ] 定期刷新查看状态
- [ ] 转录完成后状态更新为 "completed"
- [ ] 看到转录文本
- [ ] 看到词级时间戳

#### 4.3 验证转录结果
- [ ] 转录文本准确
- [ ] 词级时间戳正确
- [ ] 可以点击词语跳转

**测试 API**:
```bash
# 开始转录
curl -X POST http://localhost:8000/recordings/{recording_id}/transcribe \
  -H "x-openai-key: YOUR_OPENAI_KEY"

# 获取转录状态
curl http://localhost:8000/recordings/{recording_id}

# 获取转录文本
curl http://localhost:8000/transcripts/{transcript_id}
```

---

### 阶段 5: 词级编辑 (15 分钟)

#### 5.1 查看转录文本
- [ ] 转录文本显示在编辑器中
- [ ] 词语按时间顺序排列
- [ ] 每个词都可以点击
- [ ] 词语之间有适当间距

#### 5.2 点击词语跳转
- [ ] 点击任意词语
- [ ] 波形图跳转到对应时间
- [ ] 音频播放从该位置开始
- [ ] 词语高亮显示

#### 5.3 选择文本片段
- [ ] 拖动鼠标选择多个词语
- [ ] 选中的词语高亮显示
- [ ] 可以看到选中的时间范围

#### 5.4 删除片段
- [ ] 选择要删除的词语
- [ ] 点击 "Delete" 按钮
- [ ] 词语标记为删除 (灰色显示)
- [ ] 可以撤销删除

#### 5.5 替换文本
- [ ] 选择要替换的词语
- [ ] 点击 "Replace" 按钮
- [ ] 输入新文本
- [ ] 文本更新显示

**测试 API**:
```bash
# 创建编辑会话
curl -X POST http://localhost:8000/transcripts/{transcript_id}/edit-sessions

# 添加删除操作
curl -X POST http://localhost:8000/edit-sessions/{session_id}/operations \
  -H "Content-Type: application/json" \
  -d '{"op_type":"delete","payload":{"start_ms":1000,"end_ms":2000}}'

# 获取编辑操作列表
curl http://localhost:8000/edit-sessions/{session_id}/operations
```

---

### 阶段 6: 波形图控制 (10 分钟)

#### 6.1 播放控制
- [ ] 点击播放按钮
- [ ] 音频开始播放
- [ ] 波形图显示播放进度
- [ ] 点击暂停按钮
- [ ] 音频暂停播放

#### 6.2 时间显示
- [ ] 显示当前播放时间
- [ ] 显示总时长
- [ ] 时间格式正确 (mm:ss)

#### 6.3 缩放控制
- [ ] 点击 "Zoom In" 按钮
- [ ] 波形图放大
- [ ] 可以看到更多细节
- [ ] 点击 "Zoom Out" 按钮
- [ ] 波形图缩小

#### 6.4 拖动波形
- [ ] 在波形图上拖动
- [ ] 可以查看不同时间段
- [ ] 播放位置跟随拖动

---

### 阶段 7: 快捷操作 (10 分钟)

#### 7.1 去口头禅
- [ ] 点击 "Remove Fillers" 按钮
- [ ] 系统自动识别口头禅
- [ ] 口头禅标记为删除
- [ ] 可以预览效果

#### 7.2 去静音
- [ ] 点击 "Remove Silence" 按钮
- [ ] 系统自动识别静音片段
- [ ] 静音片段标记为删除
- [ ] 可以调整阈值

---

### 阶段 8: 音频导出 (10-20 分钟)

#### 8.1 开始导出
- [ ] 点击 "Export" 按钮
- [ ] 选择导出格式 (mp3, wav)
- [ ] 选择音质设置
- [ ] 点击确认
- [ ] 看到导出开始提示

#### 8.2 等待导出完成
- [ ] 显示导出进度
- [ ] 导出完成提示
- [ ] 可以下载文件

#### 8.3 验证导出文件
- [ ] 下载导出的音频
- [ ] 播放验证
- [ ] 删除的片段已移除
- [ ] 音质符合预期

**测试 API**:
```bash
# 开始导出
curl -X POST http://localhost:8000/edit-sessions/{session_id}/export

# 获取导出状态
curl http://localhost:8000/exports/{export_id}

# 下载导出文件
curl http://localhost:8000/exports/{export_id}/download -o output.mp3
```

---

### 阶段 9: AI 内容生成 (5-10 分钟)

#### 9.1 生成 Show Notes
- [ ] 点击 "Generate Show Notes" 按钮
- [ ] 看到生成进度
- [ ] Show Notes 显示在右侧面板
- [ ] 内容准确相关

#### 9.2 生成营销文案
- [ ] 点击 "Generate Marketing Copy" 按钮
- [ ] 看到生成进度
- [ ] 营销文案显示
- [ ] 可以复制文本

#### 9.3 自定义提示
- [ ] 输入自定义提示
- [ ] 点击生成
- [ ] 看到自定义内容
- [ ] 内容符合要求

**测试 API**:
```bash
# 生成内容
curl -X POST http://localhost:8000/edit-sessions/{session_id}/content \
  -H "Content-Type: application/json" \
  -H "x-anthropic-key: YOUR_ANTHROPIC_KEY" \
  -d '{"content_type":"show_notes"}'
```

---

## 🐛 常见问题排查

### 问题 1: API Key 无效
**症状**: 转录或内容生成失败  
**解决**:
1. 检查 API Key 是否正确
2. 验证 API Key 权限
3. 检查 API 配额

### 问题 2: 音频上传失败
**症状**: 上传进度卡住或失败  
**解决**:
1. 检查文件格式是否支持
2. 检查文件大小是否超限
3. 检查网络连接
4. 查看浏览器控制台错误

### 问题 3: 转录失败
**症状**: 转录状态一直是 "transcribing"  
**解决**:
1. 检查 OpenAI API Key
2. 检查音频文件质量
3. 查看后端日志
4. 重试转录

### 问题 4: 波形图不显示
**症状**: 波形图区域空白  
**解决**:
1. 检查音频文件是否加载
2. 刷新页面
3. 检查浏览器控制台错误
4. 清除浏览器缓存

### 问题 5: 导出失败
**症状**: 导出一直处理中  
**解决**:
1. 检查编辑操作是否有效
2. 查看后端日志
3. 检查磁盘空间
4. 重试导出

---

## 📊 性能测试

### 1. 上传性能
- [ ] 测试不同大小的文件 (1MB, 10MB, 25MB)
- [ ] 记录上传时间
- [ ] 验证进度显示准确

### 2. 转录性能
- [ ] 测试不同时长的音频 (1分钟, 5分钟, 30分钟)
- [ ] 记录转录时间
- [ ] 验证准确率

### 3. 编辑性能
- [ ] 测试大量编辑操作 (100+)
- [ ] 验证响应速度
- [ ] 检查内存使用

### 4. 导出性能
- [ ] 测试不同时长的导出
- [ ] 记录处理时间
- [ ] 验证文件质量

---

## 🔒 安全测试

### 1. API Key 安全
- [ ] API Keys 不在 URL 中暴露
- [ ] API Keys 不在网络请求中明文传输
- [ ] API Keys 存储在 localStorage
- [ ] 可以清除 API Keys

### 2. 文件上传安全
- [ ] 验证文件类型
- [ ] 限制文件大小
- [ ] 防止恶意文件上传

### 3. CORS 配置
- [ ] 只允许授权的域名
- [ ] 正确的 CORS 头部
- [ ] 预检请求正常

---

## 📝 测试报告模板

```markdown
# 测试报告

**测试日期**: YYYY-MM-DD  
**测试人**: [姓名]  
**版本**: v2.0.0

## 测试环境
- 浏览器: [Chrome/Firefox/Safari] [版本]
- 操作系统: [macOS/Windows/Linux]
- 后端: http://localhost:8000
- 前端: http://localhost:5173

## 测试结果

### 功能测试
- [ ] 初始设置: 通过/失败
- [ ] 项目管理: 通过/失败
- [ ] 音频上传: 通过/失败
- [ ] AI 转录: 通过/失败
- [ ] 词级编辑: 通过/失败
- [ ] 波形图控制: 通过/失败
- [ ] 快捷操作: 通过/失败
- [ ] 音频导出: 通过/失败
- [ ] AI 内容生成: 通过/失败

### 性能测试
- 上传速度: [结果]
- 转录速度: [结果]
- 编辑响应: [结果]
- 导出速度: [结果]

### 发现的问题
1. [问题描述]
   - 严重程度: 高/中/低
   - 复现步骤: [步骤]
   - 预期结果: [描述]
   - 实际结果: [描述]

## 总体评价
[总体评价和建议]
```

---

## 🎯 测试完成标准

所有以下条件都满足才算测试完成:

- [ ] 所有功能测试项通过
- [ ] 没有严重 bug
- [ ] 性能符合预期
- [ ] 安全测试通过
- [ ] 用户体验良好
- [ ] 文档完整准确

---

## 📚 相关文档

- [README.md](README.md) - 项目概览
- [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md) - 验证报告
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 部署指南
- [frontend/QUICKSTART.md](frontend/QUICKSTART.md) - 快速启动

---

**测试指南版本**: v1.0  
**最后更新**: 2026-03-24  
**维护者**: Claude Opus 4.6
