import { Request, Response, NextFunction } from "express";
import { Router } from "express";

// 路由元数据存储
const routeMetadata = new Map<string, RouteMetadata[]>();

interface RouteMetadata {
  method: string;
  path: string;
  propertyKey: string;
  middleware?: any[];
}

/**
 * 基础路由装饰器工厂
 */
function createRouteDecorator(method: string) {
  return (path: string = "", middleware: any[] = []) => {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const className = target.constructor.name;
      const routes = routeMetadata.get(className) || [];
      
      routes.push({
        method,
        path,
        propertyKey,
        middleware
      });
      
      routeMetadata.set(className, routes);
      
      return descriptor;
    };
  };
}

/**
 * HTTP方法装饰器
 */
export const Get = createRouteDecorator("GET");
export const Post = createRouteDecorator("POST");
export const Put = createRouteDecorator("PUT");
export const Delete = createRouteDecorator("DELETE");
export const Patch = createRouteDecorator("PATCH");

/**
 * 控制器装饰器
 */
export function Controller(prefix: string = "") {
  return function (target: any) {
    target.prototype.__prefix = prefix;
    target.prototype.__routes = routeMetadata.get(target.name) || [];
  };
}

/**
 * 中间件装饰器
 */
export function Use(middleware: any[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const className = target.constructor.name;
    const routes = routeMetadata.get(className) || [];
    
    // 找到对应的方法并添加中间件
    const route = routes.find(r => r.propertyKey === propertyKey);
    if (route) {
      route.middleware = [...(route.middleware || []), ...middleware];
    }
    
    return descriptor;
  };
}

/**
 * 参数验证装饰器
 */
export function Validate(schema: any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (req: Request, res: Response, next: NextFunction) {
      // 这里可以添加参数验证逻辑
      // 例如使用 Joi 或其他验证库
      return originalMethod.call(this, req, res, next);
    };
    
    return descriptor;
  };
}

/**
 * 获取路由元数据
 */
export function getRouteMetadata(className: string): RouteMetadata[] {
  return routeMetadata.get(className) || [];
}

/**
 * 清除路由元数据（用于测试）
 */
export function clearRouteMetadata(): void {
  routeMetadata.clear();
} 