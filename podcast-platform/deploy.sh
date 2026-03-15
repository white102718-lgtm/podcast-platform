#!/bin/bash
set -e

echo "🚀 Podcast Platform 部署脚本"
echo "================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "README.md" ] || [ ! -d "agent" ] || [ ! -d "frontend" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

echo "📦 第一步：Railway 后端部署"
echo "----------------------------"
echo ""
echo "请先在浏览器完成 Railway 登录："
echo "  railway login"
echo ""
read -p "登录完成后按回车继续..."

cd agent

# 初始化 Railway 项目
echo ""
echo "正在初始化 Railway 项目..."
railway init --name podcast-platform-agent 2>/dev/null || railway link

# 添加 PostgreSQL
echo ""
echo "正在添加 PostgreSQL 数据库..."
railway add --database postgres 2>/dev/null || echo "PostgreSQL 已存在"

# 设置环境变量
echo ""
echo "⚙️  配置环境变量"
echo ""
echo "请输入 Cloudflare R2 配置："
read -p "S3_BUCKET (bucket 名称): " S3_BUCKET
read -p "S3_ENDPOINT_URL (https://账号ID.r2.cloudflarestorage.com): " S3_ENDPOINT_URL
read -p "AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY_ID
read -p "AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY

railway variables set \
  S3_BUCKET="$S3_BUCKET" \
  S3_ENDPOINT_URL="$S3_ENDPOINT_URL" \
  AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  ALLOWED_ORIGINS="*"

# 部署
echo ""
echo "🚀 正在部署后端到 Railway..."
railway up --detach

# 获取域名
echo ""
echo "正在生成 Railway 域名..."
railway domain 2>/dev/null || echo "域名已存在"

echo ""
echo "✅ Railway 后端部署完成！"
echo ""
RAILWAY_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | cut -d'"' -f4 || echo "")
if [ -n "$RAILWAY_URL" ]; then
    echo "后端地址: $RAILWAY_URL"
else
    echo "请运行 'railway status' 查看后端地址"
fi

cd ..

echo ""
echo "📦 第二步：Vercel 前端部署"
echo "----------------------------"
echo ""
echo "请先在浏览器完成 Vercel 登录："
echo "  vercel login"
echo ""
read -p "登录完成后按回车继续..."

cd frontend

# 部署到 Vercel
echo ""
echo "🚀 正在部署前端到 Vercel..."
vercel --prod --yes

# 设置环境变量
echo ""
if [ -n "$RAILWAY_URL" ]; then
    echo "正在设置 VITE_API_BASE_URL=$RAILWAY_URL"
    echo "$RAILWAY_URL" | vercel env add VITE_API_BASE_URL production
else
    echo "请手动设置环境变量："
    echo "  vercel env add VITE_API_BASE_URL production"
    echo "  输入值：你的 Railway 后端地址"
fi

# 重新部署
echo ""
echo "🚀 重新部署前端（应用环境变量）..."
vercel --prod --yes

echo ""
echo "✅ Vercel 前端部署完成！"
VERCEL_URL=$(vercel ls --json 2>/dev/null | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
if [ -n "$VERCEL_URL" ]; then
    echo "前端地址: https://$VERCEL_URL"
fi

cd ..

# 更新 Railway CORS
if [ -n "$VERCEL_URL" ]; then
    echo ""
    echo "📝 第三步：更新 Railway CORS 配置"
    echo "----------------------------"
    cd agent
    railway variables set ALLOWED_ORIGINS="https://$VERCEL_URL"
    echo "✅ CORS 配置已更新"
    cd ..
fi

echo ""
echo "🎉 部署完成！"
echo "================================"
echo ""
if [ -n "$VERCEL_URL" ]; then
    echo "🌐 访问你的应用: https://$VERCEL_URL"
fi
echo ""
echo "📝 下一步："
echo "  1. 打开应用网址"
echo "  2. 点击右上角 '⚙ Set API Keys'"
echo "  3. 填入你的 OpenAI 和 Anthropic API Key"
echo "  4. 开始使用！"
echo ""
