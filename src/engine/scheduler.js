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

  // Add class blocks
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

  // Separate tasks with preferred time from those without
  const fixedTasks = pendingTasks.filter(t => t.preferredTime);
  const flexTasks = pendingTasks.filter(t => !t.preferredTime);

  // Track occupied intervals (classes + fixed tasks) for collision detection
  const occupied = sortedClasses.map(c => ({
    start: timeToMins(c.startTime),
    end: timeToMins(c.endTime),
  }));

  const unscheduledTasks = [];

  // Place fixed-time tasks first
  fixedTasks.forEach(task => {
    const preferredStart = timeToMins(task.preferredTime);
    const preferredEnd = preferredStart + task.duration;

    // Check if within day bounds
    if (preferredStart < startMins || preferredEnd > endMins) {
      unscheduledTasks.push(task);
      return;
    }

    // Check for collisions with existing occupied slots
    const collision = occupied.some(o => preferredStart < o.end && preferredEnd > o.start);
    if (collision) {
      // Try to find the nearest free slot after preferred time
      const freeWindows = computeFreeWindows(startMins, endMins, [
        ...sortedClasses,
        ...occupied.filter(o => o.taskId), // already-placed fixed tasks
      ]);
      const fallback = freeWindows.find(w => w.end - w.start >= task.duration);
      if (fallback) {
        const s = fallback.start;
        blocks.push(makeTaskBlock(task, s, s + task.duration));
        occupied.push({ start: s, end: s + task.duration, taskId: task.id });
      } else {
        unscheduledTasks.push(task);
      }
      return;
    }

    blocks.push(makeTaskBlock(task, preferredStart, preferredEnd));
    occupied.push({ start: preferredStart, end: preferredEnd, taskId: task.id });
  });

  // Compute free windows around all occupied slots (classes + fixed tasks)
  const allOccupied = occupied.sort((a, b) => a.start - b.start);
  const freeWindows = computeFreeWindowsFromOccupied(startMins, endMins, allOccupied);

  // Fill remaining free windows with flex tasks
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
          blocks.push({
            ...makeTaskBlock(task, cursor, cursor + splitDuration),
            title: `${task.title} (cont.)`,
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

function makeTaskBlock(task, startMins, endMins) {
  return {
    id: `task-${task.id}-${startMins}`,
    type: 'task',
    title: task.title,
    startMins,
    endMins,
    taskId: task.id,
    priority: task.priority,
    color: priorityColor(task.priority),
    preferredTime: task.preferredTime || null,
  };
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