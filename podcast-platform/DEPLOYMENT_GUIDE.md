# 🚀 部署指南

## 前端部署

### Vercel 部署（推荐）

#### 1. 准备工作
```bash
cd podcast-platform/frontend
npm run build
```

#### 2. Vercel CLI 部署
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

#### 3. 环境变量配置
在 Vercel Dashboard 中设置：
```
VITE_API_BASE_URL=https://your-backend-url.railway.app/api
```

#### 4. vercel.json 配置
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend-url.railway.app/:path*"
    }
  ]
}
```

---

### Netlify 部署

#### 1. 构建配置
创建 `netlify.toml`：
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend-url.railway.app/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### 2. 环境变量
在 Netlify Dashboard 中设置：
```
VITE_API_BASE_URL=https://your-backend-url.railway.app/api
```

---

### Docker 部署

#### 1. Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 2. nginx.conf
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass https://your-backend-url.railway.app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 3. 构建和运行
```bash
docker build -t podcast-frontend .
docker run -p 80:80 podcast-frontend
```

---

## 后端部署

### Railway 部署（推荐）

#### 1. 准备工作
确保 `agent/` 目录下有：
- `requirements.txt`
- `main.py`
- `alembic.ini`
- `alembic/` 目录

#### 2. Railway CLI 部署
```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 初始化项目
cd podcast-platform/agent
railway init

# 部署
railway up
```

#### 3. 环境变量配置
在 Railway Dashboard 中设置：
```
DATABASE_URL=postgresql://...  # Railway 自动提供
S3_BUCKET=your-bucket-name
S3_ENDPOINT_URL=https://...    # Cloudflare R2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
```

#### 4. nixpacks.toml 配置
```toml
[phases.setup]
nixPkgs = ["python39", "ffmpeg"]

[phases.install]
cmds = ["pip install -r requirements.txt"]

