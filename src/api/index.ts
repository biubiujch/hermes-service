import express from "express";
import cors from "cors";
import { responseHandler } from "./middleware/responseHandler";
import { errorHandler } from "./middleware/errorHandler";
import assetPoolRoutes from "./routes/assetPool";

const app = express();

// 中间件
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use("/api/asset-pool", assetPoolRoutes);

// 健康检查
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0"
  });
});

// 根路径
app.get("/", (req, res) => {
  res.json({
    message: "Hermes Service API",
    version: process.env.npm_package_version || "1.0.0",
    endpoints: {
      health: "/health",
      assetPool: "/api/asset-pool"
    }
  });
});

// 中间件
app.use(responseHandler);
app.use(errorHandler);

// 404处理
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found"
  });
});

const PORT = process.env.PORT || 9999;

app.listen(PORT, () => {
  console.log(`🚀 Hermes Service API 运行在端口 ${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  console.log(`💰 资金池API: http://localhost:${PORT}/api/asset-pool`);
});

export default app;
