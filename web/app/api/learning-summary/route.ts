// Learning Summary API routes
import { NextRequest, NextResponse } from 'next/server';

// Step types
type StepType = 'VIDEO' | 'IMAGE' | 'QUIZ' | 'BRIDGE' | 'TEST' | 'VIDEO_LAB' | 'IMAGE_SAFARI' | 'TRACE';

// Answer record interface
interface StepAnswer {
  stepId: string;
  stepType: StepType;
  stepName: string;
  answer: string | string[];
  correct?: boolean;
  starsEarned: number;
  timestamp: number;
  // Video Lab specific
  asrText?: string;
  speakingScore?: number;
  speakingFeedback?: string;
}

// Learning Summary interface
interface LearningSummary {
  id: string;
  lessonId: string;
  lessonTitle: string;
  totalStars: number;
  maxStars: number;
  completedAt: string;
  stepResults: StepAnswer[];
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  speakingAnalysis?: {
    averageScore: number;
    commonIssues: string[];
    tips: string[];
  };
  summaryText: string; // English summary for kids
}

// In-memory storage for demo (in production, use database)
const summaries: Map<string, LearningSummary> = new Map();
const answers: Map<string, StepAnswer[]> = new Map();

// Generate learning summary using Qwen LLM
async function generateSummary(lessonId: string, lessonTitle: string, stepResults: StepAnswer[]): Promise<{
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  speakingAnalysis?: {
    averageScore: number;
    commonIssues: string[];
    tips: string[];
  };
  summaryText: string;
  overallScore: number;
}> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  
  // Calculate basic stats
  const totalStars = stepResults.reduce((sum, s) => sum + s.starsEarned, 0);
  const maxStars = stepResults.length * 3;
  const quizResults = stepResults.filter(s => s.stepType === 'QUIZ' || s.stepType === 'TEST');
  const correctCount = quizResults.filter(s => s.correct).length;
  const speakingResults = stepResults.filter(s => s.stepType === 'VIDEO_LAB');
  const speakingScores = speakingResults.map(s => s.starsEarned || 0);
  const avgSpeakingScore = speakingScores.length > 0 
    ? speakingScores.reduce((a, b) => a + b, 0) / speakingScores.length 
    : 0;

  // If no API key, use fallback summary
  if (!apiKey || apiKey === 'your-dashscope-api-key') {
    return generateFallbackSummary(stepResults, totalStars, maxStars, correctCount, quizResults.length, avgSpeakingScore);
  }

  // Build prompt for Qwen
  const prompt = `You are a friendly English learning assistant for children. Analyze this student's learning session and provide a fun, encouraging summary.

Lesson: ${lessonTitle}
Total Steps Completed: ${stepResults.length}
Total Stars Earned: ${totalStars}/${maxStars}
Quiz Questions Correct: ${correctCount}/${quizResults.length}

Step Details:
${stepResults.map((s, i) => `
Step ${i + 1}: ${s.stepName} (${s.stepType})
- Stars Earned: ${s.starsEarned}/3
- Answer: ${Array.isArray(s.answer) ? s.answer.join(', ') : s.answer}
${s.speakingScore !== undefined ? `- Speaking Score: ${s.speakingScore}/3\n- Speaking Feedback: ${s.speakingFeedback || 'N/A'}` : ''}
`).join('\n')}

Please respond in English with a JSON object containing:
{
  "strengths": ["list of 2-3 things the student did well"],
  "weaknesses": ["list of 2-3 areas to improve"],
  "suggestions": ["2-3 fun and encouraging study tips for kids"],
  "summaryText": "A fun, kid-friendly paragraph summarizing the learning session in simple English (max 150 words, use emoji)",
  "overallScore": a number from 0-100 based on performance,
  "speakingAnalysis": ${speakingResults.length > 0 ? `{
    "averageScore": ${avgSpeakingScore.toFixed(1)},
    "commonIssues": ["2-3 common speaking issues noticed"],
    "tips": ["2-3 fun tips to improve speaking"]
  }` : 'null'}
}

Make it fun and encouraging for children aged 5-12! Use simple words and positive reinforcement.`;

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that responds ONLY with valid JSON. No markdown, no explanation, just pure JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LearningSummary] Qwen API error:', response.status, errorText);
      return generateFallbackSummary(stepResults, totalStars, maxStars, correctCount, quizResults.length, avgSpeakingScore);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return generateFallbackSummary(stepResults, totalStars, maxStars, correctCount, quizResults.length, avgSpeakingScore);
    }

    // Parse JSON from response
    let jsonStr = content.trim();
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    
    const result = JSON.parse(jsonStr.trim());
    
    // Build speaking analysis if available
    let speakingAnalysis;
    if (speakingResults.length > 0) {
      speakingAnalysis = result.speakingAnalysis || {
        averageScore: avgSpeakingScore,
        commonIssues: ['Keep practicing to improve pronunciation'],
        tips: ['Try to speak clearly and slowly']
      };
    }

    return {
      strengths: result.strengths || ['Great effort!', 'Keep learning!'],
      weaknesses: result.weaknesses || ['Practice more', 'Review vocabulary'],
      suggestions: result.suggestions || ['Play more games', 'Read English books'],
      summaryText: result.summaryText || `You did a great job completing ${stepResults.length} steps and earned ${totalStars} stars! Keep up the amazing work! ⭐`,
      overallScore: result.overallScore || Math.round((totalStars / maxStars) * 100),
      speakingAnalysis,
    };
  } catch (error) {
    console.error('[LearningSummary] Error generating summary:', error);
    return generateFallbackSummary(stepResults, totalStars, maxStars, correctCount, quizResults.length, avgSpeakingScore);
  }
}

