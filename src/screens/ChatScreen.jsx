import React, { useState, useRef, useEffect } from 'react';
import { processIntentAsync } from '../engine/aiAssistant';

const QUICK_ACTIONS = [
  "I'm running late",
  "I'm ready to start",
  "Make today lighter",
  "Rebuild my day",
  "What's next?",
  "I'm tired",
  "Skip this task",
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

  const sendMessage = async (text) => {
    const currentMins = getCurrentMins();
    const userMsg = { role: 'user', text, time: new Date() };
    onAddChatMessage(userMsg);
    setInput('');
    setIsTyping(true);

    try {
      const result = await processIntentAsync(text, {
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
        time: new Date(),
        didRebuild: result.triggerRebuild,
      };
      onAddChatMessage(aiMsg);
    } catch (err) {
      onAddChatMessage({
        role: 'ai',
        text: "Sorry, something went wrong. Please try again.",
        time: new Date(),
        didRebuild: false,
      });
    }

    setIsTyping(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isTyping) sendMessage(input.trim());
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="screen chat-screen">
      <div className="chat-header">
        <div className="chat-ai-avatar">◎</div>
        <div>
          <div className="chat-ai-name">Adapt AI</div>
          <div className="chat-ai-status">● Powered by Claude</div>
        </div>
      </div>

      <div className="chat-messages">
        {chatMessages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            {msg.role === 'ai' && <div className="msg-avatar">◎</div>}
            <div className="msg-bubble-wrap">
              <div className="msg-bubble">
                {msg.text.split('\n').map((line, j) => (
                  <React.Fragment key={j}>
                    <span>{line}</span>
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
        <button type="submit" className="send-btn" disabled={!input.trim() || isTyping}>
          ↑
        </button>
      </form>
    </div>
  );
}