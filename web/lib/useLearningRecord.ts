// useLearningRecord - Hook for recording step answers and generating learning summaries
'use client';
import { useCallback, useRef, useState } from 'react';
import { getUserId } from '@/lib/api';
import type { StepType } from '@/lib/api';

export interface StepAnswer {
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

export interface LearningSummary {
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
  summaryText: string;
}

interface UseLearningRecordReturn {
  answers: StepAnswer[];
  currentSummary: LearningSummary | null;
  isLoading: boolean;
  isSaving: boolean;
  recordAnswer: (answer: Omit<StepAnswer, 'timestamp'>) => void;
  saveLessonAnswers: (lessonId: string, lessonTitle: string) => Promise<LearningSummary | null>;
  loadPreviousAnswers: (lessonId: string) => Promise<StepAnswer[]>;
  clearAnswers: () => void;
  getAnswersForStep: (stepId: string) => StepAnswer | undefined;
}

const STORAGE_PREFIX = 'hongen_learning_';
const ANSWERS_SUFFIX = '_answers';

export function useLearningRecord(): UseLearningRecordReturn {
  const [answers, setAnswers] = useState<StepAnswer[]>([]);
  const [currentSummary, setCurrentSummary] = useState<LearningSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const userIdRef = useRef<string>('');

  // Get user ID on client side
  const getUserIdSafe = useCallback(() => {
    if (typeof window === 'undefined') return '';
    if (!userIdRef.current) {
      userIdRef.current = getUserId();
    }
    return userIdRef.current;
  }, []);

  // Record a single step answer
  const recordAnswer = useCallback((answer: Omit<StepAnswer, 'timestamp'>) => {
    const fullAnswer: StepAnswer = {
      ...answer,
      timestamp: Date.now(),
    };
    
    setAnswers(prev => {
      // Check if this step already has an answer (update it)
      const existingIndex = prev.findIndex(a => a.stepId === answer.stepId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = fullAnswer;
        return updated;
      }
      return [...prev, fullAnswer];
    });

    // Also save to localStorage for persistence
    const userId = getUserIdSafe();
    if (userId) {
      try {
        const storageKey = STORAGE_PREFIX + userId + ANSWERS_SUFFIX;
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const existingIndex = existing.findIndex((a: StepAnswer) => a.stepId === answer.stepId);
        if (existingIndex >= 0) {
          existing[existingIndex] = fullAnswer;
        } else {
          existing.push(fullAnswer);
        }
        localStorage.setItem(storageKey, JSON.stringify(existing));
      } catch (e) {
        console.warn('[useLearningRecord] Failed to save to localStorage:', e);
      }
    }
  }, [getUserIdSafe]);

  // Save all lesson answers and generate summary
  const saveLessonAnswers = useCallback(async (lessonId: string, lessonTitle: string): Promise<LearningSummary | null> => {
    setIsSaving(true);
    try {
      const userId = getUserIdSafe();
      if (!userId) {
        console.warn('[useLearningRecord] No userId available');
        return null;
      }

      const response = await fetch('/api/learning-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          lessonId,
          lessonTitle,
          stepAnswers: answers,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save lesson answers');
      }

      const data = await response.json();
      if (data.summary) {
        setCurrentSummary(data.summary);
        
        // Also save summary to localStorage
        const summaryStorageKey = STORAGE_PREFIX + userId + '_' + lessonId + '_summary';
        localStorage.setItem(summaryStorageKey, JSON.stringify(data.summary));
      }

      return data.summary;
    } catch (error) {
      console.error('[useLearningRecord] Failed to save lesson answers:', error);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [answers, getUserIdSafe]);

  // Load previous answers for a lesson
  const loadPreviousAnswers = useCallback(async (lessonId: string): Promise<StepAnswer[]> => {
    setIsLoading(true);
    try {
      const userId = getUserIdSafe();
      if (!userId) return [];

      // First try to load from localStorage
      const storageKey = STORAGE_PREFIX + userId + ANSWERS_SUFFIX;
      const localAnswers = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const lessonAnswers = localAnswers.filter((a: StepAnswer) => {
        // Match by stepId prefix or store lesson context
        return true; // Will be filtered by lesson context on the page
      });

      // Also try to load from API
      try {
        const response = await fetch(`/api/learning-summary?userId=${encodeURIComponent(userId)}&lessonId=${encodeURIComponent(lessonId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.answers && data.answers.length > 0) {
            setAnswers(data.answers);
            return data.answers;
          }
        }
      } catch (e) {
        console.warn('[useLearningRecord] Failed to load from API, using localStorage:', e);
      }

      // Return localStorage answers if API failed
      const filteredAnswers = lessonAnswers.length > 0 ? lessonAnswers : 
        localAnswers.filter((a: StepAnswer) => {
          // Check if answer was saved recently (within same session context)
          const oneHourAgo = Date.now() - 3600000;
          return a.timestamp > oneHourAgo;
        });
      
      setAnswers(filteredAnswers);
      return filteredAnswers;
    } catch (error) {
      console.error('[useLearningRecord] Failed to load previous answers:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getUserIdSafe]);

  // Clear current session answers
  const clearAnswers = useCallback(() => {
    setAnswers([]);
    setCurrentSummary(null);
  }, []);

  // Get answer for a specific step
  const getAnswersForStep = useCallback((stepId: string): StepAnswer | undefined => {
    return answers.find(a => a.stepId === stepId);
  }, [answers]);

  return {
    answers,
    currentSummary,
    isLoading,
    isSaving,
    recordAnswer,
    saveLessonAnswers,
    loadPreviousAnswers,
    clearAnswers,
    getAnswersForStep,
  };
}
