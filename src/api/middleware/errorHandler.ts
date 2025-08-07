import { Request, Response, NextFunction } from "express";
import { logger } from "../../utils/logger";
import { ResponseHandler } from "../utils/responseHandler";
import { 
  ApiError, 
  BadRequestError, 
  UnauthorizedError, 
  ValidationError, 
  InternalServerError 
} from "../utils/errors";

/**
 * Global Error Handling Middleware
 */
export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 检查响应是否已经发送
  if (res.headersSent) {
    return;
  }

  // Log error
  logger.error(`Error occurred: ${error.message}`, {
    url: req.url,
    method: req.method,
    stack: error.stack
  });

  // Handle custom API errors
  if (error instanceof ApiError) {
    ResponseHandler.error(res, error, error.statusCode);
    return;
  }

  // Handle common errors
  if (error.name === "ValidationError") {
    ResponseHandler.error(res, new ValidationError(error.message), 422);
    return;
  }

  if (error.name === "CastError") {
    ResponseHandler.error(res, new BadRequestError("Invalid ID format"), 400);
    return;
  }

  // Default error handling
  ResponseHandler.error(res, new InternalServerError(), 500);
}

/**
 * Async Error Handler Wrapper
 * Utility function to wrap async handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 