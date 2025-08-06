import express, { NextFunction, Express } from "express";
import { getEnvironmentVariable } from "../utils/envPaser";
import { logger } from "../utils/logger";
import router, { RouteRegistry } from "./router";
import { errorHandler } from "./error";

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

  // 注册控制器
  RouteRegistry.registerControllers([
    ExampleController,
    WalletController
  ]);

  // 路由
  app.use(router);

  // 404 处理
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: "接口不存在",
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
