import { Module } from '@nestjs/common';
import { StepController } from './step.controller';
import { StepAdminController } from './step-admin.controller';
import { StepService } from './step.service';

@Module({
  controllers: [StepController, StepAdminController],
  providers: [StepService],
})
export class StepModule {}