import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { ResponseHandler } from "./response";

/**
 * 自定义API错误类
 */
export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 常用错误类型
 */
export class BadRequestError extends ApiError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Not Found") {
    super(message, 404);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = "Conflict") {
    super(message, 409);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = "Validation Error") {
    super(message, 422);
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = "Internal Server Error") {
    super(message, 500);
  }
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 记录错误日志
  logger.error(`Error occurred: ${error.message}`, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    stack: error.stack
  });

  // 如果是自定义API错误
  if (error instanceof ApiError) {
    ResponseHandler.error(res, error, error.statusCode);
    return;
  }

  // 处理其他类型的错误
  if (error.name === "ValidationError") {
    ResponseHandler.error(res, new ValidationError(error.message), 422);
    return;
  }

  if (error.name === "CastError") {
    ResponseHandler.error(res, new BadRequestError("Invalid ID format"), 400);
    return;
  }

  if (error.name === "JsonWebTokenError") {
    ResponseHandler.error(res, new UnauthorizedError("Invalid token"), 401);
    return;
  }

  if (error.name === "TokenExpiredError") {
    ResponseHandler.error(res, new UnauthorizedError("Token expired"), 401);
    return;
  }

  // 默认错误处理
  ResponseHandler.error(res, new InternalServerError(), 500);
}

/**
 * 异步错误处理包装器
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 