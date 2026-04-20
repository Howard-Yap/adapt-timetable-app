export const PRIORITY = { HIGH: 3, MEDIUM: 2, LOW: 1 };
export const STATUS = { PENDING: 'pending', DONE: 'done', SKIPPED: 'skipped', DELAYED: 'delayed' };
export const CATEGORY = { NECESSITY: 'necessity' };

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

  const occupied = sortedClasses.map(c => ({
    start: timeToMins(c.startTime),
    end: timeToMins(c.endTime),
  }));

  const unscheduledTasks = [];

  const necessityTasks = pendingTasks.filter(t => t.category === 'necessity');
  const fixedTasks = pendingTasks.filter(t => t.preferredTime && t.category !== 'necessity');
  const flexTasks = pendingTasks.filter(t => !t.preferredTime && t.category !== 'necessity');

  // Necessity tasks — always at their preferred time, never moved
  necessityTasks.forEach(task => {
    if (!task.preferredTime) { flexTasks.push(task); return; }
    const anchorStart = timeToMins(task.preferredTime);
    const anchorEnd = anchorStart + task.duration;
    if (anchorEnd > endMins) { unscheduledTasks.push(task); return; }
    blocks.push(makeTaskBlock(task, anchorStart, anchorEnd));
    occupied.push({ start: anchorStart, end: anchorEnd, taskId: task.id });
  });

  // Fixed-time tasks — placed at preferred time, shift on collision
  fixedTasks.forEach(task => {
    const preferredStart = timeToMins(task.preferredTime);
    const preferredEnd = preferredStart + task.duration;
    if (preferredEnd <= startMins || preferredEnd > endMins) { unscheduledTasks.push(task); return; }
    const actualStart = Math.max(preferredStart, startMins);
    const actualEnd = actualStart + task.duration;
    if (actualEnd > endMins) { unscheduledTasks.push(task); return; }
    const collision = occupied.some(o => actualStart < o.end && actualEnd > o.start);
    if (collision) {
      const allOcc = [...occupied].sort((a, b) => a.start - b.start);
      const freeWins = computeFreeWindowsFromOccupied(startMins, endMins, allOcc);
      const fallback = freeWins.find(w => w.start >= actualStart && w.end - w.start >= task.duration)
        || freeWins.find(w => w.end - w.start >= task.duration);
      if (fallback) {
        const s = Math.max(fallback.start, actualStart);
        const e = s + task.duration;
        if (e <= endMins) { blocks.push(makeTaskBlock(task, s, e)); occupied.push({ start: s, end: e, taskId: task.id }); }
        else unscheduledTasks.push(task);
      } else unscheduledTasks.push(task);
      return;
    }
    blocks.push(makeTaskBlock(task, actualStart, actualEnd));
    occupied.push({ start: actualStart, end: actualEnd, taskId: task.id });
  });

  // Flex tasks — fill free windows by priority
  const allOccSorted = [...occupied].sort((a, b) => a.start - b.start);
  const freeWindows = computeFreeWindowsFromOccupied(startMins, endMins, allOccSorted);
  let taskQueue = [...flexTasks];

  for (const window of freeWindows) {
    let cursor = window.start;
    while (taskQueue.length > 0 && cursor < window.end) {
      const task = taskQueue[0];
      const remaining = window.end - cursor;
      if (task.duration <= remaining) {
        blocks.push(makeTaskBlock(task, cursor, cursor + task.duration));
        cursor += task.duration + breakDuration;
        taskQueue.shift();
      } else if (remaining >= 30) {
        const splitDuration = remaining - breakDuration;
        if (splitDuration >= 25) {
          blocks.push({ ...makeTaskBlock(task, cursor, cursor + splitDuration), title: `${task.title} (cont.)`, isSplit: true });
          taskQueue[0] = { ...task, duration: task.duration - splitDuration };
        }
        cursor = window.end;
      } else { break; }
    }
  }

  unscheduledTasks.push(...taskQueue);
  return { blocks: blocks.sort((a, b) => a.startMins - b.startMins), unscheduledTasks };
}

function makeTaskBlock(task, startMins, endMins) {
  return {
    id: `task-${task.id}-${startMins}`,
    type: 'task',
    title: task.title,
    startMins,
    endMins,
    taskId: task.id,
    priority: task.priority,
    color: task.category === 'necessity' ? '#c084fc' : priorityColor(task.priority),
    preferredTime: task.preferredTime || null,
    isNecessity: task.category === 'necessity',
  };
}

function computeFreeWindowsFromOccupied(startMins, endMins, sortedOccupied) {
  const windows = [];
  let cursor = startMins;
  for (const o of sortedOccupied) {
    if (o.start > cursor) windows.push({ start: cursor, end: o.start });
    cursor = Math.max(cursor, o.end);
  }
  if (cursor < endMins) windows.push({ start: cursor, end: endMins });
  return windows;
}

function priorityColor(priority) {
  if (priority === PRIORITY.HIGH) return '#ef4444';
  if (priority === PRIORITY.MEDIUM) return '#f59e0b';
  return '#22c55e';
}