'use client';
// LearningSummaryCard - A kid-friendly component to display learning results
// Shows stars earned, performance summary, and suggestions
import { useEffect, useRef, useState } from 'react';
import { Star, Trophy, Lightbulb, ArrowRight, RefreshCw } from 'lucide-react';
import type { LearningSummary, StepAnswer } from '@/lib/useLearningRecord';

interface LearningSummaryCardProps {
  /** Optional - when undefined, a loading skeleton is shown while the AI summary is being generated */
  summary?: LearningSummary | null;
  /** Optional - stars earned so far. Used to show a sensible default in the loading state */
  earnedStars?: number;
  /** Optional - explicit loading flag; if true (and summary is empty), show skeleton */
  isLoading?: boolean;
  onContinue?: () => void;
  onReplay?: () => void;
}

// Kid-friendly emoji reactions based on score
const SCORE_EMOJIS = {
  excellent: ['🌟', '🎉', '🏆', '🚀', '💫'],
  good: ['👍', '⭐', '🎈', '✨', '💪'],
  okay: ['🌈', '📚', '💖', '🌸', '🦄'],
  keepGoing: ['🌻', '🌱', '💝', '🦋', '🌺'],
};

function getScoreCategory(score: number): 'excellent' | 'good' | 'okay' | 'keepGoing' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'okay';
  return 'keepGoing';
}

