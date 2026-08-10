export interface IdempotentResult<T> {
  isDuplicate: boolean;
  data: T;
}

export class IdempotencyService {
  private static store = new Map<string, { endpoint: string; response: any; statusCode: number; createdAt: Date }>();

  public static async check(idempotencyKey: string, endpoint: string): Promise<{ responseBody: any } | null> {
    if (!idempotencyKey) return null;
    const item = this.store.get(idempotencyKey);
    if (item) {
      return { responseBody: item.response };
    }
    return null;
  }

  public static async saveKey(idempotencyKey: string, endpoint: string, responseBody: any, statusCode: number = 200): Promise<void> {
    if (!idempotencyKey) return;
    this.store.set(idempotencyKey, {
      endpoint,
      response: responseBody,
      statusCode,
      createdAt: new Date(),
    });
  }

  public static async record(idempotencyKey: string, endpoint: string, responseBody: any, statusCode: number = 200): Promise<void> {
    return this.saveKey(idempotencyKey, endpoint, responseBody, statusCode);
  }

  public static async executeIdempotent<T>(
    idempotencyKey: string,
    endpoint: string,
    operation: () => Promise<T>
  ): Promise<IdempotentResult<T>> {
    if (!idempotencyKey) {
      const data = await operation();
      return { isDuplicate: false, data };
    }

    if (this.store.has(idempotencyKey)) {
      const cached = this.store.get(idempotencyKey)!;
      return {
        isDuplicate: true,
        data: cached.response as T,
      };
    }

    const data = await operation();
    this.store.set(idempotencyKey, {
      endpoint,
      response: data,
      statusCode: 200,
      createdAt: new Date(),
    });

    return { isDuplicate: false, data };
  }

  public static clear(): void {
    this.store.clear();
  }

  public static hasKey(idempotencyKey: string): boolean {
    return this.store.has(idempotencyKey);
  }
}
