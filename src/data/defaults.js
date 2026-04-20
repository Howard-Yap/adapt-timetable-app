import { PRIORITY, STATUS } from '../engine/scheduler';

export const DEFAULT_PREFERENCES = {
  name: '',
  wakeTime: '07:00',
  endDayTime: '22:00',
  workStyle: 'balanced',
  goals: ['productivity'],
};

export const SAMPLE_FIXED_EVENTS = [];

export const SAMPLE_TASKS = [
  {
    id: 't1',
    title: 'Study Chapter 5',
    duration: 90,
    deadline: null,
    priority: PRIORITY.HIGH,
    status: STATUS.PENDING,
    category: 'study',
  },
  {
    id: 't2',
    title: 'Complete Assignment',
    duration: 120,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    priority: PRIORITY.HIGH,
    status: STATUS.PENDING,
    category: 'study',
  },
  {
    id: 't3',
    title: 'Review Lecture Notes',
    duration: 45,
    deadline: null,
    priority: PRIORITY.MEDIUM,
    status: STATUS.PENDING,
    category: 'study',
  },
  {
    id: 't4',
    title: 'Read Research Paper',
    duration: 60,
    deadline: null,
    priority: PRIORITY.MEDIUM,
    status: STATUS.PENDING,
    category: 'reading',
  },
  {
    id: 't5',
    title: 'Plan Next Week',
    duration: 30,
    deadline: null,
    priority: PRIORITY.LOW,
    status: STATUS.PENDING,
    category: 'admin',
  },
];

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