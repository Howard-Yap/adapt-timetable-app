import React, { useState, useRef, useEffect } from 'react';
import { parseIntent, processIntent } from '../engine/aiAssistant';

const QUICK_ACTIONS = [
  "I'm running late",
  "I'm ready to start",
  "What's next?",
  "What's left today?",
  "Skip this task",
  "I'm tired",
  "Focus mode for 1 hour",
  "Rebuild my day",
];

export default function ChatScreen({
  schedule, tasks, endDayMins, getCurrentMins,
  completedTaskIds, skippedTaskIds, chatMessages,
  onAddChatMessage, onRebuild
}) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = (text) => {
    const currentMins = getCurrentMins();
    const userMsg = { role: 'user', text, time: new Date() };
    onAddChatMessage(userMsg);
    setInput('');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isTyping) sendMessage(input.trim());
  };

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const intentLabel = (type) => {
    const map = {
      'RUNNING_LATE':     '⏰ Late detected',
      'FULL_REBUILD':     '🔁 Rebuilding',
      'LOWER_LOAD':       '😌 Lightening load',
      'SKIP_TASK':        '⏭ Task skipped',
      'MOVE_TASK':        '📅 Task moved',
      'COMPLETE_TASK':    '✓ Task done',
      'MARK_DONE':        '✓ Marked done',
      'SET_END_TIME':     '🌙 End time updated',
      'SET_REMAINING_TIME': '⏳ Time adjusted',
      'START_AT':         '⏰ Time shifted',
      'TOOK_BREAK':       '☕ Break noted',
      'PUSH_ALL':         '→ Schedule shifted',
      'START_NOW':        '▶ Starting now',
      // new
      'ADD_TASK':         '➕ Task added',
      'EXTEND_TASK':      '⏱ Task extended',
      'PRIORITISE_TASK':  '⬆ Priority raised',
      'FOCUS_MODE':       '🎯 Focus mode on',
      'QUERY_REMAINING':  '📋 Tasks remaining',
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

      <div className="quick-actions">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action}
            className="quick-action-btn"
            onClick={() => sendMessage(action)}
            disabled={isTyping}
          >
            {action}
          </button>
        ))}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          className="chat-input"
          placeholder="Tell me what's happening..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isTyping}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!input.trim() || isTyping}
        >
          ↑
        </button>
      </form>
    </div>
  );
}