function generateFallbackSummary(
  stepResults: StepAnswer[],
  totalStars: number,
  maxStars: number,
  correctCount: number,
  totalQuizzes: number,
  avgSpeakingScore: number
) {
  const percentage = maxStars > 0 ? (totalStars / maxStars) * 100 : 0;
  const speakingResults = stepResults.filter(s => s.stepType === 'VIDEO_LAB');
  
  let summaryText = '';
  if (percentage >= 80) {
    summaryText = `🌟 Amazing job! You earned ${totalStars} out of ${maxStars} stars! You're a superstar learner! Your hard work really shows. Keep shining! ⭐🎉`;
  } else if (percentage >= 60) {
    summaryText = `👍 Great effort! You got ${totalStars} stars. You're doing wonderfully! With a little more practice, you'll be a champion! Keep going! 💪🌟`;
  } else if (percentage >= 40) {
    summaryText = `💪 Good try! You earned ${totalStars} stars. Every step you take makes you smarter! Let's practice more and fly higher! 🚀✨`;
  } else {
    summaryText = `🌈 Keep going! You earned ${totalStars} stars and completed ${stepResults.length} steps. That's a great start! Practice makes perfect! 💖📚`;
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  if (correctCount >= totalQuizzes * 0.8) {
    strengths.push('Excellent quiz performance!');
  }
  if (avgSpeakingScore >= 2) {
    strengths.push('Great speaking skills!');
  }
  if (stepResults.length >= 5) {
    strengths.push('Amazing completion rate!');
  }

  if (correctCount < totalQuizzes * 0.5 && totalQuizzes > 0) {
    weaknesses.push('Quiz answers need more practice');
  }
  if (avgSpeakingScore < 2 && speakingResults.length > 0) {
    weaknesses.push('Speaking pronunciation needs work');
  }
  if (percentage < 60) {
    weaknesses.push('Keep practicing to improve');
  }

  suggestions.push('Play educational games in English');
  suggestions.push('Practice speaking every day');
  if (totalQuizzes > 0) {
    suggestions.push('Review vocabulary before quizzes');
  }
  suggestions.push('Have fun with English stories');

  const speakingAnalysis = speakingResults.length > 0 ? {
    averageScore: avgSpeakingScore,
    commonIssues: avgSpeakingScore < 2 ? ['Pronunciation could be clearer', 'Try speaking more slowly'] : ['Good pronunciation!'],
    tips: ['Listen to native speakers', 'Practice tongue twisters', 'Read aloud every day'],
  } : undefined;

  return {
    strengths,
    weaknesses,
    suggestions,
    summaryText,
    overallScore: Math.round(percentage),
    speakingAnalysis,
  };
}

// POST: Save step answer and generate summary
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, lessonId, lessonTitle, stepAnswers } = body;

    if (!userId || !lessonId) {
      return NextResponse.json({ error: 'Missing userId or lessonId' }, { status: 400 });
    }

    // Save step answers
    const storageKey = `${userId}_${lessonId}`;
    answers.set(storageKey, stepAnswers || []);

    // Generate summary
    const summaryData = await generateSummary(lessonId, lessonTitle, stepAnswers || []);
    
    const summary: LearningSummary = {
      id: `summary_${userId}_${lessonId}_${Date.now()}`,
      lessonId,
      lessonTitle,
      totalStars: stepAnswers?.reduce((sum: number, s: StepAnswer) => sum + s.starsEarned, 0) || 0,
      maxStars: (stepAnswers?.length || 0) * 3,
      completedAt: new Date().toISOString(),
      stepResults: stepAnswers || [],
      ...summaryData,
    };

    // Save summary
    summaries.set(storageKey, summary);

    return NextResponse.json({ 
      success: true, 
      summary,
      answers: stepAnswers || [] 
    });
  } catch (error) {
    console.error('[LearningSummary] POST error:', error);
    return NextResponse.json({ error: 'Failed to save learning data' }, { status: 500 });
  }
}

// GET: Retrieve learning summaries for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const lessonId = searchParams.get('lessonId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (lessonId) {
      // Get specific lesson summary
      const storageKey = `${userId}_${lessonId}`;
      const summary = summaries.get(storageKey);
      const savedAnswers = answers.get(storageKey);
      return NextResponse.json({ 
        summary: summary || null,
        answers: savedAnswers || [] 
      });
    }

    // Get all summaries for user
    const userSummaries: LearningSummary[] = [];
    for (const [key, value] of summaries.entries()) {
      if (key.startsWith(`${userId}_`)) {
        userSummaries.push(value);
      }
    }

    // Sort by date
    userSummaries.sort((a, b) => 
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    return NextResponse.json({ 
      summaries: userSummaries,
      totalLessons: userSummaries.length,
      totalStars: userSummaries.reduce((sum, s) => sum + s.totalStars, 0),
    });
  } catch (error) {
    console.error('[LearningSummary] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve learning data' }, { status: 500 });
  }
}
