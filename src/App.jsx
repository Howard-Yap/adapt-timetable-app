import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { loadUserData, saveUserData } from './firebaseService';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import DashboardScreen from './screens/DashboardScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import ChatScreen from './screens/ChatScreen';
import TaskManagerScreen from './screens/TaskManagerScreen';
import TimetableScreen from './screens/TimetableScreen';
import { buildSchedule, timeToMins, STATUS, PRIORITY } from './engine/scheduler';
import { SAMPLE_TASKS, DEFAULT_PREFERENCES } from './data/defaults';
import './styles.css';

const NAV = [
  { id: 'dashboard', label: 'Today', icon: '◉' },
  { id: 'schedule', label: 'Schedule', icon: '◈' },
  { id: 'chat', label: 'AI', icon: '◎' },
  { id: 'tasks', label: 'Tasks', icon: '◇' },
  { id: 'timetable', label: 'Uni', icon: '◫' },
];

function getTodayDay() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [screen, setScreen] = useState('dashboard');
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES);
  const [tasks, setTasks] = useState(SAMPLE_TASKS);
  const [uniClasses, setUniClasses] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [rolledOver, setRolledOver] = useState([]);
  const [completedTaskIds, setCompletedTaskIds] = useState([]);
  const [skippedTaskIds, setSkippedTaskIds] = useState([]);
  const [endDayMins, setEndDayMins] = useState(timeToMins('22:00'));
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'ai',
      text: "Hey! I'm your scheduling assistant. Tell me what's happening — I'll adapt your day instantly.\n\nTry: \"I'm running late\", \"Add review notes for 45 mins\", or \"What's left today?\"",
      time: new Date(),
    }
  ]);
  const [rebuildCount, setRebuildCount] = useState(0);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const data = await loadUserData(firebaseUser.uid);
        if (data) {
          if (data.prefs) setPrefs(data.prefs);
          if (data.tasks) setTasks(data.tasks);
          if (data.uniClasses) setUniClasses(data.uniClasses);
          if (data.onboarded) setOnboarded(data.onboarded);
          if (data.completedTaskIds) setCompletedTaskIds(data.completedTaskIds);
          if (data.skippedTaskIds) setSkippedTaskIds(data.skippedTaskIds);
        }
      } else {
        setUser(null);
        setOnboarded(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Save data to Firestore whenever key state changes
  useEffect(() => {
    if (user && onboarded) {
      saveUserData(user.uid, {
        prefs,
        tasks,
        uniClasses,
        onboarded,
        completedTaskIds,
        skippedTaskIds,
      });
    }
  }, [prefs, tasks, uniClasses, completedTaskIds, skippedTaskIds, onboarded, user]);

  const getCurrentMins = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  const getTodayClasses = useCallback((classes) => {
    const today = getTodayDay();
    return classes.filter(c => c.enabled !== false && c.day === today);
  }, []);

  const generateFreshSchedule = useCallback((taskList, classList, preferences) => {
    const todayClasses = getTodayClasses(classList);
    const endMins = timeToMins(preferences.endDayTime);
    const result = buildSchedule({
      uniClasses: todayClasses,
      tasks: taskList,
      wakeTime: preferences.wakeTime,
      endDayTime: preferences.endDayTime,
      breakDuration: preferences.workStyle === 'short-sessions' ? 15 : 10,
    });
    setSchedule(result.blocks);
    setRolledOver(result.unscheduledTasks);
    setEndDayMins(endMins);
  }, [getTodayClasses]);

  useEffect(() => {
    if (onboarded) {
      generateFreshSchedule(tasks, uniClasses, prefs);
    }
  }, [onboarded]);

  const handleLogin = (firebaseUser) => setUser(firebaseUser);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setOnboarded(false);
    setTasks(SAMPLE_TASKS);
    setUniClasses([]);
    setPrefs(DEFAULT_PREFERENCES);
    setCompletedTaskIds([]);
    setSkippedTaskIds([]);
  };

  const handleOnboardingComplete = (newPrefs) => {
    setPrefs(newPrefs);
    setOnboarded(true);
  };

  const handleRebuild = useCallback((mutation) => {
    let updatedTasks = [...tasks];
    let updatedEndMins = endDayMins;
    let updatedCompleted = [...completedTaskIds];
    let updatedSkipped = [...skippedTaskIds];
    let fromMins = getCurrentMins();

    if (mutation) {
      switch (mutation.type) {

        case 'COMPLETE_TASK':
          updatedCompleted = [...new Set([...updatedCompleted, mutation.taskId])];
          updatedTasks = updatedTasks.map(t =>
            t.id === mutation.taskId ? { ...t, status: STATUS.DONE } : t
          );
          setCompletedTaskIds(updatedCompleted);
          break;

        case 'SKIP_TASK':
          updatedSkipped = [...new Set([...updatedSkipped, mutation.taskId])];
          updatedTasks = updatedTasks.map(t =>
            t.id === mutation.taskId ? { ...t, status: STATUS.SKIPPED } : t
          );
          setSkippedTaskIds(updatedSkipped);
          break;

        case 'RESCHEDULE_FROM':
          fromMins = mutation.fromMins;
          break;

        case 'SET_END_TIME':
          updatedEndMins = mutation.endMins;
          setEndDayMins(updatedEndMins);
          break;

        case 'LOWER_LOAD': {
          const lowIds = updatedTasks
            .filter(t => t.priority === PRIORITY.LOW && t.status === STATUS.PENDING)
            .map(t => t.id);
          updatedSkipped = [...new Set([...updatedSkipped, ...lowIds])];
          updatedTasks = updatedTasks.map(t =>
            lowIds.includes(t.id) ? { ...t, status: STATUS.SKIPPED } : t
          );
          setSkippedTaskIds(updatedSkipped);
          break;
        }

        case 'INCREASE_LOAD':
          updatedTasks = updatedTasks.map(t =>
            t.status === STATUS.SKIPPED ? { ...t, status: STATUS.PENDING } : t
          );
          updatedSkipped = [];
          setSkippedTaskIds([]);
          break;

        case 'FULL_REBUILD':
          updatedSkipped = [];
          updatedTasks = tasks.map(t =>
            t.status === STATUS.SKIPPED ? { ...t, status: STATUS.PENDING } : t
          );
          setSkippedTaskIds([]);
          fromMins = getCurrentMins();
          break;

        // ── NEW MUTATIONS ──────────────────────────────────────────

        case 'ADD_TASK': {
          // Give it a stable id and ensure status is pending
          const newTask = {
            ...mutation.task,
            id: `t${Date.now()}`,
            status: STATUS.PENDING,
          };
          updatedTasks = [...updatedTasks, newTask];
          break;
        }

        case 'EXTEND_TASK': {
          // Increase the duration of the target task then rebuild from now
          updatedTasks = updatedTasks.map(t =>
            t.id === mutation.taskId
              ? { ...t, duration: (t.duration || 30) + mutation.extraMins }
              : t
          );
          // Rebuild from current time so the extended block fits in remaining day
          fromMins = getCurrentMins();
          break;
        }

        case 'PRIORITISE_TASK': {
          // Bump task to HIGH priority so scheduler sorts it first
          updatedTasks = updatedTasks.map(t =>
            t.id === mutation.taskId
              ? { ...t, priority: PRIORITY.HIGH }
              : t
          );
          fromMins = getCurrentMins();
          break;
        }

        case 'FOCUS_MODE': {
          // Insert a synthetic high-priority focus block starting now
          const focusTask = {
            id: `focus-${Date.now()}`,
            title: '🎯 Focus block',
            duration: mutation.duration,
            priority: PRIORITY.HIGH,
            status: STATUS.PENDING,
            deadline: null,
          };
          updatedTasks = [focusTask, ...updatedTasks];
          fromMins = mutation.fromMins ?? getCurrentMins();
          break;
        }

        default:
          break;
      }

      setTasks(updatedTasks);
    }

    const endTimeStr = `${String(Math.floor(updatedEndMins / 60)).padStart(2, '0')}:${String(updatedEndMins % 60).padStart(2, '0')}`;
    const fromStr = `${String(Math.floor(fromMins / 60)).padStart(2, '0')}:${String(fromMins % 60).padStart(2, '0')}`;
    const todayClasses = getTodayClasses(uniClasses);
    const result = buildSchedule({
      uniClasses: todayClasses,
      tasks: updatedTasks.filter(t => !updatedCompleted.includes(t.id) && !updatedSkipped.includes(t.id)),
      wakeTime: fromStr,
      endDayTime: endTimeStr,
      breakDuration: prefs.workStyle === 'short-sessions' ? 15 : 10,
    });

    const completedBlocks = schedule.filter(b => updatedCompleted.includes(b.taskId));
    setSchedule([...completedBlocks, ...result.blocks].sort((a, b) => a.startMins - b.startMins));
    setRolledOver(result.unscheduledTasks);
    setRebuildCount(c => c + 1);
  }, [tasks, uniClasses, prefs, endDayMins, completedTaskIds, skippedTaskIds, schedule, getTodayClasses]);

  const addUniClass = (cls) => {
    const updated = [...uniClasses, cls];
    setUniClasses(updated);
    generateFreshSchedule(tasks, updated, prefs);
  };

  const deleteUniClass = (classId) => {
    const updated = uniClasses.filter(c => c.id !== classId);
    setUniClasses(updated);
    generateFreshSchedule(tasks, updated, prefs);
  };

  const toggleUniClass = (classId) => {
    const updated = uniClasses.map(c =>
      c.id === classId ? { ...c, enabled: !c.enabled } : c
    );
    setUniClasses(updated);
    generateFreshSchedule(tasks, updated, prefs);
  };

  const addTask = (task) => {
    const newTask = { ...task, id: `t${Date.now()}`, status: STATUS.PENDING };
    const updated = [...tasks, newTask];
    setTasks(updated);
    generateFreshSchedule(updated, uniClasses, prefs);
  };

  const updateTask = (taskId, updates) => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    setTasks(updated);
    generateFreshSchedule(updated, uniClasses, prefs);
  };

  const deleteTask = (taskId) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    generateFreshSchedule(updated, uniClasses, prefs);
  };

  const markDone = (taskId) => handleRebuild({ type: 'COMPLETE_TASK', taskId });
  const skipTask = (taskId) => handleRebuild({ type: 'SKIP_TASK', taskId });
  const addChatMessage = (msg) => setChatMessages(prev => [...prev, msg]);

  const sharedProps = {
    prefs, tasks, uniClasses, schedule, rolledOver,
    completedTaskIds, skippedTaskIds, endDayMins,
    getCurrentMins, rebuildCount, user,
    onRebuild: handleRebuild,
    onMarkDone: markDone,
    onSkipTask: skipTask,
    onAddTask: addTask,
    onUpdateTask: updateTask,
    onDeleteTask: deleteTask,
    chatMessages,
    onAddChatMessage: addChatMessage,
    onSetEndDayMins: setEndDayMins,
    onAddClass: addUniClass,
    onDeleteClass: deleteUniClass,
    onToggleClass: toggleUniClass,
    onLogout: handleLogout,
  };

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0f0a12', color: '#d4a0d4',
        fontSize: 32, fontFamily: 'serif'
      }}>
        ◎
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;
  if (!onboarded) return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  return (
    <div className="app-root">
      <div className="app-content">
        {screen === 'dashboard'  && <DashboardScreen  {...sharedProps} />}
        {screen === 'schedule'   && <ScheduleScreen   {...sharedProps} />}
        {screen === 'chat'       && <ChatScreen        {...sharedProps} />}
        {screen === 'tasks'      && <TaskManagerScreen {...sharedProps} />}
        {screen === 'timetable'  && <TimetableScreen  {...sharedProps} />}
      </div>
      <nav className="bottom-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            className={`nav-item ${screen === item.id ? 'active' : ''}`}
            onClick={() => setScreen(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.id === 'chat' && <span className="nav-badge">AI</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
