import express, { NextFunction, Express } from "express";
import { getEnvironmentVariable } from "../utils/envPaser";
import { logger } from "../utils/logger";
import router, { RouteRegistry } from "./router";
import { errorHandler } from "./middleware/errorHandler";
import { DuplicateRequestHandler } from "./middleware/duplicateRequestHandler";

// 导入控制器
import { ExampleController, WalletController } from "./controllers";

async function startAPI(): Promise<Express> {
  const app = express();
  const port = getEnvironmentVariable("API_PORT") || 3000;

  // 中间件
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 请求日志中间件
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent")
    });
    next();
  });

  // 重复请求处理中间件 - 全局应用
  // app.use(DuplicateRequestHandler.middleware());

  // 只对非 GET 请求应用防重复处理（推荐）
  app.use(DuplicateRequestHandler.forMethods(['POST', 'PUT', 'DELETE', 'PATCH']));
  
  // 或者只对特定路由应用
  // app.use('/api/wallet', DuplicateRequestHandler.forRoutes(['/api/wallet']));
  
  // 或者只对 GET 请求应用（如果你确实需要）
  // app.use(DuplicateRequestHandler.forGetRequests());

  // 注册控制器
  RouteRegistry.registerControllers([
    ExampleController,
    WalletController
  ]);

  // 路由
  app.use(router);

  // 404 处理
  app.use((req, res, next) => {
    // 检查响应是否已经发送
    if (res.headersSent) {
      return;
    }
    
    res.status(404).json({
      success: false,
      error: "API endpoint not found",
      timestamp: Date.now()
    });
  });

  // 全局错误处理中间件（必须在最后）
  app.use(errorHandler);

  app.listen(port, () => {
    logger.info(`API server is running on port ${port}`);
  });

  return app;
}

export { startAPI };
