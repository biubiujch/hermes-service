import { Request, Response, NextFunction } from "express";

interface PendingRequest {
  timestamp: number;
  requestId: string;
}

/**
 * Duplicate Request Handler Middleware
 * Prevents duplicate requests by checking if the same request is already being processed
 */
export class DuplicateRequestHandler {
  private static pendingRequests = new Map<string, PendingRequest>();
  private static readonly REQUEST_TIMEOUT = 1000; // 1 second
  private static readonly CLEANUP_INTERVAL = 5000; // 5 seconds
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize cleanup interval (only once)
   */
  private static initializeCleanup() {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredRequests();
      }, this.CLEANUP_INTERVAL);
    }
  }

  /**
   * Generate a unique request key
   */
  private static generateRequestKey(req: Request): string {
    const { method, path } = req;
    
    // 简化请求键生成，只基于方法和路径
    // 对于非 GET 请求，添加时间戳来避免误判
    if (method === 'GET') {
      return `${method}:${path}`;
    } else {
      // 对于写操作，使用更宽松的键生成
      const timestamp = Math.floor(Date.now() / 1000); // 1秒精度
      return `${method}:${path}:${timestamp}`;
    }
  }

  /**
   * Clean up expired requests
   */
  private static cleanupExpiredRequests(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        this.pendingRequests.delete(key);
        cleanedCount++;
      }
    }
    
    // 静默清理，减少日志输出
  }

  /**
   * Main middleware function
   */
  static middleware() {
    // Initialize cleanup interval only once
    this.initializeCleanup();

    return (req: Request, res: Response, next: NextFunction) => {
      const requestKey = this.generateRequestKey(req);
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Check if request is already being processed
      if (this.pendingRequests.has(requestKey)) {
        const pendingRequest = this.pendingRequests.get(requestKey)!;
        const timeSinceRequest = Date.now() - pendingRequest.timestamp;
        
        // 简化重复请求日志
        
        const response = {
          success: false,
          error: "Request is already being processed. Please wait.",
          timestamp: Date.now(),
          requestId: pendingRequest.requestId
        };
        
        return res.status(429).json(response);
      }

      // Mark request as being processed
      this.pendingRequests.set(requestKey, {
        timestamp: Date.now(),
        requestId
      });

      // 简化处理日志

      // Remove from pending requests when response is sent
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        DuplicateRequestHandler.pendingRequests.delete(requestKey);
        // 简化完成日志
        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Middleware for specific routes that need duplicate request protection
   */
  static forRoutes(routes: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only apply to specified routes
      if (!routes.some(route => req.path.startsWith(route))) {
        return next();
      }

      return this.middleware()(req, res, next);
    };
  }

  /**
   * Middleware for specific HTTP methods
   */
  static forMethods(methods: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only apply to specified methods
      if (!methods.includes(req.method)) {
        return next();
      }

      return this.middleware()(req, res, next);
    };
  }

  /**
   * Middleware that only applies to GET requests
   */
  static forGetRequests() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') {
        return next();
      }

      return this.middleware()(req, res, next);
    };
  }

  /**
   * Get current pending requests count (for debugging)
   */
  static getPendingRequestsCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Clear all pending requests (for testing)
   */
  static clearAllPendingRequests(): void {
    this.pendingRequests.clear();
    console.log('[DuplicateRequestHandler] All pending requests cleared');
  }
} 