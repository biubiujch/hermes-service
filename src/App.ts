export default class App {
  public static modules: Map<string, any> = new Map();

  public static registerModule<T>(name: string, module: T): void {
    App.modules.set(name, module);
  }

  public static getModule<T>(name: string): T | undefined {
    return App.modules.get(name);
  }

  public static start() {}
  
  public static stop() {}
}
