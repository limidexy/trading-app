#!/bin/bash
cd /www/wwwroot/trading-app || exit 1

echo ">>> 开始拉取代码..."
git pull origin main

echo ">>> 安装依赖..."
npm install

echo ">>> 项目构建..."
npm run build

echo ">>> 重启服务..."
pm2 restart trading-app
pm2 save

echo ">>> 部署完成！"