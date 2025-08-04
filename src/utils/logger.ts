import winston from "winston";

const { combine, timestamp, json } = winston.format;

const format = combine(timestamp(), json());

const logger = winston.createLogger({
  level: "info",
  format,
  transports: [new winston.transports.Console()]
});

export default logger;
