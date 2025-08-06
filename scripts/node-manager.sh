#!/bin/bash

# 本地 Hardhat 节点管理器 - 基于端口检测，无需 PID 文件
# 使用方法: ./scripts/node-manager.sh [start|stop|restart|status]

PORT=8545

# 检查端口是否被占用
check_port() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 获取占用端口的进程ID
get_port_pid() {
    lsof -ti:$PORT 2>/dev/null
}

# 启动节点
start_node() {
    echo "🔍 检查本地节点状态..."
    
    if check_port; then
        echo "⚠️  本地节点已在端口 $PORT 上运行"
        echo "💡 使用 'pnpm run node:stop' 先停止节点"
        return 1
    fi
    
    echo "🚀 启动本地 Hardhat 节点..."
    
    # 启动 Hardhat 节点到后台
    nohup npx hardhat node > .hardhat-node.log 2>&1 &
    
    # 等待几秒让节点启动
    sleep 3
    
    # 检查是否启动成功
    if check_port; then
        local pid=$(get_port_pid)
        echo "✅ 本地 Hardhat 节点已启动 (PID: $pid)"
        echo "📡 RPC URL: http://127.0.0.1:$PORT"
        echo "🔗 Chain ID: 31337"
        echo "💡 使用 'pnpm run node:stop' 停止节点"
        echo "📋 日志文件: .hardhat-node.log"
    else
        echo "❌ 节点启动失败，请检查日志文件"
        return 1
    fi
}

# 停止节点
stop_node() {
    echo "🛑 停止本地 Hardhat 节点..."
    
    if ! check_port; then
        echo "✅ 节点未运行"
        return 0
    fi
    
    # 获取占用端口的进程ID并停止
    local port_pid=$(get_port_pid)
    if [ ! -z "$port_pid" ]; then
        echo "🔧 停止进程 $port_pid..."
        kill $port_pid
        
        # 等待进程停止
        sleep 2
        
        # 如果进程还在运行，强制停止
        if kill -0 $port_pid 2>/dev/null; then
            echo "🔧 强制停止进程 $port_pid..."
            kill -9 $port_pid
        fi
    fi
    
    # 最终检查
    if check_port; then
        echo "❌ 无法停止节点，请手动检查"
        return 1
    else
        echo "✅ 节点已成功停止"
    fi
}

# 重启节点
restart_node() {
    echo "🔄 重启本地 Hardhat 节点..."
    stop_node
    sleep 2
    start_node
}

# 重置本地环境（重启节点 + 部署合约 + 更新环境）
reset_environment() {
    echo "🔄 重置本地区块链环境..."
    echo "📋 执行步骤:"
    echo "  1. 停止本地节点"
    echo "  2. 启动本地节点"
    echo "  3. 部署合约"
    echo "  4. 更新环境变量"
    echo ""
    
    # 1. 停止节点
    echo "📴 步骤 1: 停止本地节点..."
    stop_node
    sleep 2
    
    # 2. 启动节点
    echo "🚀 步骤 2: 启动本地节点..."
    start_node
    if [ $? -ne 0 ]; then
        echo "❌ 节点启动失败，重置流程终止"
        return 1
    fi
    
    # 3. 等待节点完全就绪
    echo "⏳ 等待节点就绪..."
    sleep 5
    
    # 4. 部署合约
    echo "📦 步骤 3: 部署合约..."
    pnpm contract:deploy
    if [ $? -ne 0 ]; then
        echo "❌ 合约部署失败，重置流程终止"
        return 1
    fi
    
    # 5. 更新环境变量
    echo "🔧 步骤 4: 更新环境变量..."
    pnpm update-env update
    if [ $? -ne 0 ]; then
        echo "❌ 环境变量更新失败，重置流程终止"
        return 1
    fi
    
    echo ""
    echo "✅ 本地环境重置完成！"
    echo "📋 环境信息:"
    echo "   - 本地节点: http://127.0.0.1:$PORT"
    echo "   - 合约地址: deployments/localhost.json"
    echo "   - 环境配置: .env (已更新)"
    echo ""
    echo "💡 下一步: 启动API服务器"
    echo "   pnpm dev"
}

# 显示状态
show_status() {
    echo "📊 本地节点状态:"
    
    if check_port; then
        local port_pid=$(get_port_pid)
        echo "运行状态: ✅ 运行中"
        echo "端口 $PORT: ✅ 被占用"
        echo "进程 ID: $port_pid"
        echo "💡 使用 'pnpm run node:stop' 停止节点"
    else
        echo "运行状态: ❌ 未运行"
        echo "端口 $PORT: ❌ 可用"
        echo "💡 使用 'pnpm run node:start' 启动节点"
    fi
}

# 主函数
main() {
    case "$1" in
        "start")
            start_node
            ;;
        "stop")
            stop_node
            ;;
        "restart")
            restart_node
            ;;
        "reset")
            reset_environment
            ;;
        "status")
            show_status
            ;;
        *)
            echo "使用方法:"
            echo "  pnpm run node:start   - 启动本地 Hardhat 节点"
            echo "  pnpm run node:stop    - 停止本地 Hardhat 节点"
            echo "  pnpm run node:restart - 重启本地 Hardhat 节点"
            echo "  pnpm run node:reset   - 重置本地环境（重启+部署+更新）"
            echo "  pnpm run node:status  - 显示节点状态"
            exit 1
            ;;
    esac
}

main "$@" 