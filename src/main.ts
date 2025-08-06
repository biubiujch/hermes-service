import dotenv from "dotenv";
dotenv.config();
import { logger } from "./utils/logger";
import { startAPI } from "./api";

export class App {
  public static modules: Map<string, any> = new Map();

  public static registerModule<T>(name: string, module: T): void {
    App.modules.set(name, module);
  }

  public static getModule<T>(name: string): T | undefined {
    return App.modules.get(name);
  }

  public static async start() {
    try {
      const API = await startAPI();
      App.registerModule("API", API);
      console.log("app started");
    } catch (e) {
      console.error(e);
    }
  }

  public static stop() {}
}

App.start();

process.on("uncaughtException", (err) => {
  logger.error("system error", err);
  // process.exit(1);
});
