import { randomUUID } from 'node:crypto';
export const now = () => new Date().toISOString();

export const uid = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '')}`;

export const parse = <T>(value: unknown, fallback: T): T => {
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_ERROR'
  ) {
    super(message);
  }
}
