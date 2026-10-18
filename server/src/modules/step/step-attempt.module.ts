import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StepAttemptController } from './step-attempt.controller';

@Module({
  controllers: [StepAttemptController],
  providers: [PrismaService],
})
export class StepAttemptModule {}
