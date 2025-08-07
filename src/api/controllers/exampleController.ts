import { Request, Response, NextFunction } from "express";
import { Controller, Get, Post, Put, Delete } from "../decorators";
import { BaseController } from "../baseController";
import { asyncHandler } from "../middleware/errorHandler";

interface ExampleData {
  id: number;
  name: string;
  description: string;
}

/**
 * 示例控制器
 * 展示如何使用装饰器和基础控制器类
 */
@Controller("/api/example")
export class ExampleController extends BaseController {
  
  // 模拟数据
  private data: ExampleData[] = [
    { id: 1, name: "示例1", description: "这是第一个示例" },
    { id: 2, name: "示例2", description: "这是第二个示例" }
  ];

  /**
   * GET /api/example/search
   * 搜索示例数据
   */
  @Get("/search")
  async search(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const query = this.getQueryParam("q", "");
      
      if (!query) {
        this.error("搜索关键词不能为空", 400);
        return;
      }
      
      const results = this.data.filter(item => 
        item.name.includes(query) || item.description.includes(query)
      );
      
      this.success(results, `搜索到 ${results.length} 条结果`);
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * GET /api/example
   * 获取所有示例数据
   */
  @Get()
  async getList(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const page = parseInt(this.getQueryParam("page", "1"));
      const limit = parseInt(this.getQueryParam("limit", "10"));
      
      // 模拟分页
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedData = this.data.slice(start, end);
      
      this.paginated(paginatedData, page, limit, this.data.length, "获取示例列表成功");
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * GET /api/example/:id
   * 根据ID获取示例数据
   */
  @Get("/:id")
  async getById(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const id = parseInt(this.getParam("id"));
      const item = this.data.find(d => d.id === id);
      
      if (!item) {
        this.error("Example data not found", 404);
        return;
      }
      
      this.success(item, "Example data retrieved successfully");
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * POST /api/example
   * 创建新的示例数据
   */
  @Post()
  async create(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const body = this.getBody<Partial<ExampleData>>();
      
      if (!body.name || !body.description) {
        this.error("Name and description cannot be empty", 400);
        return;
      }
      
      const newItem: ExampleData = {
        id: this.data.length + 1,
        name: body.name,
        description: body.description
      };
      
      this.data.push(newItem);
      this.success(newItem, "Example data created successfully", 201);
    } catch (error) {
      this.error(error as Error);
      // 不要抛出错误，避免被错误处理中间件重复处理
      return;
    }
  }

  /**
   * PUT /api/example/:id
   * 更新示例数据
   */
  @Put("/:id")
  async update(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const id = parseInt(this.getParam("id"));
      const body = this.getBody<Partial<ExampleData>>();
      
      const index = this.data.findIndex(d => d.id === id);
      if (index === -1) {
        this.error("Example data not found", 404);
        return;
      }
      
      this.data[index] = { ...this.data[index], ...body };
      this.success(this.data[index], "Example data updated successfully");
    } catch (error) {
      this.error(error as Error);
      // 不要抛出错误，避免被错误处理中间件重复处理
      return;
    }
  }

  /**
   * DELETE /api/example/:id
   * 删除示例数据
   */
  @Delete("/:id")
  async delete(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const id = parseInt(this.getParam("id"));
      const index = this.data.findIndex(d => d.id === id);
      
      if (index === -1) {
        this.error("Example data not found", 404);
        return;
      }
      
      const deletedItem = this.data.splice(index, 1)[0];
      this.success(deletedItem, "Example data deleted successfully");
    } catch (error) {
      this.error(error as Error);
      // 不要抛出错误，避免被错误处理中间件重复处理
      return;
    }
  }
} 