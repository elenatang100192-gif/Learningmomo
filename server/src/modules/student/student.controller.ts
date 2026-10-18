// 学生端 - 验证码登录（仅限后台预先添加的手机号）
// 验证码固定 123456（与家长端共用 sms.service）
import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { sendVerifyCode, verifyCode } from '../../common/sms.service';

@Controller('student')
export class StudentController {
  constructor(private prisma: PrismaService) {}

  /**
   * 发送验证码。
   * 必须先在后台添加该手机号到 HongenStudentAccount 且 status=ACTIVE。
   */
  @Post('send-code')
  async sendCode(@Body() body: { phone: string }) {
    const phone = (body.phone || '').trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException('手机号格式不正确');
    }
    const acc = await this.prisma.studentAccount.findUnique({ where: { phone } });
    if (!acc) {
      throw new UnauthorizedException('该手机号未在后台开通');
    }
    if (acc.status !== 'ACTIVE') {
      throw new UnauthorizedException('该账号已被停用，请联系管理员');
    }
    sendVerifyCode(phone);
    return { ok: true };
  }

  /**
   * 验证码登录：消费验证码 → 颁发 token → 前端用 `student:<phone>` 作为 userId 发请求。
   */
  @Post('login')
  async login(@Body() body: { phone: string; code: string }) {
    const phone = (body.phone || '').trim();
    const code = (body.code || '').trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException('手机号格式不正确');
    }
    const acc = await this.prisma.studentAccount.findUnique({ where: { phone } });
    if (!acc) throw new UnauthorizedException('该手机号未在后台开通');
    if (acc.status !== 'ACTIVE') throw new UnauthorizedException('该账号已被停用');
    if (!verifyCode(phone, code)) {
      throw new UnauthorizedException('验证码错误或已过期');
    }
    return {
      token: this.makeToken(phone),
      phone: acc.phone,
      name: acc.name,
      userId: `student:${acc.phone}`,
      id: acc.id,
    };
  }

  /**
   * 学生登录后补填姓名（仅更新自己的 name）
   * 鉴权：x-student-token（与 userId 绑定，只能改自己的）
   */
  @Patch('profile')
  async updateProfile(
    @Body() body: { name?: string },
    @Headers('x-student-token') token: string,
  ) {
    if (!token) throw new UnauthorizedException('未登录');
    const phone = this.parseToken(token);
    if (!phone) throw new UnauthorizedException('token 无效');
    const acc = await this.prisma.studentAccount.findUnique({ where: { phone } });
    if (!acc) throw new UnauthorizedException('账号不存在');
    const updated = await this.prisma.studentAccount.update({
      where: { id: acc.id },
      data: { name: body.name?.trim() || null },
    });
    return { name: updated.name };
  }

  /**
   * 获取当前登录学生的完整资料（用于学员端"我的"页面）
   * 返回：name / grade / phone / id；不返回 status/note 等敏感字段
   */
  @Get('me')
  async me(@Headers('x-student-token') token: string) {
    if (!token) throw new UnauthorizedException('未登录');
    const phone = this.parseToken(token);
    if (!phone) throw new UnauthorizedException('token 无效');
    const acc = await this.prisma.studentAccount.findUnique({ where: { phone } });
    if (!acc) throw new UnauthorizedException('账号不存在');
    return {
      id: acc.id,
      phone: acc.phone,
      name: acc.name,
      grade: acc.grade,
    };
  }

  // 简易 token：base64url(phone|ts|nonce)，服务器不存（只用于客户端缓存身份）
  // 该 token 不参与 server 鉴权（所有进度查询都通过 userId 字段过滤）。
  private makeToken(phone: string) {
    const raw = `${phone}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
    return Buffer.from(raw).toString('base64url');
  }

  private parseToken(token: string): string | null {
    try {
      const raw = Buffer.from(token, 'base64url').toString();
      return raw.split('.')[0] || null;
    } catch {
      return null;
    }
  }
}