[start]
cmd = "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT"
```

---

## 数据库部署

### Railway PostgreSQL

#### 1. 创建数据库
在 Railway Dashboard 中：
1. 点击 "New" → "Database" → "PostgreSQL"
2. 等待数据库创建完成
3. 复制 `DATABASE_URL`

#### 2. 运行迁移
```bash
cd podcast-platform/agent
export DATABASE_URL="postgresql://..."
alembic upgrade head
```

---

## 对象存储配置

### Cloudflare R2（推荐）

#### 1. 创建 Bucket
1. 登录 Cloudflare Dashboard
2. 进入 R2 → Create Bucket
3. 记录 Bucket 名称

#### 2. 创建 API Token
1. R2 → Manage R2 API Tokens
2. Create API Token
3. 记录 Access Key ID 和 Secret Access Key

#### 3. 配置 CORS
```json
[
  {
    "AllowedOrigins": ["https://your-frontend-url.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 完整部署流程

### 1. 后端部署
```bash
# 1. 部署数据库（Railway）
# 2. 部署后端（Railway）
cd podcast-platform/agent
railway up

# 3. 运行数据库迁移
railway run alembic upgrade head

# 4. 记录后端 URL
# https://your-backend.railway.app
```

### 2. 前端部署
```bash
# 1. 配置环境变量
echo "VITE_API_BASE_URL=https://your-backend.railway.app/api" > .env.production

# 2. 构建
cd podcast-platform/frontend
npm run build

# 3. 部署到 Vercel
vercel --prod

# 4. 记录前端 URL
# https://your-frontend.vercel.app
```

### 3. 配置 CORS
在后端环境变量中设置：
```
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### 4. 测试
1. 访问前端 URL
2. 设置 API Keys
3. 创建项目
4. 上传音频
5. 测试转录和编辑功能

---

## 环境变量清单

### 前端（Vercel）
```env
VITE_API_BASE_URL=https://your-backend.railway.app/api
```

### 后端（Railway）
```env
DATABASE_URL=postgresql://...           # Railway 自动提供
S3_BUCKET=your-bucket-name
S3_ENDPOINT_URL=https://...             # Cloudflare R2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

---

## 监控和日志

### Vercel
- 访问 Vercel Dashboard → 项目 → Logs
- 查看部署日志和运行时日志

### Railway
- 访问 Railway Dashboard → 项目 → Logs
- 查看应用日志和数据库日志

### Cloudflare R2
- 访问 Cloudflare Dashboard → R2 → Metrics
- 查看存储使用情况和请求统计

---

## 性能优化

### 前端优化
1. **代码分割**
   ```typescript
   // 懒加载组件
   const ActionPanel = lazy(() => import('./components/ActionPanel'))
   ```

2. **图片优化**
   - 使用 WebP 格式
   - 添加图片懒加载

3. **缓存策略**
   ```javascript
   // vercel.json
   {
     "headers": [
       {
         "source": "/assets/(.*)",
         "headers": [
           {
             "key": "Cache-Control",
             "value": "public, max-age=31536000, immutable"
           }
         ]
       }
     ]
   }
   ```

### 后端优化
1. **数据库连接池**
   ```python
   # 已在 database.py 中配置
   engine = create_async_engine(
       DATABASE_URL,
       pool_size=20,
       max_overflow=10
   )
   ```

2. **Redis 缓存**（可选）
   ```python
   # 缓存转录结果
   @cache(expire=3600)
   async def get_transcript(recording_id: str):
       ...
   ```

---

## 备份策略

### 数据库备份
```bash
# Railway 自动备份
# 手动备份
railway run pg_dump > backup.sql
```

### 对象存储备份
```bash
# 使用 rclone 备份 R2
rclone sync r2:your-bucket local-backup/
```

---

## 故障排除

### 前端无法连接后端
1. 检查 `VITE_API_BASE_URL` 是否正确
2. 检查后端 CORS 配置
3. 检查 vercel.json 中的 rewrites

### 上传失败
1. 检查 R2 CORS 配置
2. 检查 R2 API Token 权限
3. 检查文件大小限制（200MB）

### 转录失败
1. 检查 OpenAI API Key 是否有效
2. 检查 API Key 余额
3. 检查音频格式是否支持

---

## 成本估算

### Vercel（免费层）
- 带宽：100GB/月
- 构建时间：6000 分钟/月
- 适合：个人项目和小团队

### Railway（免费层）
- $5 免费额度/月
- 适合：开发和测试

### Cloudflare R2
- 存储：10GB 免费
- 请求：1000 万次/月免费
- 适合：中小型项目

### 总成本
- 免费层：$0/月
- 生产环境：约 $20-50/月

---

## 安全检查清单

- [ ] API Keys 不在代码中硬编码
- [ ] 环境变量正确配置
- [ ] CORS 正确配置
- [ ] HTTPS 启用
- [ ] 数据库连接加密
- [ ] 对象存储访问控制
- [ ] 定期备份数据
- [ ] 监控异常访问

---

## 部署后验证

### 1. 功能测试
- [ ] 前端页面正常加载
- [ ] API Keys 设置正常
- [ ] 项目创建正常
- [ ] 音频上传正常
- [ ] 转录功能正常
- [ ] 编辑功能正常
- [ ] 导出功能正常

### 2. 性能测试
- [ ] 首次加载 < 3s
- [ ] API 响应 < 1s
- [ ] 上传速度正常
- [ ] 转录速度正常

### 3. 安全测试
- [ ] HTTPS 正常工作
- [ ] CORS 正确配置
- [ ] API Keys 不泄露
- [ ] 文件访问控制正常

---

## 持续集成/部署（CI/CD）

### GitHub Actions 配置
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend
```

---

**部署完成后，访问你的应用：**
- 前端：https://your-frontend.vercel.app
- 后端：https://your-backend.railway.app
- API 文档：https://your-backend.railway.app/docs

🎉 **恭喜！你的播客平台已成功部署！**
