// 管理后台简易鉴权：账号 + 密码（明文比 env 即可，写在 .env）
// 鉴权方式：header x-admin-email + x-admin-password
// 适用场景：单管理员、内网访问；不适合公网
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly cfg: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const email = req.headers['x-admin-email'] as string | undefined;
    const password = req.headers['x-admin-password'] as string | undefined;

    const okEmail = this.cfg.get<string>('ADMIN_DEFAULT_EMAIL') || 'admin@example.com';
    const okPwd = this.cfg.get<string>('ADMIN_DEFAULT_PASSWORD') || '';

    if (!okPwd) {
      throw new UnauthorizedException('ADMIN_DEFAULT_PASSWORD not set in .env');
    }
    if (email !== okEmail || password !== okPwd) {
      throw new UnauthorizedException('Invalid admin credentials');
    }
    return true;
  }
}
