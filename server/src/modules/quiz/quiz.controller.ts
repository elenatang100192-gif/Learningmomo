import { Body, Controller, Post } from '@nestjs/common';
import { QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly svc: QuizService) {}

  @Post('grade')
  grade(@Body() body: { stepId: string; answers: string[] }) {
    return this.svc.grade(body);
  }
}