import { Request, Response, NextFunction } from "express";
import { ResponseHandler } from "./response";
import { asyncHandler } from "./error";

/**
 * 基础控制器类
 * 所有控制器都应该继承这个类
 */
export abstract class BaseController {
  protected req!: Request;
  protected res!: Response;
  protected next!: NextFunction;

  /**
   * 设置请求上下文
   */
  setContext(req: Request, res: Response, next: NextFunction): void {
    this.req = req;
    this.res = res;
    this.next = next;
  }

  /**
   * 成功响应
   */
  protected success<T>(data?: T, message?: string, statusCode?: number): void {
    ResponseHandler.success(this.res, data, message, statusCode);
  }

  /**
   * 错误响应
   */
  protected error(error: string | Error, statusCode?: number): void {
    ResponseHandler.error(this.res, error, statusCode);
  }

  /**
   * 分页响应
   */
  protected paginated<T>(
    data: T[], 
    page: number, 
    limit: number, 
    total: number,
    message?: string
  ): void {
    ResponseHandler.paginated(this.res, data, page, limit, total, message);
  }

  /**
   * 获取查询参数
   */
  protected getQueryParam(key: string, defaultValue?: any): any {
    return this.req.query[key] || defaultValue;
  }

  /**
   * 获取路径参数
   */
  protected getParam(key: string, defaultValue?: any): any {
    return this.req.params[key] || defaultValue;
  }

  /**
   * 获取请求体
   */
  protected getBody<T = any>(): T {
    return this.req.body;
  }

  /**
   * 获取请求头
   */
  protected getHeader(key: string): string | undefined {
    return this.req.get(key);
  }

  /**
   * 异步方法包装器
   */
  protected async wrapAsync<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.error(error as Error);
      throw error;
    }
  }

  /**
   * 创建异步处理器
   */
  protected createAsyncHandler(method: Function) {
    return asyncHandler((req: Request, res: Response, next: NextFunction) => {
      this.setContext(req, res, next);
      return method.call(this, req, res, next);
    });
  }
} 