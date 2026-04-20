import React, { useState, useEffect, useRef } from 'react';
import { minsToTime, formatDuration } from '../engine/scheduler';

const HOUR_HEIGHT = 64; // px per hour

export default function ScheduleScreen({
  schedule, tasks, completedTaskIds, skippedTaskIds, endDayMins,
  getCurrentMins, onMarkDone, onSkipTask, prefs
}) {
  const [currentMins, setCurrentMins] = useState(getCurrentMins());
  const containerRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentMins(getCurrentMins()), 60000);
    return () => clearInterval(t);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (containerRef.current) {
      const startMins = timeToMinsFallback(prefs.wakeTime || '07:00');
      const offset = ((currentMins - startMins) / 60) * HOUR_HEIGHT - 80;
      containerRef.current.scrollTop = Math.max(0, offset);
    }
  }, []);

  const startMins = timeToMinsFallback(prefs.wakeTime || '07:00');
  const totalMins = endDayMins - startMins;
  const totalHours = Math.ceil(totalMins / 60);
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startMins + i * 60);

  const pxFromMins = (mins) => ((mins - startMins) / 60) * HOUR_HEIGHT;

  return (
    <div className="screen schedule-screen">
      <div className="screen-header">
        <h2 className="screen-title">Live Schedule</h2>
        <div className="schedule-legend">
          <span className="legend-item"><span className="legend-dot high" />High</span>
          <span className="legend-item"><span className="legend-dot med" />Med</span>
          <span className="legend-item"><span className="legend-dot low" />Low</span>
          <span className="legend-item"><span className="legend-dot event" />Event</span>
        </div>
      </div>

      <div className="timeline-container" ref={containerRef}>
        {/* Hour grid */}
        <div className="timeline-grid" style={{ height: totalHours * HOUR_HEIGHT }}>
          {hours.map(hourMins => (
            <div
              key={hourMins}
              className="hour-line"
              style={{ top: pxFromMins(hourMins) }}
            >
              <span className="hour-label">{minsToTime(hourMins)}</span>
              <div className="hour-tick" />
            </div>
          ))}

          {/* Current time indicator */}
          {currentMins >= startMins && currentMins <= endDayMins && (
            <div
              className="current-time-line"
              style={{ top: pxFromMins(currentMins) }}
            >
              <div className="current-time-dot" />
              <div className="current-time-bar" />
              <span className="current-time-label">{minsToTime(currentMins)}</span>
            </div>
          )}

          {/* Schedule blocks */}
          {schedule.map(block => {
            const top = pxFromMins(block.startMins);
            const height = Math.max(32, ((block.endMins - block.startMins) / 60) * HOUR_HEIGHT - 4);
            const isDone = completedTaskIds.includes(block.taskId);
            const isSkipped = skippedTaskIds.includes(block.taskId);
            const isPast = block.endMins < currentMins;

            return (
              <div
                key={block.id}
                className={`schedule-block ${block.type} ${isDone ? 'done' : ''} ${isSkipped ? 'skipped' : ''} ${isPast && !isDone ? 'past' : ''} ${block.isRebuilt ? 'rebuilt' : ''}`}
                style={{
                  top: top + 8,
                  height,
                  borderLeftColor: block.color,
                }}
              >
                <div className="block-content">
                  <div className="block-title">
                    {block.title}
                    {block.isSplit && <span className="split-tag">↧</span>}
                    {block.isRebuilt && <span className="rebuilt-tag">↺</span>}
                    {isDone && <span className="done-tag">✓</span>}
                    {isSkipped && <span className="skip-tag">—</span>}
                  </div>
                  <div className="block-time">
                    {minsToTime(block.startMins)} – {minsToTime(block.endMins)}
                    {' '}· {formatDuration(block.endMins - block.startMins)}
                  </div>
                </div>
                {block.type === 'task' && !isDone && !isSkipped && (
                  <div className="block-actions">
                    <button className="micro-btn done" onClick={() => onMarkDone(block.taskId)}>✓</button>
                    <button className="micro-btn skip" onClick={() => onSkipTask(block.taskId)}>→</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function timeToMinsFallback(t) {
  if (!t) return 420;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
