import * as fs from 'fs';
import * as path from 'path';

/**
 * 从部署文件中读取合约地址并更新.env文件
 */
export function updateEnvFromDeployment() {
  try {
    // 读取部署信息
    const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
    if (!fs.existsSync(deploymentPath)) {
      console.log('❌ No deployment file found. Please run deployment first.');
      return;
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const { contracts } = deployment;

    // 读取.env文件
    const envPath = path.join(__dirname, '../.env');
    if (!fs.existsSync(envPath)) {
      const examplePath = path.join(__dirname, '../env.example');
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, envPath);
        console.log('ℹ️  .env not found. Created from env.example');
      } else {
        // 创建最小化的 .env 文件
        fs.writeFileSync(envPath, '# Auto-generated .env\n');
        console.log('ℹ️  .env not found. Created a new empty .env');
      }
    }

    let envContent = fs.readFileSync(envPath, 'utf8');

    // 工具函数：插入或更新 env 变量（容忍空白）
    const upsertEnvVar = (content: string, key: string, value: string): { updated: string; action: 'updated' | 'inserted' } => {
      const pattern = new RegExp(`^${key}\\s*=.*$`, 'm');
      if (pattern.test(content)) {
        return { updated: content.replace(pattern, `${key}=${value}`), action: 'updated' };
      }
      const needsTrailingNewline = content.length > 0 && !content.endsWith('\n');
      const prefix = needsTrailingNewline ? '\n' : '';
      return { updated: `${content}${prefix}${key}=${value}\n`, action: 'inserted' };
    };

    // 更新合约地址
    if (contracts && contracts.mockToken) {
      const result = upsertEnvVar(envContent, 'MOCK_TOKEN_ADDRESS', String(contracts.mockToken));
      envContent = result.updated;
      console.log(`✅ ${result.action === 'updated' ? 'Updated' : 'Inserted'} MOCK_TOKEN_ADDRESS: ${contracts.mockToken}`);
    }

    if (contracts && contracts.vault) {
      const result = upsertEnvVar(envContent, 'VAULT_ADDRESS', String(contracts.vault));
      envContent = result.updated;
      console.log(`✅ ${result.action === 'updated' ? 'Updated' : 'Inserted'} VAULT_ADDRESS: ${contracts.vault}`);
    }

    if (contracts && contracts.membership) {
      const result = upsertEnvVar(envContent, 'MEMBERSHIP_ADDRESS', String(contracts.membership));
      envContent = result.updated;
      console.log(`✅ ${result.action === 'updated' ? 'Updated' : 'Inserted'} MEMBERSHIP_ADDRESS: ${contracts.membership}`);
    }

    if (contracts && contracts.strategyRegistry) {
      const result = upsertEnvVar(envContent, 'STRATEGY_REGISTRY_ADDRESS', String(contracts.strategyRegistry));
      envContent = result.updated;
      console.log(`✅ ${result.action === 'updated' ? 'Updated' : 'Inserted'} STRATEGY_REGISTRY_ADDRESS: ${contracts.strategyRegistry}`);
    }

    // 可选：从部署文件同步 feeCollector（如果存在）
    if (deployment.feeCollector) {
      const result = upsertEnvVar(envContent, 'FEE_COLLECTOR_ADDRESS', String(deployment.feeCollector));
      envContent = result.updated;
      console.log(`✅ ${result.action === 'updated' ? 'Updated' : 'Inserted'} FEE_COLLECTOR_ADDRESS: ${deployment.feeCollector}`);
    }

    // 写回.env文件
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file updated successfully!');

  } catch (error) {
    console.error('❌ Error updating .env file:', error);
  }
}

/**
 * 显示当前部署的合约地址
 */
export function showDeploymentInfo() {
  try {
    const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
    if (!fs.existsSync(deploymentPath)) {
      console.log('❌ No deployment file found.');
      return;
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log('📋 Current Deployment Info:');
    console.log('='.repeat(40));
    console.log(`Network: ${deployment.network}`);
    console.log(`Deployer: ${deployment.deployer}`);
    console.log(`Timestamp: ${deployment.timestamp}`);
    console.log('\n📦 Contracts:');
    
    Object.entries(deployment.contracts).forEach(([name, address]) => {
      console.log(`  ${name}: ${address}`);
    });

  } catch (error) {
    console.error('❌ Error reading deployment info:', error);
  }
}

// 命令行参数处理（仅当直接运行本文件时）
if (require.main === module) {
  const command = process.argv[2];
  switch (command) {
    case 'update':
      updateEnvFromDeployment();
      break;
    case 'show':
      showDeploymentInfo();
      break;
    default:
      console.log('Usage:');
      console.log('  pnpm run update-env update  - Update .env from deployment');
      console.log('  pnpm run update-env show    - Show deployment info');
      break;
  }
}