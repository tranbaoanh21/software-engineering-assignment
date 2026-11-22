import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class LoginThrottle {
  private readonly attempts = new Map<string, { count: number; expiresAt: number }>();

  check(ip: string, username: string) {
    const now = Date.now();
    this.prune(now);

    this.consume('ip:' + ip, 60, now);
    this.consume('account:' + username, 10, now);
  }

  checkRegistration(ip: string) {
    const now = Date.now();
    this.prune(now);
    this.consume('registration:' + ip, 10, now, 'Vui lòng thử đăng ký lại sau một phút');
  }

  private prune(now: number) {
    if (this.attempts.size >= 1024) {
      for (const [key, item] of this.attempts) {
        if (item.expiresAt <= now) this.attempts.delete(key);
      }
    }
  }

  private consume(key: string, limit: number, now: number, message = 'Vui lòng thử đăng nhập lại sau một phút') {
    const entry = this.attempts.get(key);
    if (entry && entry.expiresAt > now) {
      if (entry.count >= limit) this.reject(message);
      entry.count++;
      return;
    }
    if (this.attempts.size >= 2048 && !entry) this.reject(message);
    this.attempts.set(key, { count: 1, expiresAt: now + 60_000 });
  }

  private reject(message: string): never {
    throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
