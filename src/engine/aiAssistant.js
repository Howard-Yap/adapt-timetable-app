import { minsToTime, timeToMins, formatDuration } from './scheduler';

export function parseIntent(message) {
  const msg = message.toLowerCase().trim();

  const startAtMatch = msg.match(/start(?:ing)? at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (startAtMatch) {
    const time = parseTimeFromMatch(startAtMatch);
    return { type: 'START_AT', time, raw: message };
  }

  if (/running late|i'?m late|got delayed|stuck/.test(msg)) {
    const minsMatch = msg.match(/(\d+)\s*min/);
    const delay = minsMatch ? parseInt(minsMatch[1]) : 30;
    return { type: 'RUNNING_LATE', delayMins: delay, raw: message };
  }

  const breakMatch = msg.match(/(?:took?|taking)\s+(?:a\s+)?(?:longer\s+)?break(?:\s+(?:for|of)\s+(\d+)\s*(?:min(?:utes?)?|h(?:ours?)?))?/);
  if (breakMatch) {
    const dur = breakMatch[1] ? parseInt(breakMatch[1]) : 30;
    return { type: 'TOOK_BREAK', extraMins: dur, raw: message };
  }

  const insteadMatch = msg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*instead of/);
  if (insteadMatch) {
    const time = parseTimeFromMatch(insteadMatch);
    return { type: 'START_AT', time, raw: message };
  }

  const pushAllMatch = msg.match(/push (?:everything|all|schedule) (?:by|back) (\d+)/);
  if (pushAllMatch) {
    return { type: 'PUSH_ALL', delayMins: parseInt(pushAllMatch[1]), raw: message };
  }

  if (/skip|can'?t do|not doing|won'?t do|forget/.test(msg)) {
    const taskHint = extractTaskHint(msg, ['skip', "can't do", 'not doing', "won't do", 'forget']);
    return { type: 'SKIP_TASK', taskHint, raw: message };
  }

  const pushMatch = msg.match(/(?:push|move|reschedule)\s+(.+?)\s+(?:to\s+)?(tomorrow|next week|later)/);
  if (pushMatch) {
    return { type: 'MOVE_TASK', taskHint: pushMatch[1], when: pushMatch[2], raw: message };
  }

  const doneMatch = msg.match(/(?:done|finished|completed|just did)\s+(?:with\s+)?(.+)/);
  if (doneMatch) {
    return { type: 'MARK_DONE', taskHint: doneMatch[1], raw: message };
  }

  if (/tired|exhausted|burnt? ?out|need a break|not feeling/.test(msg)) {
    return { type: 'LOWER_LOAD', level: 'tired', raw: message };
  }

  if (/make (?:it|today|my day) lighter|lighten|ease up|less today/.test(msg)) {
    return { type: 'LOWER_LOAD', level: 'lighter', raw: message };
  }

  if (/more energy|feeling good|productive|let'?s go|on a roll/.test(msg)) {
    return { type: 'INCREASE_LOAD', raw: message };
  }

  const onlyTimeMatch = msg.match(/(?:only have|got)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:left|remaining|today)?/);
  if (onlyTimeMatch) {
    const hours = parseFloat(onlyTimeMatch[1]);
    return { type: 'SET_REMAINING_TIME', hours, raw: message };
  }

  const endEarlierMatch = msg.match(/end (?:at|by|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (endEarlierMatch) {
    const time = parseTimeFromMatch(endEarlierMatch);
    return { type: 'SET_END_TIME', time, raw: message };
  }

  const finishByMatch = msg.match(/finish (?:at|by|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (finishByMatch) {
    const time = parseTimeFromMatch(finishByMatch);
    return { type: 'SET_END_TIME', time, raw: message };
  }

  if (/start now|ready now|able to start|starting now|start early|begin now|free now|available now|ready to start|i'm ready|im ready/.test(msg)) {
    return { type: 'START_NOW', raw: message };
  }

  if (/rebuild|start fresh|start over|reset|redo my day|new schedule/.test(msg)) {
    return { type: 'FULL_REBUILD', raw: message };
  }

  if (/what'?s next|next task|what should|what do i do/.test(msg)) {
    return { type: 'QUERY_NEXT', raw: message };
  }

  if (/how much time|time left|remaining time/.test(msg)) {
    return { type: 'QUERY_TIME_LEFT', raw: message };
  }

  if (/show (?:my )?schedule|what'?s on|my plan|today'?s plan/.test(msg)) {
    return { type: 'QUERY_SCHEDULE', raw: message };
  }

  return { type: 'UNKNOWN', raw: message };
}

export function processIntent(intent, state) {
  const { schedule, tasks, currentMins, endDayMins, completedTaskIds, skippedTaskIds } = state;

  switch (intent.type) {
    case 'START_AT': {
      const newStartMins = intent.time;
      const delay = newStartMins - currentMins;
      return {
        mutation: { type: 'RESCHEDULE_FROM', fromMins: newStartMins },
        response: `Got it — shifting your schedule to start at ${minsToTime(newStartMins)}. ${delay > 0 ? `That's +${formatDuration(delay)} — adjusted to fit before ${minsToTime(endDayMins)}.` : `You're starting ${formatDuration(Math.abs(delay))} early!`}`,
        triggerRebuild: true,
      };
    }

    case 'RUNNING_LATE': {
      const d = intent.delayMins;
      const firstTask = schedule.find(b => b.type === 'task');
      const alreadyStarted = firstTask && currentMins >= firstTask.startMins;
      const newFrom = alreadyStarted ? currentMins + d : (firstTask ? firstTask.startMins + d : currentMins + d);
      return {
        mutation: { type: 'RESCHEDULE_FROM', fromMins: newFrom },
        response: `No worries — I've shifted everything forward by ${formatDuration(d)}. Your end time is still protected at ${minsToTime(endDayMins)}.`,
        triggerRebuild: true,
      };
    }

    case 'TOOK_BREAK': {
      const extra = intent.extraMins;
      return {
        mutation: { type: 'RESCHEDULE_FROM', fromMins: currentMins + extra },
        response: `Breaks are important! I've accounted for that extra ${formatDuration(extra)} and rebuilt your remaining schedule.`,
        triggerRebuild: true,
      };
    }

    case 'PUSH_ALL': {
      return {
        mutation: { type: 'RESCHEDULE_FROM', fromMins: currentMins + intent.delayMins },
        response: `Pushed everything forward by ${formatDuration(intent.delayMins)}. Your highest-priority tasks are kept for today.`,
        triggerRebuild: true,
      };
    }

    case 'SKIP_TASK': {
      const matched = findTask(intent.taskHint, tasks, schedule, currentMins);
      if (matched) {
        return {
          mutation: { type: 'SKIP_TASK', taskId: matched.id },
          response: `Skipped "${matched.title}". I've moved it to your backlog and filled the gap with your next task.`,
          triggerRebuild: true,
        };
      }
      const current = getCurrentBlock(schedule, currentMins);
      if (current?.taskId) {
        const task = tasks.find(t => t.id === current.taskId);
        return {
          mutation: { type: 'SKIP_TASK', taskId: current.taskId },
          response: `Skipped "${task?.title || 'current task'}". Moving on — I've updated your schedule.`,
          triggerRebuild: true,
        };
      }
      return { response: `I'm not sure which task to skip. Could you be more specific?`, triggerRebuild: false };
    }

    case 'MOVE_TASK': {
      const matched = findTask(intent.taskHint, tasks, schedule, currentMins);
      if (matched) {
        return {
          mutation: { type: 'SKIP_TASK', taskId: matched.id },
          response: `Moved "${matched.title}" to ${intent.when}. Your schedule has been updated.`,
          triggerRebuild: true,
        };
      }
      return { response: `I couldn't find that task. Try saying the task name more clearly.`, triggerRebuild: false };
    }

    case 'MARK_DONE': {
      const matched = findTask(intent.taskHint, tasks, schedule, currentMins);
      if (matched) {
        return {
          mutation: { type: 'COMPLETE_TASK', taskId: matched.id },
          response: `Nice work — "${matched.title}" is marked done! ✓`,
          triggerRebuild: true,
        };
      }
      const current = getCurrentBlock(schedule, currentMins);
      if (current?.taskId) {
        const task = tasks.find(t => t.id === current.taskId);
        return {
          mutation: { type: 'COMPLETE_TASK', taskId: current.taskId },
          response: `"${task?.title || 'Task'}" marked as done! Great progress.`,
          triggerRebuild: true,
        };
      }
      return { response: `I'm not sure which task you completed. Can you be more specific?`, triggerRebuild: false };
    }

    case 'LOWER_LOAD': {
      const lowTasks = tasks.filter(t =>
        t.priority === 1 &&
        !completedTaskIds.includes(t.id) &&
        !skippedTaskIds.includes(t.id)
      );
      if (lowTasks.length === 0) {
        return {
          response: `All your remaining tasks are medium or high priority. Try saying "skip [task name]" to remove a specific one.`,
          triggerRebuild: false,
        };
      }
      const msg = intent.level === 'tired'
        ? `Totally understand — rest matters. I've removed ${lowTasks.length} low-priority task${lowTasks.length > 1 ? 's' : ''} from today.`
        : `Done — moved ${lowTasks.length} optional task${lowTasks.length > 1 ? 's' : ''} to tomorrow. Focus on what matters most.`;
      return {
        mutation: { type: 'LOWER_LOAD' },
        response: msg,
        triggerRebuild: true,
      };
    }

    case 'INCREASE_LOAD': {
      return {
        mutation: { type: 'INCREASE_LOAD' },
        response: `Love the energy! I've pulled some backlog tasks into today's schedule.`,
        triggerRebuild: true,
      };
    }

    case 'SET_REMAINING_TIME': {
      const newEndMins = currentMins + Math.round(intent.hours * 60);
      return {
        mutation: { type: 'SET_END_TIME', endMins: newEndMins },
        response: `Understood — wrapping up by ${minsToTime(newEndMins)}. Rebuilt your schedule to fit only the most important tasks.`,
        triggerRebuild: true,
      };
    }

    case 'SET_END_TIME': {
      return {
        mutation: { type: 'SET_END_TIME', endMins: intent.time },
        response: `End time set to ${minsToTime(intent.time)}. Rebuilt your schedule — anything that doesn't fit moves to tomorrow.`,
        triggerRebuild: true,
      };
    }

    case 'START_NOW': {
      const nextTask = getNextBlock(schedule, currentMins, completedTaskIds, skippedTaskIds);
      if (nextTask) {
        return {
          mutation: { type: 'RESCHEDULE_FROM', fromMins: currentMins },
          response: `Let's go! I've moved "${nextTask.title}" to start right now and shifted everything accordingly.`,
          triggerRebuild: true,
        };
      }
      return { response: `You're all caught up — nothing left to reschedule!`, triggerRebuild: false };
    }

    case 'FULL_REBUILD': {
      return {
        mutation: { type: 'FULL_REBUILD' },
        response: `Rebuilding your day from scratch. Re-prioritised everything based on deadlines and importance, protecting your ${minsToTime(endDayMins)} end time.`,
        triggerRebuild: true,
      };
    }

    case 'QUERY_NEXT': {
      const next = getNextBlock(schedule, currentMins, completedTaskIds, skippedTaskIds);
      if (next) {
        const task = tasks.find(t => t.id === next.taskId);
        return {
          response: `Your next task is "${next.title}" starting at ${minsToTime(next.startMins)}${task?.duration ? ` (${formatDuration(task.duration)})` : ''}.`,
          triggerRebuild: false,
        };
      }
      return { response: `You're all done for today! Great work. 🌸`, triggerRebuild: false };
    }

    case 'QUERY_TIME_LEFT': {
      const remaining = endDayMins - currentMins;
      return {
        response: `You have ${formatDuration(Math.max(0, remaining))} left until your ${minsToTime(endDayMins)} end time.`,
        triggerRebuild: false,
      };
    }

    case 'QUERY_SCHEDULE': {
      const upcoming = schedule.filter(b => b.endMins > currentMins).slice(0, 4);
      if (upcoming.length === 0) return { response: `Nothing left scheduled for today.`, triggerRebuild: false };
      const list = upcoming.map(b => `• ${minsToTime(b.startMins)} — ${b.title}`).join('\n');
      return { response: `Here's what's coming up:\n${list}`, triggerRebuild: false };
    }

    default: {
      const suggestions = [
        '"I\'m running late"',
        '"Skip this task"',
        '"Make today lighter"',
        '"Rebuild my day"',
        '"What\'s next?"',
        '"Push [task] to tomorrow"',
      ];
      return {
        response: `I didn't quite catch that. Try saying something like:\n${suggestions.join('\n')}`,
        triggerRebuild: false,
      };
    }
  }
}

function parseTimeFromMatch(match) {
  let h = parseInt(match[1]);
  const m = match[2] ? parseInt(match[2]) : 0;
  const ampm = match[3];
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + m;
}

function extractTaskHint(msg, keywords) {
  for (const kw of keywords) {
    const idx = msg.indexOf(kw);
    if (idx !== -1) return msg.slice(idx + kw.length).trim();
  }
  return '';
}

function findTask(hint, tasks, schedule, currentMins) {
  if (!hint || hint.trim() === '') return null;
  const h = hint.toLowerCase().trim();
  const exact = tasks.find(t => t.title.toLowerCase() === h);
  if (exact) return exact;
  return tasks.find(t => t.title.toLowerCase().includes(h) || h.includes(t.title.toLowerCase())) || null;
}

function getCurrentBlock(schedule, currentMins) {
  return schedule.find(b => b.startMins <= currentMins && b.endMins > currentMins);
}

function getNextBlock(schedule, currentMins, completedTaskIds, skippedTaskIds) {
  return schedule.find(b =>
    b.endMins > currentMins &&
    b.type === 'task' &&
    !completedTaskIds.includes(b.taskId) &&
    !skippedTaskIds.includes(b.taskId)
  );
}