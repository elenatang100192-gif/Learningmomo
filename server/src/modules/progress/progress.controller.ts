import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly svc: ProgressService) {}

  @Get()
  list(@Query('level') level: string | undefined, @Req() req: any) {
    const userId = req.headers['x-user-id'] as string;
    return this.svc.list(userId, level);
  }

  @Post('complete')
  complete(
    @Body() body: { lessonId: string; starsEarned: number },
    @Req() req: any,
  ) {
    const userId = req.headers['x-user-id'] as string;
    return this.svc.complete(userId, body.lessonId, body.starsEarned || 0);
  }
}