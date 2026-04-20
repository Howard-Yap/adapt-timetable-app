import { PRIORITY, STATUS } from '../engine/scheduler';

export const DEFAULT_PREFERENCES = {
  name: '',
  wakeTime: '07:00',
  endDayTime: '22:00',
  workStyle: 'balanced',
  goals: ['productivity'],
};

export const SAMPLE_FIXED_EVENTS = [];

export const SAMPLE_TASKS = [];

export const WORK_STYLES = [
  { id: 'deep-work', label: 'Deep Work', desc: 'Long uninterrupted focus blocks', icon: '🧠' },
  { id: 'short-sessions', label: 'Short Sessions', desc: 'Frequent breaks, smaller chunks', icon: '⚡' },
  { id: 'balanced', label: 'Balanced', desc: 'Mix of focus and flexibility', icon: '⚖️' },
];

export const GOALS = [
  { id: 'productivity', label: 'Productivity', icon: '🚀' },
  { id: 'study', label: 'Study', icon: '📚' },
  { id: 'balance', label: 'Work-Life Balance', icon: '🌿' },
  { id: 'health', label: 'Health & Fitness', icon: '💪' },
];