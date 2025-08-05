# Hermes Service

区块链资金池管理服务

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动本地节点
npm run node

# 部署所有合约（新终端）
npm run deploy

# 启动服务
npm run dev
```

## 常用命令

### 开发
```bash
npm run dev          # 启动开发服务器
npm run compile      # 编译合约
npm run test         # 运行测试
npm run node         # 启动本地节点
```

### 部署
```bash
npm run deploy                    # 部署所有合约到 localhost
npm run deploy:smart             # 智能部署（同上）
npm run deploy:smart localhost   # 部署到 localhost
npm run deploy:smart localhost AssetPool  # 只部署 AssetPool
```

### 管理
```bash
npm run manage                   # 查看手续费收集地址
npm run manage:change            # 更改手续费收集地址
```

### 代码质量
```bash
npm run lint                     # 代码检查
npm run lint:fix                 # 自动修复
npm run format                   # 格式化代码
npm run clean                    # 清理缓存
```

## 添加新合约

1. 在 `contracts/` 目录添加合约文件
2. 在 `deploy.config.js` 中配置合约信息
3. 创建部署脚本 `scripts/deploy-{contract-name}.ts`
4. 使用 `npm run deploy:smart` 部署

## 环境变量

复制 `env.example` 到 `.env` 并配置：

```bash
# 手续费收集地址
FEE_COLLECTOR_ADDRESS=0x1234...

# 合约地址（部署后自动生成）
LOCALHOST_CONTRACT_ADDRESS=0x5678...
```

## API 文档

启动服务后访问：`http://localhost:9999`

- `GET /api/asset-pool/networks` - 获取支持的网络
- `POST /api/asset-pool/localhost/deposit/prepare` - 准备存款交易
- `POST /api/asset-pool/localhost/withdraw/prepare` - 准备提款交易 