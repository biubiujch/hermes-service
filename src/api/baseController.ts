import { Request, Response, NextFunction } from "express";
import { ResponseHandler } from "./utils/responseHandler";
import { asyncHandler } from "./middleware/errorHandler";
import { ethers } from "ethers";
import { appConfig } from "../utils/config";

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
    if (!this.res.headersSent) {
      ResponseHandler.error(this.res, error, statusCode);
    }
  }

  /**
   * 获取路径参数
   */
  protected getParam(key: string, defaultValue?: any): any {
    return this.req.params[key] || defaultValue;
  }

  /**
   * 获取查询参数
   */
  protected getQueryParam(key: string, defaultValue?: any): any {
    return this.req.query[key] || defaultValue;
  }

  /**
   * 获取请求体
   */
  protected getBody<T = any>(): T {
    return this.req.body;
  }

  /**
   * 分页响应
   */
  protected paginated<T>(data: T[], page: number, limit: number, total: number, message?: string): void {
    ResponseHandler.paginated(this.res, data, page, limit, total, message);
  }
}

/**
 * 合约控制器基类
 * 提供通用的合约初始化功能
 */
export abstract class ContractController extends BaseController {
  protected provider: ethers.JsonRpcProvider;
  protected signer: ethers.Signer | null = null;

  constructor() {
    super();
    this.provider = new ethers.JsonRpcProvider(appConfig.getLocalNodeUrl());
    this.initializeSigner();
  }

  /**
   * 初始化签名者
   */
  private async initializeSigner() {
    try {
      const privateKey = appConfig.getFeeCollectorPrivateKey();
      if (privateKey) {
        this.signer = new ethers.Wallet(privateKey, this.provider);
        console.log("Signer initialized with private key");
      } else {
        const accounts = await this.provider.listAccounts();
        if (accounts.length > 0) {
          this.signer = accounts[0];
          console.log("Using first account as signer for testing");
        } else {
          console.warn("No private key configured and no accounts available");
        }
      }
    } catch (error) {
      console.error("Failed to initialize signer:", error);
    }
  }

  /**
   * 创建合约实例
   */
  protected createContract(address: string, abi: any[]): ethers.Contract {
    return new ethers.Contract(address, abi, this.signer || this.provider);
  }

  /**
   * 验证地址格式
   */
  protected validateAddress(address: string, paramName: string = "address"): boolean {
    if (!address || !ethers.isAddress(address)) {
      this.error(`Invalid ${paramName}`, 400);
      return false;
    }
    return true;
  }
} 