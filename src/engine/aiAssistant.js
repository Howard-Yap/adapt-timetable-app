import { minsToTime, timeToMins, formatDuration, PRIORITY } from './scheduler';

// =============================================
// INTENT PARSER
// Converts free-text messages into structured intents
// =============================================

export function parseIntent(message) {
  const msg = message.toLowerCase().trim();

  // --- ADD TASK ---
  const addMatch =
    msg.match(/^add\s+(.+?)(?:\s+to\s+(?:my\s+)?(?:schedule|list|tasks?))?$/i) ||
    msg.match(/^i need to\s+(.+)$/i) ||
    msg.match(/^remind me to\s+(.+)$/i) ||
    msg.match(/^(?:can you\s+)?add\s+(.+?)\s+to\s+(?:my\s+)?(?:schedule|list|tasks?)/i) ||
    msg.match(/^(?:schedule|put)\s+(.+?)\s+(?:in|on|into)\s+(?:my\s+)?(?:schedule|list|today)/i);
  if (addMatch) {
    const raw = addMatch[1].trim();
    const { title, duration, priority } = parseTaskDetails(raw);
    return { type: 'ADD_TASK', title, duration, priority, raw: message };
  }

  // --- EXTEND TASK ---
  const extendMatch =
    msg.match(/(?:need|give me|want)\s+(?:more|extra|another)\s+(?:time\s+)?(?:for\s+)?(?:on\s+)?(.+?)(?:\s*[,—–]\s*|\s+by\s+|\s+for\s+)(\d+)\s*(?:min(?:utes?)?|h(?:ours?)?)/i) ||
    msg.match(/extend\s+(.+?)\s+by\s+(\d+)\s*(?:min(?:utes?)?|h(?:ours?)?)/i) ||
    msg.match(/(\d+)\s*(?:more\s+)?(?:min(?:utes?)?|h(?:ours?)?)\s+(?:more\s+)?(?:for|on)\s+(.+)/i) ||
    msg.match(/still\s+working\s+on\s+(.+)/i) ||
    msg.match(/not\s+(?:done|finished)\s+(?:with\s+)?(.+)\s+yet/i);

  if (extendMatch) {
    // normalise group order: some patterns have (task, mins), one has (mins, task)
    let taskHint, extraMins;
    if (extendMatch[0].match(/^(\d+)\s*(?:more\s+)?(?:min|h)/i)) {
      // pattern: "30 more mins for X"
      const rawMins = extendMatch[1];
      taskHint = extendMatch[2];
      extraMins = parseMinutes(rawMins, extendMatch[0]);
    } else if (extendMatch[2] && /^\d+$/.test(extendMatch[2])) {
      taskHint = extendMatch[1];
      extraMins = parseMinutes(extendMatch[2], extendMatch[0]);
    } else {
      // "still working on X" / "not done with X yet" — default 30 mins
      taskHint = extendMatch[1];
      extraMins = 30;
    }
    return { type: 'EXTEND_TASK', taskHint: taskHint?.trim(), extraMins, raw: message };
  }

  // --- PRIORITISE TASK ---
  const priorityMatch =
    msg.match(/(?:make|set|mark)\s+(.+?)\s+(?:as\s+)?(?:high|urgent|top|important)\s*(?:priority)?/i) ||
    msg.match(/(.+?)\s+is\s+(?:urgent|important|high priority|top priority)/i) ||
    msg.match(/(?:bump|move|push)\s+(.+?)\s+(?:up|to\s+the\s+top|higher)/i) ||
    msg.match(/(?:prioriti[sz]e|prioritise)\s+(.+)/i);
  if (priorityMatch) {
    return { type: 'PRIORITISE_TASK', taskHint: priorityMatch[1].trim(), raw: message };
  }

  // --- QUERY REMAINING TASKS ---
  if (
    /how many tasks\s*(?:left|remaining|do i have)/i.test(msg) ||
    /what(?:'s|\s+is)\s+(?:left|remaining)\s*(?:today|for today)?/i.test(msg) ||
    /what\s+haven'?t\s+i\s+(?:done|finished|completed)/i.test(msg) ||
    /tasks?\s+(?:left|remaining|to go)/i.test(msg) ||
    /(?:still\s+)?(?:to\s+do|on\s+my\s+list)\s*(?:today)?/i.test(msg)
  ) {
    return { type: 'QUERY_REMAINING', raw: message };
  }

  // --- START AT (specific time) ---
  const startAtMatch = msg.match(/start(?:ing)?\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (startAtMatch) {
    return { type: 'START_AT', time: parseTimeFromMatch(startAtMatch), raw: message };
  }

  // "X instead of Y" time rephrase
  const insteadMatch = msg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+instead\s+of/i);
  if (insteadMatch) {
    return { type: 'START_AT', time: parseTimeFromMatch(insteadMatch), raw: message };
  }

  // --- RUNNING LATE ---
  if (/running\s+late|i'?m\s+late|got\s+delayed|stuck\s+in|held\s+up|delayed/i.test(msg)) {
    const minsMatch = msg.match(/(\d+)\s*min/i);
    const delay = minsMatch ? parseInt(minsMatch[1]) : 30;
    return { type: 'RUNNING_LATE', delayMins: delay, raw: message };
  }

  // --- TOOK BREAK ---
  const breakMatch = msg.match(
    /(?:took?|taking|had|having|just\s+had)\s+(?:a\s+)?(?:longer\s+)?(?:break|rest|nap|breather)(?:\s+(?:for|of)\s+(\d+)\s*(?:min(?:utes?)?|h(?:ours?)?))?/i
  ) || msg.match(/was\s+(?:resting|napping|on\s+a\s+break)\s+(?:for\s+)?(\d+)?\s*(?:min(?:utes?)?|h(?:ours?)?)?/i)
    || msg.match(/took\s+(\d+)\s*(?:min(?:utes?)?)\s+off/i);
  if (breakMatch) {
    const dur = breakMatch[1] ? parseMinutes(breakMatch[1], breakMatch[0]) : 30;
    return { type: 'TOOK_BREAK', extraMins: dur, raw: message };
  }

  // --- PUSH ALL ---
  const pushAllMatch = msg.match(/push\s+(?:everything|all|(?:my\s+)?schedule)\s+(?:by|back|forward)\s+(\d+)/i);
  if (pushAllMatch) {
    return { type: 'PUSH_ALL', delayMins: parseInt(pushAllMatch[1]), raw: message };
  }

  // --- SKIP TASK ---
  if (/skip|can'?t\s+do|not\s+doing|won'?t\s+do|forget\s+(?:about\s+)?|drop\s+|remove\s+/i.test(msg)) {
    const taskHint = extractTaskHint(msg, ['skip', "can't do", 'not doing', "won't do", 'forget about', 'forget', 'drop', 'remove']);
    return { type: 'SKIP_TASK', taskHint, raw: message };
  }

  // --- MOVE TASK ---
  const moveMatch =
    msg.match(/(?:push|move|reschedule|delay|defer|put\s+off)\s+(.+?)\s+(?:to\s+)?(tomorrow|next\s+week|later|another\s+day)/i) ||
    msg.match(/i'?ll\s+do\s+(.+?)\s+(tomorrow|later|next\s+week)/i) ||
    msg.match(/(?:do|tackle)\s+(.+?)\s+(tomorrow|later)/i);
  if (moveMatch) {
    return { type: 'MOVE_TASK', taskHint: moveMatch[1].trim(), when: moveMatch[2], raw: message };
  }

  // --- MARK DONE ---
  const doneMatch =
    msg.match(/(?:done|finished|completed|just\s+did|just\s+finished|wrapped\s+up|ticked\s+off|knocked\s+out)\s+(?:with\s+)?(.+)/i) ||
    msg.match(/^(?:i\s+)?did\s+(.+)$/i) ||
    msg.match(/(.+)\s+is\s+done/i) ||
    msg.match(/^done$/i);
  if (doneMatch) {
    const taskHint = doneMatch[1]?.trim() || '';
    return { type: 'MARK_DONE', taskHint, raw: message };
  }

  // --- LOWER LOAD ---
  if (/tired|exhausted|burnt?\s*out|need\s+a\s+break|not\s+feeling|overwhelmed|too\s+much/i.test(msg)) {
    return { type: 'LOWER_LOAD', level: 'tired', raw: message };
  }
  if (/make\s+(?:it|today|my\s+day)\s+lighter|lighten|ease\s+up|less\s+today|take\s+it\s+easy/i.test(msg)) {
    return { type: 'LOWER_LOAD', level: 'lighter', raw: message };
  }

  // --- INCREASE LOAD ---
  if (/more\s+energy|feeling\s+good|productive|let'?s\s+go|on\s+a\s+roll|i'?m\s+on\s+fire|pumped|motivated/i.test(msg)) {
    return { type: 'INCREASE_LOAD', raw: message };
  }

  // --- SET REMAINING TIME ---
  const onlyTimeMatch = msg.match(/(?:only\s+have|(?:i\s+)?got|have)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:left|remaining|today)?/i);
  if (onlyTimeMatch) {
    return { type: 'SET_REMAINING_TIME', hours: parseFloat(onlyTimeMatch[1]), raw: message };
  }

  // --- SET END TIME ---
  const endEarlierMatch = msg.match(/(?:end|stop|wrap\s+up|finish)\s+(?:at|by|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (endEarlierMatch) {
    return { type: 'SET_END_TIME', time: parseTimeFromMatch(endEarlierMatch), raw: message };
  }
  const finishByMatch = msg.match(/(?:need\s+to\s+)?finish\s+by\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (finishByMatch) {
    return { type: 'SET_END_TIME', time: parseTimeFromMatch(finishByMatch), raw: message };
  }

  // --- START NOW ---
  if (/start\s+now|ready\s+now|able\s+to\s+start|starting\s+now|start\s+early|begin\s+now|free\s+now|available\s+now|ready\s+to\s+start|i'?m\s+ready|im\s+ready|let'?s\s+start|let'?s\s+go|let'?s\s+begin|begin|let'?s\s+do\s+this/i.test(msg)) {
    return { type: 'START_NOW', raw: message };
  }

  // --- FULL REBUILD ---
  if (/rebuild|start\s+fresh|start\s+over|reset|redo\s+my\s+day|new\s+schedule|replan|restructure|fix\s+my\s+schedule|reorgani[sz]e/i.test(msg)) {
    return { type: 'FULL_REBUILD', raw: message };
  }

  // --- QUERIES ---
  if (/what'?s\s+next|next\s+task|what\s+should\s+(?:i\s+do)?|what\s+do\s+i\s+do/i.test(msg)) {
    return { type: 'QUERY_NEXT', raw: message };
  }
  if (/how\s+much\s+time|time\s+left|remaining\s+time|how\s+long\s+(?:do\s+i\s+have|left)/i.test(msg)) {
    return { type: 'QUERY_TIME_LEFT', raw: message };
  }
  if (/show\s+(?:my\s+)?schedule|what'?s\s+on|my\s+plan|today'?s\s+plan|what\s+(?:do\s+i\s+have|have\s+i\s+got)\s+(?:today|on)?/i.test(msg)) {
    return { type: 'QUERY_SCHEDULE', raw: message };
  }

  return { type: 'UNKNOWN', raw: message };
}

// =============================================
// INTENT PROCESSOR
// Converts parsed intents into mutations + responses
// =============================================

export function processIntent(intent, state) {
  const { schedule, tasks, currentMins, endDayMins, completedTaskIds, skippedTaskIds } = state;

  switch (intent.type) {

    case 'ADD_TASK': {
      const newTask = {
        id: `task-added-${Date.now()}`,
        title: intent.title,
        duration: intent.duration,
        priority: intent.priority,
        status: 'pending',
        deadline: null,
      };
      const priorityLabel = intent.priority === PRIORITY.HIGH ? 'high' : intent.priority === PRIORITY.MEDIUM ? 'medium' : 'low';
      return {
        mutation: { type: 'ADD_TASK', task: newTask },
        response: `Added "${intent.title}" (${formatDuration(intent.duration)}, ${priorityLabel} priority) to your schedule. Rebuilding to fit it in.`,
        triggerRebuild: true,
      };
    }

    case 'EXTEND_TASK': {
      const matched = findTask(intent.taskHint, tasks, schedule, currentMins);
      const current = getCurrentBlock(schedule, currentMins);
      const target = matched || (current?.taskId ? tasks.find(t => t.id === current.taskId) : null);
      if (target) {
        return {
          mutation: { type: 'EXTEND_TASK', taskId: target.id, extraMins: intent.extraMins },
          response: `Got it — giving "${target.title}" an extra ${formatDuration(intent.extraMins)}. Compressing the rest of your day to compensate.`,
          triggerRebuild: true,
        };
      }
      return { response: `I'm not sure which task to extend. Try saying "extend [task name] by 30 mins".`, triggerRebuild: false };
    }

    case 'PRIORITISE_TASK': {
      const matched = findTask(intent.taskHint, tasks, schedule, currentMins);
      if (matched) {
        return {
          mutation: { type: 'PRIORITISE_TASK', taskId: matched.id },
          response: `"${matched.title}" is now high priority — moving it earlier in your schedule.`,
          triggerRebuild: true,
        };
      }
      return { response: `I couldn't find that task. Try saying the name more clearly.`, triggerRebuild: false };
    }

    case 'QUERY_REMAINING': {
      const remaining = tasks.filter(t =>
        !completedTaskIds.includes(t.id) &&
        !skippedTaskIds.includes(t.id) &&
        (t.status === 'pending' || t.status === 'delayed')
      );
      if (remaining.length === 0) {
        return { response: `You've finished everything for today! 🌸`, triggerRebuild: false };
      }
      const high = remaining.filter(t => t.priority === PRIORITY.HIGH);
      const list = remaining.slice(0, 5).map(t => `• ${t.title}`).join('\n');
      const extra = remaining.length > 5 ? `\n…and ${remaining.length - 5} more.` : '';
      return {
        response: `You have ${remaining.length} task${remaining.length > 1 ? 's' : ''} left${high.length ? ` (${high.length} high priority)` : ''}:\n${list}${extra}`,
        triggerRebuild: false,
      };
    }

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
      const newFrom = alreadyStarted
        ? currentMins + d
        : (firstTask ? firstTask.startMins + d : currentMins + d);
      return {
        mutation: { type: 'RESCHEDULE_FROM', fromMins: newFrom },
        response: `No worries — shifted everything forward by ${formatDuration(d)}. Your end time is still protected at ${minsToTime(endDayMins)}.`,
        triggerRebuild: true,
      };
    }

    case 'TOOK_BREAK': {
      const extra = intent.extraMins;
      return {
        mutation: { type: 'RESCHEDULE_FROM', fromMins: currentMins + extra },
        response: `Breaks are important! Accounted for that extra ${formatDuration(extra)} and rebuilt your remaining schedule.`,
        triggerRebuild: true,
      };
    }

    case 'PUSH_ALL': {
      return {
        mutation: { type: 'RESCHEDULE_FROM', fromMins: currentMins + intent.delayMins },
        response: `Pushed everything forward by ${formatDuration(intent.delayMins)}. Highest-priority tasks are kept for today.`,
        triggerRebuild: true,
      };
    }

    case 'SKIP_TASK': {
      const matched = findTask(intent.taskHint, tasks, schedule, currentMins);
      if (matched) {
        return {
          mutation: { type: 'SKIP_TASK', taskId: matched.id },
          response: `Skipped "${matched.title}". Moved to backlog and filled the gap with your next task.`,
          triggerRebuild: true,
        };
      }
      const current = getCurrentBlock(schedule, currentMins);
      if (current?.taskId) {
        const task = tasks.find(t => t.id === current.taskId);
        return {
          mutation: { type: 'SKIP_TASK', taskId: current.taskId },
          response: `Skipped "${task?.title || 'current task'}". Moving on — schedule updated.`,
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
          response: `Moved "${matched.title}" to ${intent.when}. Schedule updated.`,
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
        t.priority === PRIORITY.LOW &&
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
        ? `Totally understand — rest matters. Removed ${lowTasks.length} low-priority task${lowTasks.length > 1 ? 's' : ''} from today.`
        : `Done — moved ${lowTasks.length} optional task${lowTasks.length > 1 ? 's' : ''} out. Focus on what matters most.`;
      return {
        mutation: { type: 'LOWER_LOAD' },
        response: msg,
        triggerRebuild: true,
      };
    }

    case 'INCREASE_LOAD': {
      return {
        mutation: { type: 'INCREASE_LOAD' },
        response: `Love the energy! Pulled some backlog tasks into today's schedule.`,
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
        response: `End time set to ${minsToTime(intent.time)}. Anything that doesn't fit moves to tomorrow.`,
        triggerRebuild: true,
      };
    }

    case 'START_NOW': {
      const nextTask = getNextBlock(schedule, currentMins, completedTaskIds, skippedTaskIds);
      if (nextTask) {
        return {
          mutation: { type: 'RESCHEDULE_FROM', fromMins: currentMins },
          response: `Let's go! Moved "${nextTask.title}" to start right now and shifted everything accordingly.`,
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
        '"Add [task name] to my schedule"',
        '"Extend [task] by 30 mins"',
        '"Make [task] high priority"',
        '"Focus mode for 1 hour"',
        '"What\'s left today?"',
        '"Rebuild my day"',
      ];
      return {
        response: `I didn't quite catch that. Try saying something like:\n${suggestions.join('\n')}`,
        triggerRebuild: false,
      };
    }
  }
}

// =============================================
// HELPERS
// =============================================

function parseTimeFromMatch(match) {
  let h = parseInt(match[1]);
  const m = match[2] ? parseInt(match[2]) : 0;
  const ampm = match[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + m;
}

function parseMinutes(value, fullMatch = '') {
  const n = parseInt(value);
  if (/h(?:ours?)?/i.test(fullMatch.slice(fullMatch.indexOf(value) + value.length, fullMatch.indexOf(value) + value.length + 5))) {
    return n * 60;
  }
  return n;
}

/**
 * Parse a raw task string like "review notes for 45 mins" or "finish essay, high priority"
 * Returns { title, duration, priority }
 */
function parseTaskDetails(raw) {
  let title = raw;
  let duration = 30; // default 30 mins
  let priority = PRIORITY.MEDIUM;

  // Extract duration — "for 45 mins", "45 min", "1 hour", "1h"
  const durMatch = raw.match(/(?:for\s+)?(\d+(?:\.\d+)?)\s*(h(?:ours?)?|hr?s?|min(?:utes?)?|m)\b/i);
  if (durMatch) {
    const n = parseFloat(durMatch[1]);
    duration = /h/i.test(durMatch[2]) ? Math.round(n * 60) : Math.round(n);
    title = raw.replace(durMatch[0], '').trim().replace(/,\s*$/, '').trim();
  }

  // Extract priority — "high priority", "urgent", "low priority"
  if (/\b(?:high|urgent|important)\b/i.test(title)) {
    priority = PRIORITY.HIGH;
    title = title.replace(/\b(?:high\s+priority|urgent|important)\b/i, '').trim().replace(/,\s*$/, '').trim();
  } else if (/\blow\s+priority\b/i.test(title)) {
    priority = PRIORITY.LOW;
    title = title.replace(/\blow\s+priority\b/i, '').trim().replace(/,\s*$/, '').trim();
  }

  // Clean up leading/trailing filler words
  title = title
    .replace(/^(?:to\s+|a\s+|an\s+)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalise first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, duration, priority };
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
  return tasks.find(t =>
    t.title.toLowerCase().includes(h) || h.includes(t.title.toLowerCase())
  ) || null;
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