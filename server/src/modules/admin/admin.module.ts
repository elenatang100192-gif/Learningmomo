import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QiniuService } from '../../common/qiniu.service';
import { AdminGuard } from '../../common/admin.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [QiniuService, AdminGuard],
  exports: [QiniuService],
})
export class AdminModule {}
