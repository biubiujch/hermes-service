import { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: number;
}

export class ResponseHandler {
  /**
   * 成功响应
   */
  static success<T>(res: Response, data?: T, message: string = "Success", statusCode: number = 200): void {
    // 检查响应是否已经发送
    if (res.headersSent) {
      console.warn('Response already sent, skipping success response');
      return;
    }
    
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: Date.now()
    };
    
    res.status(statusCode).json(response);
  }

  /**
   * 错误响应
   */
  static error(res: Response, error: string | Error, statusCode: number = 500): void {
    // 检查响应是否已经发送
    if (res.headersSent) {
      console.warn('Response already sent, skipping error response');
      return;
    }
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : error,
      timestamp: Date.now()
    };
    
    res.status(statusCode).json(response);
  }

  /**
   * 分页响应
   */
  static paginated<T>(
    res: Response, 
    data: T[], 
    page: number, 
    limit: number, 
    total: number,
    message: string = "Success"
  ): void {
    // 检查响应是否已经发送
    if (res.headersSent) {
      console.warn('Response already sent, skipping paginated response');
      return;
    }
    
    const response: ApiResponse<{
      data: T[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }> = {
      success: true,
      data: {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      message,
      timestamp: Date.now()
    };
    
    res.status(200).json(response);
  }
} 