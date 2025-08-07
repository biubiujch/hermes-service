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
  private static readonly REQUEST_TIMEOUT = 2000; // 2 seconds for GET requests
  private static readonly CLEANUP_INTERVAL = 10000; // 10 seconds
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
    const { method, url, path } = req;
    const userId = req.headers['user-id'] || req.headers['authorization'] || 'anonymous';
    
    // 对于 GET 请求，包含查询参数
    let requestIdentifier = '';
    if (method === 'GET') {
      // 使用完整的 URL（包含查询参数）
      requestIdentifier = url;
    } else {
      // 对于非 GET 请求，包含请求体
      const body = JSON.stringify(req.body);
      requestIdentifier = `${path}:${body}`;
    }
    
    return `${method}:${requestIdentifier}:${userId}`;
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
    
    if (cleanedCount > 0) {
      console.log(`[DuplicateRequestHandler] Cleaned up ${cleanedCount} expired requests`);
    }
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
        
        console.log(`[DuplicateRequestHandler] Duplicate request detected:`, {
          method: req.method,
          url: req.url,
          requestKey,
          timeSinceRequest: `${timeSinceRequest}ms`,
          pendingRequestId: pendingRequest.requestId
        });
        
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

      console.log(`[DuplicateRequestHandler] Processing request:`, {
        method: req.method,
        url: req.url,
        requestKey,
        requestId
      });

      // Remove from pending requests when response is sent
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        DuplicateRequestHandler.pendingRequests.delete(requestKey);
        console.log(`[DuplicateRequestHandler] Request completed:`, {
          method: req.method,
          url: req.url,
          requestKey,
          requestId
        });
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