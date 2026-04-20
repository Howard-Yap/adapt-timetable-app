import { minsToTime, formatDuration } from './scheduler';

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
export function parseIntent(message) {
  return { type: 'AI', raw: message };
}

export async function processIntentAsync(message, state) {
  const { schedule, tasks, currentMins, endDayMins, completedTaskIds, skippedTaskIds } = state;

  const pendingTasks = tasks
    .filter(t => !completedTaskIds.includes(t.id) && !skippedTaskIds.includes(t.id))
    .map(t => `- ${t.title} (${t.duration}min, priority: ${t.priority === 3 ? 'High' : t.priority === 2 ? 'Medium' : 'Low'})`);

  const upcomingBlocks = schedule
    .filter(b => b.endMins > currentMins)
    .slice(0, 6)
    .map(b => `- ${minsToTime(b.startMins)}-${minsToTime(b.endMins)}: ${b.title}`);

  const systemPrompt = [
    'You are a warm, smart scheduling assistant for a personal timetable app.',
    'The user tells you about their day and you respond helpfully in 2-3 sentences.',
    '',
    `Current time: ${minsToTime(currentMins)}`,
    `End of day: ${minsToTime(endDayMins)}`,
    `Time remaining: ${formatDuration(endDayMins - currentMins)}`,
    '',
    'Upcoming schedule:',
    upcomingBlocks.join('\n') || 'Nothing scheduled',
    '',
    'Pending tasks:',
    pendingTasks.join('\n') || 'No pending tasks',
    '',
    'After your response, always output an action block:',
    '<action>',
    '{"type":"NONE","fromMins":0,"taskTitle":"","endMins":0}',
    '</action>',
    '',
    'Action types:',
    'NONE - no schedule change needed',
    'RESCHEDULE_FROM - user is late or wants to start later (set fromMins = current time + delay in minutes, current time = ' + currentMins + ')',
    'SKIP_TASK - skip a task (set taskTitle)',
    'COMPLETE_TASK - mark task done (set taskTitle)',
    'LOWER_LOAD - user is tired or wants lighter day',
    'INCREASE_LOAD - user has more energy',
    'FULL_REBUILD - restart the day',
    'SET_END_TIME - finish earlier (set endMins)',
    '',
    'For task addition requests, use NONE and tell them to use the Tasks tab.',
    'Always be warm and helpful. Never say you are not sure how to help.',
  ].join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('API error:', err);
      return {
        response: `API error: ${err.error?.message || response.status}`,
        mutation: null,
        triggerRebuild: false,
      };
    }

    const data = await response.json();
    const fullText = data.content?.[0]?.text || '';

    const actionMatch = fullText.match(/<action>([\s\S]*?)<\/action>/);
    let mutation = null;
    let responseText = fullText.replace(/<action>[\s\S]*?<\/action>/, '').trim();

    if (actionMatch) {
      try {
        const action = JSON.parse(actionMatch[1].trim());
        if (action.type !== 'NONE') {
          if (action.type === 'SKIP_TASK' || action.type === 'COMPLETE_TASK') {
            const matched = tasks.find(t =>
              t.title.toLowerCase().includes(action.taskTitle.toLowerCase()) ||
              action.taskTitle.toLowerCase().includes(t.title.toLowerCase())
            );
            if (matched) mutation = { type: action.type, taskId: matched.id };
          } else if (action.type === 'RESCHEDULE_FROM') {
            mutation = { type: 'RESCHEDULE_FROM', fromMins: action.fromMins };
          } else if (action.type === 'SET_END_TIME') {
            mutation = { type: 'SET_END_TIME', endMins: action.endMins };
          } else {
            mutation = { type: action.type };
          }
        }
      } catch (e) {
        console.error('Action parse error:', e);
      }
    }

    return { response: responseText, mutation, triggerRebuild: mutation !== null };

  } catch (err) {
    console.error('Fetch error:', err);
    return {
      response: "Couldn't connect to the AI. Check your internet connection.",
      mutation: null,
      triggerRebuild: false,
    };
  }
}

export function processIntent(intent, state) {
  return { response: 'Processing...', triggerRebuild: false };
}