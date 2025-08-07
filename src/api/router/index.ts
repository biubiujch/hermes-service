import { Router, Request, Response, NextFunction } from "express";
import { logger } from "../../utils/logger";
import { getRouteMetadata } from "../decorators";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

/**
 * 路由注册器
 * 用于自动注册控制器中的路由
 */
export class RouteRegistry {
  private static controllers: Map<string, any> = new Map();

  /**
   * 注册控制器
   */
  static registerController(controllerClass: any): void {
    const controllerName = controllerClass.name;
    const controller = new controllerClass();
    
    this.controllers.set(controllerName, controller);
    
    // 获取路由元数据
    const routes = getRouteMetadata(controllerName);
    const prefix = (controller as any).__prefix || "";
    
          // 注册路由
      routes.forEach(route => {
        const fullPath = prefix + route.path;
        const method = route.method.toLowerCase();
        const handler = controller[route.propertyKey].bind(controller);
        
        // 使用 asyncHandler 包装异步处理器
        const wrappedHandler = asyncHandler(handler);
        
        switch (method) {
          case 'get':
            router.get(fullPath, ...(route.middleware || []), wrappedHandler);
            break;
          case 'post':
            router.post(fullPath, ...(route.middleware || []), wrappedHandler);
            break;
          case 'put':
            router.put(fullPath, ...(route.middleware || []), wrappedHandler);
            break;
          case 'delete':
            router.delete(fullPath, ...(route.middleware || []), wrappedHandler);
            break;
          case 'patch':
            router.patch(fullPath, ...(route.middleware || []), wrappedHandler);
            break;
          default:
            logger.error(`Unsupported HTTP method: ${method}`);
            return;
        }
        
        logger.info(`Registered route: ${method.toUpperCase()} ${fullPath}`);
      });
  }

  /**
   * 注册多个控制器
   */
  static registerControllers(controllers: any[]): void {
    controllers.forEach(controller => this.registerController(controller));
  }

  /**
   * 获取所有注册的控制器
   */
  static getControllers(): Map<string, any> {
    return this.controllers;
  }

  /**
   * 清除所有控制器（用于测试）
   */
  static clear(): void {
    this.controllers.clear();
  }
}

/**
 * 手动注册路由的便捷方法
 */
export function registerRoute(
  method: string,
  path: string,
  handler: (req: Request, res: Response, next: NextFunction) => void,
  middleware: any[] = []
): void {
  const methodLower = method.toLowerCase();
  
  // 使用 asyncHandler 包装异步处理器
  const wrappedHandler = asyncHandler(handler);
  
  switch (methodLower) {
    case 'get':
      router.get(path, ...middleware, wrappedHandler);
      break;
    case 'post':
      router.post(path, ...middleware, wrappedHandler);
      break;
    case 'put':
      router.put(path, ...middleware, wrappedHandler);
      break;
    case 'delete':
      router.delete(path, ...middleware, wrappedHandler);
      break;
    case 'patch':
      router.patch(path, ...middleware, wrappedHandler);
      break;
    default:
      logger.error(`Unsupported HTTP method: ${method}`);
      return;
  }
  
  logger.info(`Registered route: ${method.toUpperCase()} ${path}`);
}

export default router;
