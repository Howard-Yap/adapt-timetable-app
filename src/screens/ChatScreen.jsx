import React, { useState, useRef, useEffect } from 'react';
import { parseIntent, processIntent } from '../engine/aiAssistant';

const QUICK_ACTIONS = [
  // Time & Schedule
  { label: "I'm running late",             msg: "I'm running late" },
  { label: "Running late 15 mins",         msg: "I'm running late by 15 minutes" },
  { label: "Running late 30 mins",         msg: "I'm running late by 30 minutes" },
  { label: "Push everything back 20 mins", msg: "Push everything back 20 minutes" },
  { label: "Start now",                    msg: "I'm ready to start" },
  { label: "Start at 9am",                 msg: "Starting at 9am" },
  { label: "Start at 10am",                msg: "Starting at 10am" },
  { label: "Finish by 6pm",                msg: "Finish by 6pm" },
  { label: "Finish by 8pm",                msg: "Finish by 8pm" },
  { label: "Only have 2 hours left",       msg: "I only have 2 hours left today" },
  { label: "Only have 1 hour left",        msg: "I only have 1 hour left today" },
  { label: "Rebuild my day",               msg: "Rebuild my day" },

  // Tasks
  { label: "What's next?",                 msg: "What's next?" },
  { label: "What's left today?",           msg: "What's left today?" },
  { label: "Skip this task",               msg: "Skip this task" },
  { label: "Mark this done",               msg: "Done" },
  { label: "Move this to tomorrow",        msg: "Move this task to tomorrow" },
  { label: "Extend task 15 mins",          msg: "Still working on this, extend by 15 minutes" },
  { label: "Extend task 30 mins",          msg: "Still working on this, extend by 30 minutes" },
  { label: "Make this high priority",      msg: "Make this task high priority" },
  { label: "Add 30 min study block",       msg: "Add study block for 30 mins" },
  { label: "Add 1 hr revision",            msg: "Add revision for 1 hour, high priority" },
  { label: "Show my schedule",             msg: "Show my schedule" },
  { label: "How much time left?",          msg: "How much time do I have left?" },

  // Energy & Load
  { label: "I'm tired",                    msg: "I'm tired" },
  { label: "I'm exhausted",               msg: "I'm exhausted" },
  { label: "Make today lighter",           msg: "Make today lighter" },
  { label: "Feeling productive",           msg: "Feeling good and productive" },
  { label: "On a roll — add more",         msg: "I'm on a roll" },

  // Breaks
  { label: "Just had a break",             msg: "I just had a break" },
  { label: "Took a 15 min break",          msg: "I took a 15 minute break" },
  { label: "Took a 30 min break",          msg: "I took a 30 minute break" },

  // Focus
  { label: "Focus mode 30 mins",           msg: "Focus mode for 30 minutes" },
  { label: "Focus mode 1 hour",            msg: "Focus mode for 1 hour" },
  { label: "Focus mode 2 hours",           msg: "Focus mode for 2 hours" },
];

export default function ChatScreen({
  schedule, tasks, endDayMins, getCurrentMins,
  completedTaskIds, skippedTaskIds, chatMessages,
  onAddChatMessage, onRebuild
}) {
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = (text) => {
    if (isTyping) return;
    const currentMins = getCurrentMins();
    const userMsg = { role: 'user', text, time: new Date() };
    onAddChatMessage(userMsg);
    setIsTyping(true);

    setTimeout(() => {
      const intent = parseIntent(text);
      const result = processIntent(intent, {
        schedule,
        tasks,
        currentMins,
        endDayMins,
        completedTaskIds,
        skippedTaskIds,
      });

      if (result.triggerRebuild && result.mutation) {
        onRebuild(result.mutation);
      }

      const aiMsg = {
        role: 'ai',
        text: result.response,
        intent: intent.type,
        time: new Date(),
        didRebuild: result.triggerRebuild,
      };
      onAddChatMessage(aiMsg);
      setIsTyping(false);
    }, 600);
  };

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const intentLabel = (type) => {
    const map = {
      'RUNNING_LATE':       '⏰ Late detected',
      'FULL_REBUILD':       '🔁 Rebuilding',
      'LOWER_LOAD':         '😌 Lightening load',
      'SKIP_TASK':          '⏭ Task skipped',
      'MOVE_TASK':          '📅 Task moved',
      'COMPLETE_TASK':      '✓ Task done',
      'MARK_DONE':          '✓ Marked done',
      'SET_END_TIME':       '🌙 End time updated',
      'SET_REMAINING_TIME': '⏳ Time adjusted',
      'START_AT':           '⏰ Time shifted',
      'TOOK_BREAK':         '☕ Break noted',
      'PUSH_ALL':           '→ Schedule shifted',
      'START_NOW':          '▶ Starting now',
      'ADD_TASK':           '➕ Task added',
      'EXTEND_TASK':        '⏱ Task extended',
      'PRIORITISE_TASK':    '⬆ Priority raised',
      'FOCUS_MODE':         '🎯 Focus mode on',
      'QUERY_REMAINING':    '📋 Tasks remaining',
    };
    return map[type] || null;
  };

  return (
    <div className="screen chat-screen">
      <div className="chat-header">
        <div className="chat-ai-avatar">◎</div>
        <div>
          <div className="chat-ai-name">Adapt AI</div>
          <div className="chat-ai-status">● Watching your schedule</div>
        </div>
      </div>

      {/* Message history */}
      <div className="chat-messages">
        {chatMessages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            {msg.role === 'ai' && <div className="msg-avatar">◎</div>}
            <div className="msg-bubble-wrap">
              {msg.intent && intentLabel(msg.intent) && (
                <div className="intent-tag">{intentLabel(msg.intent)}</div>
              )}
              <div className="msg-bubble">
                {msg.text.split('\n').map((line, j) => (
                  <React.Fragment key={j}>
                    {line.startsWith('•') ? (
                      <div className="msg-bullet">{line}</div>
                    ) : (
                      <span>{line}</span>
                    )}
                    {j < msg.text.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
              <div className="msg-time">{formatTime(msg.time)}</div>
              {msg.didRebuild && (
                <div className="rebuild-indicator">↺ Schedule rebuilt</div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="chat-message ai">
            <div className="msg-avatar">◎</div>
            <div className="msg-bubble typing-bubble">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scrollable pill actions — main interaction surface */}
      <div className="quick-actions quick-actions-expanded">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.label}
            className="quick-action-btn"
            onClick={() => sendMessage(action.msg)}
            disabled={isTyping}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
