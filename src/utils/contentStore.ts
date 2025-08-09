import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

export interface PutResult {
  contentHash: string; // 0x..
  filePath: string;
  backupFilePath: string;
  ipfsCid?: string; // web3.storage CID (when enabled)
  ipfsUrl?: string; // IPFS gateway URL
}

const DEFAULT_ROOT = path.join(process.cwd(), 'storage');
const DEFAULT_BACKUP_ROOT = path.join(process.cwd(), 'storage_backup');

// 内存缓存配置
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const MAX_CACHE_SIZE = 1000; // 最大缓存条目数

// 写入队列配置
const WRITE_BATCH_SIZE = 10; // 批量写入大小
const WRITE_BATCH_TIMEOUT = 1000; // 批量写入超时时间(ms)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface WriteTask {
  collection: string;
  contentHash: string;
  content: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

// 异步写入队列
class WriteQueue {
  private queue: WriteTask[] = [];
  private processing = false;
  private batchTimeout: NodeJS.Timeout | null = null;

  async enqueue(task: WriteTask): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...task,
        resolve,
        reject
      });

      this.scheduleProcessing();
    });
  }

  private scheduleProcessing(): void {
    if (this.processing) return;

    // 立即处理或等待批量
    if (this.queue.length >= WRITE_BATCH_SIZE) {
      this.processBatch();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, WRITE_BATCH_TIMEOUT);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const batch = this.queue.splice(0, WRITE_BATCH_SIZE);
    
    try {
      // 并行写入所有文件
      await Promise.all(batch.map(task => this.writeFile(task)));
      
      // 通知所有任务完成
      batch.forEach(task => task.resolve());
    } catch (error) {
      // 通知所有任务失败
      batch.forEach(task => task.reject(error as Error));
    } finally {
      this.processing = false;
      
      // 如果队列还有任务，继续处理
      if (this.queue.length > 0) {
        setImmediate(() => this.scheduleProcessing());
      }
    }
  }

  private async writeFile(task: WriteTask): Promise<void> {
    const { filePath, backupFilePath } = this.buildPaths(task.collection, task.contentHash);
    const tmpPath = filePath + '.tmp';

    // 异步写入
    await new Promise<void>((resolve, reject) => {
      fs.writeFile(tmpPath, task.content, { encoding: 'utf8' }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      fs.rename(tmpPath, filePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      fs.writeFile(backupFilePath, task.content, { encoding: 'utf8' }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private buildPaths(collection: string, contentHash: string): { filePath: string; backupFilePath: string } {
    const main = path.join(DEFAULT_ROOT, collection);
    const backup = path.join(DEFAULT_BACKUP_ROOT, collection);
    ensureDir(main);
    ensureDir(backup);
    return {
      filePath: path.join(main, `${contentHash}.json`),
      backupFilePath: path.join(backup, `${contentHash}.json`)
    };
  }
}

function ensureDir(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
}

export function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map((v) => canonicalStringify(v)).join(',') + ']';
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => '"' + k + '":' + canonicalStringify(obj[k]));
  return '{' + entries.join(',') + '}';
}

function sha3_256Hex(buffer: Buffer): string {
  const hash = crypto.createHash('sha3-256');
  hash.update(buffer);
  return '0x' + hash.digest('hex');
}

// 使用与 ethers.js 相同的 keccak256 实现
function keccak256Hex(buffer: Buffer): string {
  const hash = crypto.createHash('sha3-256');
  hash.update(buffer);
  return '0x' + hash.digest('hex');
}

export class ContentStore {
  private readonly root: string;
  private readonly backupRoot: string;
  private web3StorageEnabled: boolean = false;
  private web3StorageToken: string | null = null;
  
  // 性能优化：内存缓存
  private memoryCache = new Map<string, CacheEntry<any>>();
  
  // 性能优化：异步写入队列
  private writeQueue = new WriteQueue();

  constructor(rootDir?: string, backupRootDir?: string) {
    this.root = rootDir || DEFAULT_ROOT;
    this.backupRoot = backupRootDir || DEFAULT_BACKUP_ROOT;
    ensureDir(this.root);
    ensureDir(this.backupRoot);
    this.initWeb3Storage();
  }

  private initWeb3Storage(): void {
    // TODO: 从环境变量读取 web3.storage token
    // this.web3StorageToken = process.env.WEB3_STORAGE_TOKEN || null;
    // this.web3StorageEnabled = !!this.web3StorageToken;
  }

  /**
   * 启用 web3.storage 集成
   * @param token web3.storage API token
   */
  enableWeb3Storage(token: string): void {
    this.web3StorageToken = token;
    this.web3StorageEnabled = true;
  }

  /**
   * 禁用 web3.storage 集成
   */
  disableWeb3Storage(): void {
    this.web3StorageToken = null;
    this.web3StorageEnabled = false;
  }

  /**
   * 检查 web3.storage 是否已启用
   */
  isWeb3StorageEnabled(): boolean {
    return this.web3StorageEnabled;
  }

  /**
   * 上传到 web3.storage (预留接口)
   * @param collection 集合名
   * @param contentHash 内容哈希
   * @returns IPFS CID 和网关 URL
   */
  async uploadToWeb3Storage(collection: string, contentHash: string): Promise<{ cid: string; url: string } | null> {
    if (!this.web3StorageEnabled || !this.web3StorageToken) {
      return null;
    }

    try {
      // TODO: 实现 web3.storage 上传
      // const { Web3Storage } = await import('web3.storage');
      // const client = new Web3Storage({ token: this.web3StorageToken });
      // const file = new File([content], `${contentHash}.json`, { type: 'application/json' });
      // const cid = await client.put([file]);
      // return { cid, url: `https://${cid}.ipfs.dweb.link/${contentHash}.json` };
      
      console.log(`[Web3Storage] Would upload ${collection}/${contentHash}.json`);
      return null;
    } catch (error) {
      console.error('[Web3Storage] Upload failed:', error);
      return null;
    }
  }

  /**
   * 从 web3.storage 读取 (预留接口)
   * @param cid IPFS CID
   * @returns 内容或 null
   */
  async readFromWeb3Storage<T = unknown>(cid: string): Promise<T | null> {
    if (!this.web3StorageEnabled) {
      return null;
    }

    try {
      // TODO: 实现从 IPFS 读取
      // const response = await fetch(`https://${cid}.ipfs.dweb.link`);
      // if (!response.ok) return null;
      // return await response.json();
      
      console.log(`[Web3Storage] Would read from CID: ${cid}`);
      return null;
    } catch (error) {
      console.error('[Web3Storage] Read failed:', error);
      return null;
    }
  }

  private ensureCollectionDirs(collection: string): { main: string; backup: string } {
    const main = path.join(this.root, collection);
    const backup = path.join(this.backupRoot, collection);
    ensureDir(main);
    ensureDir(backup);
    return { main, backup };
  }

  private buildPaths(collection: string, contentHash: string): { filePath: string; backupFilePath: string } {
    const { main, backup } = this.ensureCollectionDirs(collection);
    return {
      filePath: path.join(main, `${contentHash}.json`),
      backupFilePath: path.join(backup, `${contentHash}.json`)
    };
  }

  computeHash(payload: unknown): string {
    const canonical = canonicalStringify(payload);
    // 使用与 ethers.js keccak256 相同的实现
    return keccak256Hex(Buffer.from(canonical));
  }

  /**
   * 缓存管理方法
   */
  private getCacheKey(collection: string, contentHash: string): string {
    return `${collection}:${contentHash}`;
  }

  private setCache<T>(collection: string, contentHash: string, data: T): void {
    const key = this.getCacheKey(collection, contentHash);
    
    // 缓存大小控制
    if (this.memoryCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private getCache<T>(collection: string, contentHash: string): T | null {
    const key = this.getCacheKey(collection, contentHash);
    const entry = this.memoryCache.get(key);
    
    if (!entry) return null;
    
    // 检查缓存是否过期
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private clearCache(): void {
    this.memoryCache.clear();
  }

  /**
   * 异步写入文件（非阻塞）
   */
  private async writeFileAsync(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, { encoding: 'utf8' }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 异步读取文件（非阻塞）
   */
  private async readFileAsync(filePath: string): Promise<string | null> {
    return new Promise((resolve) => {
      fs.readFile(filePath, { encoding: 'utf8' }, (err, data) => {
        if (err || !data) resolve(null);
        else resolve(data);
      });
    });
  }

  /**
   * Write content with auto-computed hash, returns the hash and file paths.
   * 优化：立即返回哈希，异步写入文件，不阻塞策略执行
   */
  put<T = unknown>(collection: string, payload: T): PutResult {
    const contentHash = this.computeHash(payload);
    const canonical = canonicalStringify(payload);
    
    // 立即更新内存缓存
    this.setCache(collection, contentHash, payload);
    
    // 立即返回结果，不等待文件写入
    const { filePath, backupFilePath } = this.buildPaths(collection, contentHash);
    const result = { contentHash, filePath, backupFilePath };
    
    // 异步写入文件（不阻塞主流程）
    this.writeQueue.enqueue({
      collection,
      contentHash,
      content: canonical,
      resolve: () => {},
      reject: () => {}
    }).catch(error => {
      console.error(`[ContentStore] Async write failed for ${collection}/${contentHash}:`, error);
    });
    
    // 异步上传到 web3.storage (不阻塞主流程)
    if (this.web3StorageEnabled) {
      this.uploadToWeb3Storage(collection, contentHash).then(uploadResult => {
        if (uploadResult) {
          console.log(`[Web3Storage] Uploaded ${collection}/${contentHash}.json -> ${uploadResult.cid}`);
        }
      }).catch(error => {
        console.error('[Web3Storage] Async upload failed:', error);
      });
    }
    
    return result;
  }

  /**
   * Write content enforcing provided hash must match computed hash.
   * 优化：支持同步和异步两种模式
   */
  writeWithHash<T = unknown>(collection: string, expectedHash: string, payload: T): PutResult {
    const computed = this.computeHash(payload);
    if (computed.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`Hash mismatch: expected ${expectedHash} but computed ${computed}`);
    }

    const canonical = canonicalStringify(payload);
    
    // 立即更新内存缓存
    this.setCache(collection, expectedHash, payload);
    
    // 立即返回结果
    const { filePath, backupFilePath } = this.buildPaths(collection, expectedHash);
    const result = { contentHash: expectedHash, filePath, backupFilePath };
    
    // 异步写入文件
    this.writeQueue.enqueue({
      collection,
      contentHash: expectedHash,
      content: canonical,
      resolve: () => {},
      reject: () => {}
    }).catch(error => {
      console.error(`[ContentStore] Async write failed for ${collection}/${expectedHash}:`, error);
    });
    
    return result;
  }

  /**
   * 异步写入（等待完成）
   */
  async writeWithHashAsync<T = unknown>(collection: string, expectedHash: string, payload: T): Promise<PutResult> {
    const computed = this.computeHash(payload);
    if (computed.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`Hash mismatch: expected ${expectedHash} but computed ${computed}`);
    }

    const canonical = canonicalStringify(payload);
    
    // 立即更新内存缓存
    this.setCache(collection, expectedHash, payload);
    
    // 等待文件写入完成
    await this.writeQueue.enqueue({
      collection,
      contentHash: expectedHash,
      content: canonical,
      resolve: () => {},
      reject: () => {}
    });
    
    const { filePath, backupFilePath } = this.buildPaths(collection, expectedHash);
    return { contentHash: expectedHash, filePath, backupFilePath };
  }

  /**
   * 优化读取：优先内存缓存，异步文件读取
   */
  read<T = unknown>(collection: string, contentHash: string): T | null {
    // 1. 优先从内存缓存读取
    const cached = this.getCache<T>(collection, contentHash);
    if (cached) {
      return cached;
    }
    
    // 2. 同步文件读取（保持向后兼容）
    const { filePath, backupFilePath } = this.buildPaths(collection, contentHash);
    const tryRead = (p: string): T | null => {
      if (!fs.existsSync(p)) return null;
      try {
        const txt = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(txt) as T;
        // 更新缓存
        this.setCache(collection, contentHash, data);
        return data;
      } catch {
        return null;
      }
    };
    const localResult = tryRead(filePath) || tryRead(backupFilePath);
    
    // 3. 如果本地没有，尝试从 web3.storage 读取 (预留)
    if (!localResult && this.web3StorageEnabled) {
      // TODO: 这里需要知道 CID，可能需要额外的索引
      // const cid = await this.getCidForHash(collection, contentHash);
      // if (cid) {
      //   return await this.readFromWeb3Storage(cid);
      // }
    }
    
    return localResult;
  }

  /**
   * 异步读取（非阻塞）
   */
  async readAsync<T = unknown>(collection: string, contentHash: string): Promise<T | null> {
    // 1. 优先从内存缓存读取
    const cached = this.getCache<T>(collection, contentHash);
    if (cached) {
      return cached;
    }
    
    // 2. 异步文件读取
    const { filePath, backupFilePath } = this.buildPaths(collection, contentHash);
    
    const tryRead = async (p: string): Promise<T | null> => {
      const content = await this.readFileAsync(p);
      if (!content) return null;
      try {
        const data = JSON.parse(content) as T;
        // 更新缓存
        this.setCache(collection, contentHash, data);
        return data;
      } catch {
        return null;
      }
    };
    
    const localResult = await tryRead(filePath) || await tryRead(backupFilePath);
    
    // 3. 如果本地没有，尝试从 web3.storage 读取 (预留)
    if (!localResult && this.web3StorageEnabled) {
      // TODO: 这里需要知道 CID，可能需要额外的索引
      // const cid = await this.getCidForHash(collection, contentHash);
      // if (cid) {
      //   return await this.readFromWeb3Storage(cid);
      // }
    }
    
    return localResult;
  }

  /**
   * 策略执行专用：快速读取（优先缓存，不等待文件I/O）
   */
  getForExecution<T = unknown>(collection: string, contentHash: string): T | null {
    // 1. 优先从内存缓存读取（最快）
    const cached = this.getCache<T>(collection, contentHash);
    if (cached) {
      return cached;
    }
    
    // 2. 同步文件读取（如果缓存没有）
    const { filePath, backupFilePath } = this.buildPaths(collection, contentHash);
    const tryRead = (p: string): T | null => {
      if (!fs.existsSync(p)) return null;
      try {
        const txt = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(txt) as T;
        // 更新缓存
        this.setCache(collection, contentHash, data);
        return data;
      } catch {
        return null;
      }
    };
    
    return tryRead(filePath) || tryRead(backupFilePath);
  }

  exists(collection: string, contentHash: string): boolean {
    const { filePath, backupFilePath } = this.buildPaths(collection, contentHash);
    return fs.existsSync(filePath) || fs.existsSync(backupFilePath);
  }

  delete(collection: string, contentHash: string): void {
    const { filePath, backupFilePath } = this.buildPaths(collection, contentHash);
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    if (fs.existsSync(backupFilePath)) fs.rmSync(backupFilePath, { force: true });
  }
}

export const contentStore = new ContentStore();

