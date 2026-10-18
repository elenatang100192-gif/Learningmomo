import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Post, Req } from '@nestjs/common';
import { ParentService } from './parent.service';
import { sendVerifyCode, verifyCode } from '../../common/sms.service';

@Controller('parent')
export class ParentController {
  constructor(private readonly svc: ParentService) {}

  @Post('send-code')
  sendCode(@Body() body: { phone: string }) {
    sendVerifyCode(body.phone);
    return { ok: true };
  }

  @Post('verify-register')
  verifyRegister(
    @Body() body: { phone: string; code: string; childNickname: string; childAge?: number },
  ) {
    if (!verifyCode(body.phone, body.code)) {
      throw new BadRequestException('验证码错误或已过期');
    }
    return this.svc.verifyRegister(
      body.phone,
      body.childNickname,
      body.childAge,
    );
  }

  // 只验证验证码是否正确（不消费，用于第三步前的检查）
  @Post('check-code')
  checkCode(@Body() body: { phone: string; code: string }) {
    const ok = verifyCode(body.phone, body.code);
    if (!ok) {
      throw new BadRequestException('验证码错误或已过期');
    }
    // 验证通过，重置一下验证码（延长有效期到注册完成）
    sendVerifyCode(body.phone);
    return { ok: true };
  }

  @Post('register')
  reg(@Body() body: { phone: string; password: string; nickname?: string }) {
    return this.svc.register(body.phone, body.password, body.nickname);
  }

  @Post('login')
  login(@Body() body: { phone: string; password: string }) {
    return this.svc.login(body.phone, body.password);
  }

  // 以下用 x-parent-token 头校验
  @Get('children')
  list(@Req() req: any) {
    return this.svc.listChildren(req.headers['x-parent-token'] as string);
  }

  @Post('children')
  add(@Req() req: any, @Body() body: { nickname: string; ageYears?: number; level?: string; avatar?: string }) {
    return this.svc.addChild(req.headers['x-parent-token'] as string, body);
  }

  @Delete('children/:id')
  del(@Req() req: any, @Param('id') id: string) {
    return this.svc.removeChild(req.headers['x-parent-token'] as string, id);
  }

  @Get('report/:childId')
  report(@Req() req: any, @Param('childId') childId: string) {
    return this.svc.report(req.headers['x-parent-token'] as string, childId);
  }
}