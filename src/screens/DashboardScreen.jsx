import React, { useState, useEffect } from 'react';
import { minsToTime, formatDuration, timeToMins } from '../engine/scheduler';
import { PRIORITY } from '../engine/scheduler';

export default function DashboardScreen({
  prefs, tasks, schedule, rolledOver, completedTaskIds, skippedTaskIds,
  endDayMins, getCurrentMins, rebuildCount, onRebuild, onMarkDone, onSkipTask, onLogout
}) {
  const [currentMins, setCurrentMins] = useState(getCurrentMins());
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentMins(getCurrentMins());
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const now = currentMins;

  // Stats
  const totalTasks = tasks.filter(t => !skippedTaskIds.includes(t.id)).length;
  const doneTasks = completedTaskIds.length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const timeRemaining = endDayMins - now;

  // Current / next block
  const currentBlock = schedule.find(b => b.startMins <= now && b.endMins > now);
  const nextBlock = schedule.find(b => b.startMins > now && !completedTaskIds.includes(b.taskId) && !skippedTaskIds.includes(b.taskId));

  // Upcoming blocks (next 5)
  const upcomingBlocks = schedule
    .filter(b => b.endMins > now)
    .slice(0, 5);

  const currentTask = currentBlock?.taskId ? tasks.find(t => t.id === currentBlock.taskId) : null;
  const nextTask = nextBlock?.taskId ? tasks.find(t => t.id === nextBlock.taskId) : null;

  const priorityLabel = (p) => {
    if (p === PRIORITY.HIGH) return { label: 'High', cls: 'priority-high' };
    if (p === PRIORITY.MEDIUM) return { label: 'Med', cls: 'priority-med' };
    return { label: 'Low', cls: 'priority-low' };
  };

  const timeFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="screen">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <div className="header-greeting">
            {prefs.name ? `Hey, ${prefs.name} 👋` : 'Good day 👋'}
          </div>
          <div className="header-time">{timeFormat(currentTime)}</div>
        </div>
        <div className="header-actions">
          <button className="rebuild-btn" onClick={() => onRebuild({ type: 'FULL_REBUILD' })}>
            ↺ Rebuild
          </button>
          <button className="signout-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <span>{doneTasks}/{totalTasks} tasks complete</span>
          <span className="progress-pct">{completionPct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-bar-fill" style={{ width: `${completionPct}%` }} />
        </div>
        <div className="progress-footer">
          <span>⏰ {formatDuration(Math.max(0, timeRemaining))} remaining today</span>
          <span>🌙 End: {minsToTime(endDayMins)}</span>
        </div>
      </div>

      {/* Current Task */}
      {currentBlock && (
        <div className="current-task-card">
          <div className="current-label">▶ NOW</div>
          <div className="current-title">
            {currentBlock.title}
          </div>
          <div className="current-meta">
            {minsToTime(currentBlock.startMins)} → {minsToTime(currentBlock.endMins)}
            {currentTask && (
              <span className={`priority-badge ${priorityLabel(currentTask.priority).cls}`}>
                {priorityLabel(currentTask.priority).label}
              </span>
            )}
          </div>
          {currentBlock.type === 'task' && (
            <div className="current-actions">
              <button
                className="action-btn done"
                onClick={() => onMarkDone(currentBlock.taskId)}
              >
                ✓ Done
              </button>
              <button
                className="action-btn skip"
                onClick={() => onSkipTask(currentBlock.taskId)}
              >
                → Skip
              </button>
            </div>
          )}
          {/* Time elapsed bar */}
          <div className="elapsed-track">
            <div
              className="elapsed-fill"
              style={{
                width: `${Math.min(100, ((now - currentBlock.startMins) / (currentBlock.endMins - currentBlock.startMins)) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      {!currentBlock && (
        <div className="no-current-card">
          <span>🕐 Between tasks — take a breath!</span>
        </div>
      )}

      {/* Next Up */}
      {nextBlock && (
        <div className="next-card">
          <div className="next-label">NEXT UP</div>
          <div className="next-content">
            <span className="next-title">{nextBlock.title}</span>
            <span className="next-time">@ {minsToTime(nextBlock.startMins)}</span>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="upcoming-section">
        <div className="section-title">Upcoming</div>
        <div className="upcoming-list">
          {upcomingBlocks.length === 0 && (
            <div className="empty-state">All done for today! 🎉</div>
          )}
          {upcomingBlocks.map(block => {
            const isDone = completedTaskIds.includes(block.taskId);
            const isSkipped = skippedTaskIds.includes(block.taskId);
            return (
              <div
                key={block.id}
                className={`upcoming-item ${block.type} ${isDone ? 'done' : ''} ${isSkipped ? 'skipped' : ''} ${block.isRebuilt ? 'rebuilt' : ''}`}
              >
                <div
                  className="upcoming-color"
                  style={{ background: block.color }}
                />
                <div className="upcoming-info">
                  <div className="upcoming-title">
                    {block.title}
                    {block.isSplit && <span className="split-badge">split</span>}
                    {block.isRebuilt && <span className="rebuilt-badge">↺</span>}
                    {isDone && <span className="done-badge">✓</span>}
                    {isSkipped && <span className="skipped-badge">—</span>}
                  </div>
                  <div className="upcoming-time">
                    {minsToTime(block.startMins)} – {minsToTime(block.endMins)}
                    <span className="upcoming-dur">
                      ({formatDuration(block.endMins - block.startMins)})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rollover notice */}
      {rolledOver.length > 0 && (
        <div className="rollover-notice">
          <span className="rollover-icon">→</span>
          <span>{rolledOver.length} task{rolledOver.length > 1 ? 's' : ''} rolled to tomorrow</span>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}
