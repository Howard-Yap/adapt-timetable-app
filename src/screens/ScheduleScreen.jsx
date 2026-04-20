import React, { useState, useEffect, useRef } from 'react';
import { minsToTime, formatDuration, buildSchedule, timeToMins } from '../engine/scheduler';

const HOUR_HEIGHT = 64;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getTodayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1; // Mon=0 ... Sun=6
}

function timeToMinsFallback(t) {
  if (!t) return 420;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export default function ScheduleScreen({
  schedule, tasks, completedTaskIds, skippedTaskIds, endDayMins,
  getCurrentMins, onMarkDone, onSkipTask, prefs, uniClasses
}) {
  const [currentMins, setCurrentMins] = useState(getCurrentMins());
  const [selectedDay, setSelectedDay] = useState(getTodayIndex());
  const containerRef = useRef(null);
  const todayIndex = getTodayIndex();

  useEffect(() => {
    const t = setInterval(() => setCurrentMins(getCurrentMins()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      const startMins = timeToMinsFallback(prefs.wakeTime || '07:00');
      const offset = ((currentMins - startMins) / 60) * HOUR_HEIGHT - 80;
      containerRef.current.scrollTop = Math.max(0, offset);
    }
  }, [selectedDay]);

  const isToday = selectedDay === todayIndex;

  // Build the schedule for the selected day
  const dayName = DAY_FULL[selectedDay];
  const daySchedule = isToday
    ? schedule
    : buildSchedule({
        uniClasses: (uniClasses || []).filter(c => c.enabled !== false && c.day === dayName),
        tasks: tasks.filter(t => {
          if (t.status === 'done' || t.status === 'skipped') return false;
          if (t.recurring && t.recurringDays) {
            return t.recurringDays.includes(DAYS[selectedDay]);
          }
          return false; // non-recurring tasks only show on today
        }),
        wakeTime: prefs.wakeTime || '07:00',
        endDayTime: prefs.endDayTime || '22:00',
        breakDuration: prefs.workStyle === 'short-sessions' ? 15 : 10,
      }).blocks;

  const startMins = timeToMinsFallback(prefs.wakeTime || '07:00');
  const totalMins = timeToMinsFallback(prefs.endDayTime || '22:00') - startMins;
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

      {/* Day switcher */}
      <div className="day-switcher">
        {DAYS.map((day, i) => (
          <button
            key={day}
            className={`day-switch-btn ${selectedDay === i ? 'active' : ''} ${i === todayIndex ? 'today' : ''}`}
            onClick={() => setSelectedDay(i)}
          >
            {day}
            {i === todayIndex && <span className="today-dot" />}
          </button>
        ))}
      </div>

      {!isToday && (
        <div className="other-day-note">
          Showing recurring tasks and classes for {dayName}
        </div>
      )}

      <div className="timeline-container" ref={containerRef}>
        <div className="timeline-grid" style={{ height: totalHours * HOUR_HEIGHT }}>
          {hours.map(hourMins => (
            <div key={hourMins} className="hour-line" style={{ top: pxFromMins(hourMins) }}>
              <span className="hour-label">{minsToTime(hourMins)}</span>
              <div className="hour-tick" />
            </div>
          ))}

          {/* Current time indicator — only on today */}
          {isToday && currentMins >= startMins && currentMins <= endDayMins && (
            <div className="current-time-line" style={{ top: pxFromMins(currentMins) }}>
              <div className="current-time-dot" />
              <div className="current-time-bar" />
              <span className="current-time-label">{minsToTime(currentMins)}</span>
            </div>
          )}

          {/* Schedule blocks */}
          {daySchedule.map(block => {
            const top = pxFromMins(block.startMins);
            const height = Math.max(32, ((block.endMins - block.startMins) / 60) * HOUR_HEIGHT - 4);
            const isDone = completedTaskIds.includes(block.taskId);
            const isSkipped = skippedTaskIds.includes(block.taskId);
            const isPast = isToday && block.endMins < currentMins;

            return (
              <div
                key={block.id}
                className={`schedule-block ${block.type} ${isDone ? 'done' : ''} ${isSkipped ? 'skipped' : ''} ${isPast && !isDone ? 'past' : ''} ${block.isNecessity ? 'necessity-block' : ''}`}
                style={{ top: top + 8, height, borderLeftColor: block.color }}
              >
                <div className="block-content">
                  <div className="block-title">
                    {block.title}
                    {block.isNecessity && <span className="necessity-tag">⭐</span>}
                    {block.isSplit && <span className="split-tag">↧</span>}
                    {isDone && <span className="done-tag">✓</span>}
                    {isSkipped && <span className="skip-tag">—</span>}
                  </div>
                  <div className="block-time">
                    {minsToTime(block.startMins)} – {minsToTime(block.endMins)}
                    {' '}· {formatDuration(block.endMins - block.startMins)}
                  </div>
                </div>
                {isToday && block.type === 'task' && !isDone && !isSkipped && (
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
