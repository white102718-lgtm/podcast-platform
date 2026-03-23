# 🚀 播客平台快速参考指南

**版本**: v2.0.0  
**更新时间**: 2026-03-24

---

## 📋 快速启动

### 启动服务器

**后端**:
```bash
cd podcast-platform/agent
source .venv/bin/activate  # 如果使用虚拟环境
uvicorn main:app --reload
```

**前端**:
```bash
cd podcast-platform/frontend
npm run dev
```

**访问**:
- 前端: http://localhost:5173
- 后端: http://localhost:8000
- API 文档: http://localhost:8000/docs

---

## 🔧 常用命令

### 数据库

```bash
# 查看数据库状态
psql postgresql://podcast:podcast@localhost:5432/podcast -c "\dt"

# 运行迁移
cd podcast-platform/agent
alembic upgrade head

# 创建新迁移
alembic revision --autogenerate -m "description"
```

### 构建

```bash
# 前端构建
cd podcast-platform/frontend
npm run build

# 前端预览
npm run preview
```

### Git

```bash
# 查看状态
git status

# 提交更改
git add -A
git commit -m "message"
git push origin main

# 查看日志
git log --oneline -10
```

---

## 🧪 测试

### API 测试

```bash
# 健康检查
curl http://localhost:8000/health

# 获取项目列表
curl http://localhost:8000/projects

# 创建项目
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test"}'
```

### CORS 测试

```bash
# 测试 CORS 预检
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: PUT" \
  -I \
  https://pub-b7c7dba1e19847d6bbc000dd7eb356fe.r2.dev/
```

---

## 📊 系统状态

### 检查服务器

```bash
# 检查后端
curl -s http://localhost:8000/health

# 检查前端
curl -s http://localhost:5173 | grep -o "<title>.*</title>"

# 检查 API 代理
curl -s http://localhost:5173/api/health
```

### 检查进程

```bash
# 查看运行中的服务器
ps aux | grep -E "(uvicorn|vite)" | grep -v grep

# 查看端口占用
lsof -i :8000  # 后端
lsof -i :5173  # 前端
```

---

## 🔍 故障排查

### 后端问题

```bash
# 查看后端日志
cd podcast-platform/agent
# 日志会输出到终端

# 检查数据库连接
psql postgresql://podcast:podcast@localhost:5432/podcast -c "SELECT 1"

# 检查环境变量
cat agent/.env
```

### 前端问题

```bash
# 清除 node_modules 重新安装
cd podcast-platform/frontend
rm -rf node_modules package-lock.json
npm install

# 清除构建缓存
rm -rf dist .vite

# 重新构建
npm run build
```

### CORS 问题

```bash
# 验证 CORS 配置
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: PUT" \
  -I \
  https://pub-b7c7dba1e19847d6bbc000dd7eb356fe.r2.dev/

# 应该看到:
# Access-Control-Allow-Origin: http://localhost:5173
# Access-Control-Allow-Methods: PUT, GET, POST, DELETE, HEAD
```

---

## 📁 重要文件路径

### 配置文件

```
podcast-platform/
├── agent/.env                      # 后端环境变量
├── agent/alembic.ini               # 数据库迁移配置
├── frontend/.env.example           # 前端环境变量示例
├── frontend/vite.config.ts         # Vite 配置
├── frontend/tailwind.config.js     # Tailwind 配置
└── docker-compose.yml              # Docker 配置
```

### 文档文件

```
podcast-platform/
├── README.md                       # 项目概览
├── CLAUDE.md                       # Claude 指南
├── VERIFICATION_REPORT.md          # 验证报告
├── CORS_SETUP_COMPLETE.md          # CORS 配置
├── DEPLOYMENT_GUIDE.md             # 部署指南
├── frontend/TESTING_GUIDE.md       # 测试指南
└── frontend/WORK_COMPLETED.md      # 工作报告
```

---

## 🔑 环境变量

### 后端 (agent/.env)

```env
DATABASE_URL=postgresql+asyncpg://podcast:podcast@localhost:5432/podcast
S3_BUCKET=podcast-cut
S3_ENDPOINT_URL=https://...r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
ALLOWED_ORIGINS=http://localhost:5173
S3_PRESIGN_URL=https://...r2.dev
```

### 前端 (frontend/.env)

