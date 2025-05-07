# 域名安全监控系统

一个基于 Next.js 和 Google Safe Browsing API 的域名安全监控系统，可以实时监控域名的安全状态，及时发现潜在威胁。

## 功能特点

- 实时监控域名安全状态
- 支持批量添加和检查域名
- 自动定期检查域名状态
- 详细的运行日志记录
- 美观的用户界面
- 支持深色模式

## 技术栈

- Next.js 13+
- React 18+
- TypeScript
- Tailwind CSS
- Google Safe Browsing API

## 安装步骤

1. 克隆项目

```bash
git clone https://github.com/yourusername/domain-security-monitor.git
cd domain-security-monitor
```

2. 安装依赖

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

3. 配置环境变量

复制 `.env.example` 文件为 `.env.local`，并填写必要的配置：

```bash
cp .env.example .env.local
```

在 `.env.local` 文件中配置你的 Google Safe Browsing API 密钥：

```
NEXT_PUBLIC_GOOGLE_SAFE_BROWSING_API_KEY=your_api_key_here
```

4. 启动开发服务器

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用说明

1. 添加域名
   - 在输入框中输入要监控的域名
   - 点击"添加域名"按钮

2. 查看域名状态
   - 安全状态：显示域名的安全状态（安全/不安全/部分安全）
   - Spamhaus 状态：显示域名是否被列入黑名单
   - 最后检查时间：显示上次检查的时间

3. 手动检查
   - 点击域名卡片上的"立即检查"按钮可以手动触发检查

4. 删除域名
   - 点击域名卡片上的删除按钮可以移除域名

## 开发说明

### 项目结构

```
src/
  ├── components/     # React 组件
  ├── hooks/         # 自定义 Hooks
  ├── services/      # API 服务
  ├── types/         # TypeScript 类型定义
  └── utils/         # 工具函数
```

### 主要文件说明

- `src/components/DomainDashboard.tsx`: 主面板组件
- `src/components/DomainCard.tsx`: 域名卡片组件
- `src/hooks/useDomainStore.ts`: 域名状态管理 Hook
- `src/services/securityCheckService.ts`: 安全检查服务
- `src/types/domain.ts`: 域名相关类型定义
- `src/utils/domainUtils.ts`: 域名工具函数

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件 