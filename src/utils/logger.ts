import { createLogger, transports, format } from "winston";
import dateFns from "date-fns";

// 自定义时间格式
const timestampFormat = format((info) => {
  info.timestamp = dateFns.format(new Date(), "yyyy-MM-dd HH:mm:ss");
  return info;
});

// 日志格式：时间 + 等级 + 消息
const logFormat = format.printf(({ timestamp, level, message }) => {
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
});

export const logger = createLogger({
  level: "info", // 默认等级
  format: format.combine(timestampFormat(), format.splat(), format.simple()),
  transports: [
    // info.log 只收 info 级别（不包含 error）
    new transports.File({
      filename: "logs/info.log",
      level: "info",
      format: format.combine(
        format((info) => (info.level === "info" ? info : false))(), // 只收 info
        timestampFormat(),
        logFormat
      )
    }),

    // error.log 只收 error 级别
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      format: format.combine(
        format((info) => (info.level === "error" ? info : false))(), // 只收 error
        timestampFormat(),
        logFormat
      )
    }),

    // 控制台输出所有 >= info 的日志
    new transports.Console({
      format: format.combine(timestampFormat(), format.colorize(), logFormat)
    })
  ]
});
