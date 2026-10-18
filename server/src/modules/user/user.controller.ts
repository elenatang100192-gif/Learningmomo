import { Controller, Get, Req, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// 极简"用户"：通过 header x-user-id 标识学生身份，配合进度模块使用。
@Controller('user')
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@Req() req: any) {
    const userId = (req.headers['x-user-id'] as string) || `anon_${Date.now()}`;
    return { userId };
  }

  @Get('stars')
  async stars(@Req() req: any) {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw new BadRequestException('missing x-user-id');
    const agg = await this.prisma.userProgress.aggregate({
      where: { userId, status: 'COMPLETED' },
      _sum: { starsEarned: true },
    });
    return { total: agg._sum.starsEarned || 0 };
  }
}