function getRandomEmoji(category: 'excellent' | 'good' | 'okay' | 'keepGoing'): string {
  const emojis = SCORE_EMOJIS[category];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

export function LearningSummaryCard({
  summary,
  earnedStars = 0,
  isLoading = false,
  onContinue,
  onReplay,
}: LearningSummaryCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // True when we should show the loading skeleton (no summary yet but the card is open)
  const showSkeleton = isLoading || !summary;

  // Derived values: use real summary when available, else safe defaults for skeleton
  const scoreCategory = summary ? getScoreCategory(summary.overallScore) : 'good';
  const randomEmoji = summary ? getRandomEmoji(scoreCategory) : '⏳';
  const starsEarned = summary?.totalStars ?? earnedStars;
  const maxStars = summary?.maxStars ?? Math.max(earnedStars, 3);
  const percentage = maxStars > 0 ? Math.round((starsEarned / maxStars) * 100) : 0;

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Track whether scrollable content overflows so we can show a "more below" hint
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkScroll = () => {
      setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    };
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [isVisible]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onContinue}
    >
      <div
        className={`relative w-full max-w-lg max-h-[calc(100vh-2rem)] flex flex-col bg-gradient-to-b from-purple-100 via-pink-50 to-yellow-50 rounded-[32px] shadow-2xl border-4 border-white transform transition-all duration-500 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-8'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative top banner */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 rounded-full px-6 py-2 shadow-lg z-10">
          <span className={`text-3xl inline-block ${showSkeleton ? 'animate-spin' : ''}`}>
            {showSkeleton ? '⏳' : randomEmoji}
          </span>
        </div>

        {/* Scrollable content area */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 pt-8 [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.5)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-300/50 [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          {/* Header */}
          <div className="text-center pt-4 pb-4">
            <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500">
              {showSkeleton ? 'Great job!' : 'Learning Complete!'}
            </h2>
            <p className="text-sm text-gray-500 font-semibold mt-1">
              {showSkeleton ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-purple-400 animate-pulse" />
                  <span>Writing your report...</span>
                </span>
              ) : (
                summary!.lessonTitle
              )}
            </p>
          </div>

          {/* Stars display */}
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-10 h-10 transition-all duration-300 ${
                    i < Math.ceil(starsEarned / (maxStars / 3 || 1))
                      ? 'fill-yellow-400 text-yellow-400 scale-110'
                      : 'fill-gray-200 text-gray-200'
                  } ${showSkeleton ? 'animate-pulse' : ''}`}
                  style={{
                    transitionDelay: `${i * 150}ms`,
                    transform: i < Math.ceil(starsEarned / (maxStars / 3 || 1)) ? 'scale(1.1)' : 'scale(1)'
                  }}
                />
              ))}
            </div>
            <span className="text-2xl font-black text-amber-600">
              {starsEarned}/{maxStars} ⭐
            </span>
          </div>

          {/* Score badge */}
          <div className="flex justify-center mb-4">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-bold shadow-md ${
              scoreCategory === 'excellent' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
              scoreCategory === 'good' ? 'bg-gradient-to-r from-blue-400 to-cyan-500' :
              scoreCategory === 'okay' ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
              'bg-gradient-to-r from-purple-400 to-pink-400'
            }`}>
              <Trophy className="w-5 h-5" />
              <span>{percentage}% Score</span>
            </div>
          </div>

          {/* Speaking analysis (if available) */}
          {showSkeleton ? (
            <SkeletonBlock color="cyan" title="Speaking Report" />
          ) : (
            summary!.speakingAnalysis && (
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-4 mb-4 border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎙️</span>
                  <h3 className="font-bold text-blue-700">Speaking Report</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-600 font-medium">Average Score:</span>
                    <span className="text-lg font-black text-blue-700">
                      {summary!.speakingAnalysis.averageScore.toFixed(1)}/3 ⭐
                    </span>
                  </div>
                  {summary!.speakingAnalysis.tips.length > 0 && (
                    <div className="text-sm text-blue-600">
                      <span className="font-semibold">Tip:</span> {summary!.speakingAnalysis.tips[0]}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Strengths */}
          {showSkeleton ? (
            <SkeletonBlock color="green" title="What You Did Great!" lines={3} />
          ) : (
            summary!.strengths.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 mb-4 border-2 border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">✨</span>
                  <h3 className="font-bold text-green-700">What You Did Great!</h3>
                </div>
                <ul className="space-y-1">
                  {summary!.strengths.slice(0, 3).map((strength, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span className="font-medium">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          {/* Suggestions */}
          {showSkeleton ? (
            <SkeletonBlock color="amber" title="Fun Tips for Next Time!" lines={3} />
          ) : (
            summary!.suggestions.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 mb-4 border-2 border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-amber-700">Fun Tips for Next Time!</h3>
                </div>
                <ul className="space-y-1">
                  {summary!.suggestions.slice(0, 3).map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-600">
                      <span className="text-amber-500 mt-0.5">💡</span>
                      <span className="font-medium">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>

        {/* Action buttons - sticky at bottom */}
        <div className="flex-shrink-0 p-6 pt-3 pb-4 border-t-2 border-white/60 bg-gradient-to-b from-transparent to-white/40 rounded-b-[28px] relative">
          {/* Subtle hint above buttons when more content is below */}
          {canScrollDown && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-purple-400 text-xs font-bold flex items-center gap-1 opacity-70 animate-bounce" style={{ animationDuration: '1.5s' }}>
              <span>scroll for more</span>
              <span aria-hidden="true">↓</span>
            </div>
          )}
          <div className="flex gap-3">
            {onReplay && (
              <button
                onClick={onReplay}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border-2 border-purple-300 text-purple-600 font-bold shadow-sm hover:bg-purple-50 hover:border-purple-400 transition-all active:scale-95"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Play Again</span>
              </button>
            )}
            {onContinue && (
              <button
                onClick={onContinue}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-20 left-4 text-2xl opacity-30 animate-bounce pointer-events-none" style={{ animationDuration: '2s' }}>
          ⭐
        </div>
        <div className="absolute top-32 right-6 text-xl opacity-20 animate-pulse pointer-events-none">
          ✨
        </div>
        <div className="absolute bottom-28 left-8 text-lg opacity-25 pointer-events-none" style={{ animationDuration: '3s' }}>
          🌈
        </div>
      </div>
    </div>
  );
}

// Loading skeleton block used while AI summary is being generated.
// Renders shimmering placeholder bars inside a colored card so the modal
// opens with sensible visual structure immediately (no awkward empty space).
function SkeletonBlock({
  color,
  title,
  lines = 2,
}: {
  color: 'cyan' | 'green' | 'amber';
  title: string;
  lines?: number;
}) {
  const palette: Record<typeof color, { bg: string; border: string; title: string; bar: string }> = {
    cyan: {
      bg: 'from-cyan-50 to-blue-50',
      border: 'border-blue-200',
      title: 'text-blue-700',
      bar: 'bg-blue-200/70',
    },
    green: {
      bg: 'from-green-50 to-emerald-50',
      border: 'border-green-200',
      title: 'text-green-700',
      bar: 'bg-green-200/70',
    },
    amber: {
      bg: 'from-amber-50 to-orange-50',
      border: 'border-amber-200',
      title: 'text-amber-700',
      bar: 'bg-amber-200/70',
    },
  };
  const p = palette[color];
  return (
    <div
      className={`bg-gradient-to-r ${p.bg} rounded-2xl p-4 mb-4 border-2 ${p.border} animate-pulse`}
      aria-hidden="true"
    >
      <div className={`h-5 w-32 rounded-md bg-white/60 mb-3`} />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`h-3 rounded-md ${p.bar} ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
          />
        ))}
      </div>
    </div>
  );
}

