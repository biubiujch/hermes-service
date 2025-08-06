import * as fs from 'fs';
import * as path from 'path';

/**
 * 从部署文件中读取合约地址并更新.env文件
 */
function updateEnvFromDeployment() {
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
      console.log('❌ No .env file found. Please create one from env.example');
      return;
    }

    let envContent = fs.readFileSync(envPath, 'utf8');

    // 更新合约地址
    if (contracts.mockToken) {
      envContent = envContent.replace(
        /MOCK_TOKEN_ADDRESS=.*/,
        `MOCK_TOKEN_ADDRESS=${contracts.mockToken}`
      );
      console.log(`✅ Updated MOCK_TOKEN_ADDRESS: ${contracts.mockToken}`);
    }

    if (contracts.vault) {
      envContent = envContent.replace(
        /VAULT_ADDRESS=.*/,
        `VAULT_ADDRESS=${contracts.vault}`
      );
      console.log(`✅ Updated VAULT_ADDRESS: ${contracts.vault}`);
    }

    if (contracts.membership) {
      envContent = envContent.replace(
        /MEMBERSHIP_ADDRESS=.*/,
        `MEMBERSHIP_ADDRESS=${contracts.membership}`
      );
      console.log(`✅ Updated MEMBERSHIP_ADDRESS: ${contracts.membership}`);
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
function showDeploymentInfo() {
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

// 命令行参数处理
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