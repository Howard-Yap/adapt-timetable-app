export const PRIORITY = { HIGH: 3, MEDIUM: 2, LOW: 1 };
export const STATUS = { PENDING: 'pending', DONE: 'done', SKIPPED: 'skipped', DELAYED: 'delayed' };

export function timeToMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minsToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function buildSchedule({ uniClasses = [], tasks, wakeTime, endDayTime, breakDuration = 10 }) {
  const startMins = timeToMins(wakeTime);
  const endMins = timeToMins(endDayTime);

  const sortedClasses = [...uniClasses]
    .filter(c => c.enabled !== false)
    .sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));

  const freeWindows = computeFreeWindows(startMins, endMins, sortedClasses);

  const pendingTasks = tasks
    .filter(t => t.status === STATUS.PENDING || t.status === STATUS.DELAYED)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

  const blocks = [];

  sortedClasses.forEach(c => {
    blocks.push({
      id: `class-${c.id}`,
      type: 'class',
      title: c.title,
      startMins: timeToMins(c.startTime),
      endMins: timeToMins(c.endTime),
      classId: c.id,
      color: c.color || '#7c6bff',
      location: c.location,
      classType: c.classType,
    });
  });

  let taskQueue = [...pendingTasks];
  const unscheduledTasks = [];

  for (const window of freeWindows) {
    let cursor = window.start;
    while (taskQueue.length > 0 && cursor < window.end) {
      const task = taskQueue[0];
      const remaining = window.end - cursor;
      if (task.duration <= remaining) {
        blocks.push({
          id: `task-${task.id}-${cursor}`,
          type: 'task',
          title: task.title,
          startMins: cursor,
          endMins: cursor + task.duration,
          taskId: task.id,
          priority: task.priority,
          color: priorityColor(task.priority),
        });
        cursor += task.duration + breakDuration;
        taskQueue.shift();
      } else if (remaining >= 30) {
        const splitDuration = remaining - breakDuration;
        if (splitDuration >= 25) {
          blocks.push({
            id: `task-${task.id}-split-${cursor}`,
            type: 'task',
            title: `${task.title} (cont.)`,
            startMins: cursor,
            endMins: cursor + splitDuration,
            taskId: task.id,
            priority: task.priority,
            color: priorityColor(task.priority),
            isSplit: true,
          });
          taskQueue[0] = { ...task, duration: task.duration - splitDuration };
        }
        cursor = window.end;
      } else {
        break;
      }
    }
  }

  unscheduledTasks.push(...taskQueue);
  return { blocks: blocks.sort((a, b) => a.startMins - b.startMins), unscheduledTasks };
}

function computeFreeWindows(startMins, endMins, sortedClasses) {
  const windows = [];
  let cursor = startMins;
  for (const c of sortedClasses) {
    const cStart = timeToMins(c.startTime);
    const cEnd = timeToMins(c.endTime);
    if (cStart > cursor) windows.push({ start: cursor, end: cStart });
    cursor = Math.max(cursor, cEnd);
  }
  if (cursor < endMins) windows.push({ start: cursor, end: endMins });
  return windows;
}

function priorityColor(priority) {
  if (priority === PRIORITY.HIGH) return '#ef4444';
  if (priority === PRIORITY.MEDIUM) return '#f59e0b';
  return '#22c55e';
}