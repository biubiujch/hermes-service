import { Request, Response, NextFunction } from "express";

export const responseHandler = (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    data: res.locals.data
  });
};