// Small inline summary badge for showing on step cards
export function AnswerSummaryBadge({ answer, showDetails = false }: { answer: StepAnswer; showDetails?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div 
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
        answer.correct === false 
          ? 'bg-red-100 text-red-600 border border-red-200' 
          : answer.correct === true
          ? 'bg-green-100 text-green-600 border border-green-200'
          : 'bg-purple-100 text-purple-600 border border-purple-200'
      }`}
      onClick={() => showDetails && setExpanded(!expanded)}
    >
      {answer.correct === false ? '❌' : answer.correct === true ? '✓' : '🎤'}
      <span>{answer.starsEarned}⭐</span>
      
      {showDetails && expanded && answer.answer && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border p-2 text-xs z-10 whitespace-nowrap">
          <div className="text-gray-600">
            Answer: <span className="font-semibold text-gray-800">
              {Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer}
            </span>
          </div>
          {answer.asrText && (
            <div className="text-gray-600 mt-1">
              Heard: <span className="italic text-gray-800">"{answer.asrText}"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Previous answers display for showing during lesson
export function PreviousAnswerDisplay({ 
  answers, 
  currentStepId 
}: { 
  answers: StepAnswer[]; 
  currentStepId: string;
}) {
  const previousAnswer = answers.find(a => a.stepId === currentStepId);
  
  if (!previousAnswer) return null;
  
  return (
    <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-purple-600">📝 Your Previous Answer:</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
          previousAnswer.correct === false 
            ? 'bg-red-100 text-red-600' 
            : previousAnswer.correct === true
            ? 'bg-green-100 text-green-600'
            : 'bg-blue-100 text-blue-600'
        }`}>
          {previousAnswer.correct === false ? '❌ Wrong' : previousAnswer.correct === true ? '✅ Correct' : '🎤 Spoken'}
          <span>{previousAnswer.starsEarned}⭐</span>
        </span>
      </div>
      
      <div className="text-sm text-gray-700">
        {previousAnswer.stepType === 'VIDEO_LAB' && previousAnswer.asrText ? (
          <div>
            <span className="font-semibold">You said:</span> 
            <span className="italic ml-1">"{previousAnswer.asrText}"</span>
          </div>
        ) : (
          <div>
            <span className="font-semibold">Your answer:</span>
            <span className="ml-1">
              {Array.isArray(previousAnswer.answer) 
                ? previousAnswer.answer.join(', ') 
                : previousAnswer.answer}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