```env
# 开发环境留空，Vite 代理会处理
VITE_API_BASE_URL=

# 生产环境设置后端 URL
# VITE_API_BASE_URL=https://your-backend.railway.app
```

---

## 🚀 部署

### Vercel (前端)

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
cd podcast-platform/frontend
vercel --prod
```

### Railway (后端)

1. 连接 GitHub 仓库
2. 选择 podcast-platform/agent 目录
3. 设置环境变量
4. 自动部署

---

## 📝 API 端点

### 项目管理

```
GET    /projects              # 获取项目列表
POST   /projects              # 创建项目
GET    /projects/{id}         # 获取项目详情
DELETE /projects/{id}         # 删除项目
```

### 录音管理

```
POST   /projects/{id}/recordings           # 上传录音
GET    /projects/{id}/recordings           # 获取录音列表
GET    /recordings/{id}                    # 获取录音详情
POST   /recordings/{id}/transcribe         # 开始转录
```

### 编辑会话

```
POST   /transcripts/{id}/edit-sessions     # 创建编辑会话
GET    /edit-sessions/{id}                 # 获取会话详情
POST   /edit-sessions/{id}/operations      # 添加编辑操作
GET    /edit-sessions/{id}/operations      # 获取操作列表
POST   /edit-sessions/{id}/export          # 导出音频
```

### 内容生成

```
POST   /edit-sessions/{id}/content         # 生成 AI 内容
```

---

## 🎯 工作流程

### 完整流程

1. **设置 API Keys**
   - OpenAI API Key (Whisper)
   - Anthropic API Key (Claude)

2. **创建项目**
   - POST /projects
   - 输入项目名称和描述

3. **上传音频**
   - POST /projects/{id}/recordings
   - 选择音频文件 (mp3, wav, m4a)

4. **开始转录**
   - POST /recordings/{id}/transcribe
   - 等待转录完成

5. **编辑转录**
   - 创建编辑会话
   - 添加编辑操作 (删除、替换)
   - 预览效果

6. **导出音频**
   - POST /edit-sessions/{id}/export
   - 下载导出文件

7. **生成内容**
   - POST /edit-sessions/{id}/content
   - 生成 Show Notes 或营销文案

---

## 💡 提示和技巧

### 开发技巧

1. **使用热更新**
   - 前端和后端都支持热更新
   - 修改代码后自动刷新

2. **查看 API 文档**
   - 访问 http://localhost:8000/docs
   - 可以直接测试 API

3. **使用浏览器开发工具**
   - F12 打开开发者工具
   - Network 标签查看请求
   - Console 标签查看日志

### 性能优化

1. **音频文件**
   - 建议大小 < 25MB
   - 支持格式: mp3, wav, m4a

2. **转录速度**
   - 1 分钟音频 ≈ 10-30 秒
   - 取决于 OpenAI API 响应速度

3. **导出速度**
   - 取决于编辑操作数量
   - 通常 < 1 分钟

---

## 🔒 安全注意事项

1. **API Keys**
   - 存储在 localStorage
   - 不要提交到 Git
   - 定期更换

2. **环境变量**
   - 不要提交 .env 文件
   - 使用 .env.example 作为模板

3. **CORS 配置**
   - 只允许必要的域名
   - 生产环境更新配置

4. **数据库**
   - 定期备份
   - 使用强密码

---

## 📚 相关资源

### 文档

- [README.md](README.md) - 项目概览
- [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md) - 验证报告
- [CORS_SETUP_COMPLETE.md](CORS_SETUP_COMPLETE.md) - CORS 配置
- [TESTING_GUIDE.md](frontend/TESTING_GUIDE.md) - 测试指南
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 部署指南

### 外部资源

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [React 文档](https://react.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)

---

## 🆘 获取帮助

### 常见问题

1. **CORS 错误**
   - 查看 CORS_SETUP_COMPLETE.md
   - 验证 R2 配置

2. **上传失败**
   - 检查文件大小和格式
   - 查看后端日志

3. **转录失败**
   - 验证 OpenAI API Key
   - 检查音频质量

4. **构建失败**
   - 清除缓存重新安装
   - 检查 Node.js 版本

### 联系方式

- GitHub Issues: https://github.com/white102718-lgtm/podcast-platform/issues
- 项目文档: 查看 README.md

---

**最后更新**: 2026-03-24  
**版本**: v2.0.0  
**状态**: ✅ 生产就绪
