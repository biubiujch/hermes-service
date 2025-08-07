import { Request, Response, NextFunction } from "express";

interface PendingRequest {
  timestamp: number;
}

/**
 * Duplicate Request Handler Middleware
 * Prevents duplicate requests by checking if the same request is already being processed
 */
export class DuplicateRequestHandler {
  private static pendingRequests = new Map<string, PendingRequest>();
  private static readonly REQUEST_TIMEOUT = 5000; // 5 seconds
  private static readonly CLEANUP_INTERVAL = 10000; // 10 seconds

  /**
   * Generate a unique request key
   */
  private static generateRequestKey(req: Request): string {
    const { method, url } = req;
    const userId = req.headers['user-id'] || req.headers['authorization'] || 'anonymous';
    const body = method !== 'GET' ? JSON.stringify(req.body) : '';
    
    return `${method}:${url}:${userId}:${body}`;
  }

  /**
   * Clean up expired requests
   */
  private static cleanupExpiredRequests(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Main middleware function
   */
  static middleware() {
    // Start cleanup interval
    setInterval(() => {
      this.cleanupExpiredRequests();
    }, this.CLEANUP_INTERVAL);

    return (req: Request, res: Response, next: NextFunction) => {
      // Skip GET requests
      if (req.method === 'GET') {
        return next();
      }

      const requestKey = this.generateRequestKey(req);
      
      // Check if request is already being processed
      if (this.pendingRequests.has(requestKey)) {
        const response = {
          success: false,
          error: "Request is already being processed. Please wait.",
          timestamp: Date.now()
        };
        
        return res.status(429).json(response);
      }

      // Mark request as being processed
      this.pendingRequests.set(requestKey, {
        timestamp: Date.now()
      });

      // Remove from pending requests when response is sent
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        DuplicateRequestHandler.pendingRequests.delete(requestKey);
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
} 