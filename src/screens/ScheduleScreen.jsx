import React, { useState, useEffect, useRef, useCallback } from 'react';
import { minsToTime, formatDuration, buildSchedule, timeToMins } from '../engine/scheduler';

const HOUR_HEIGHT = 64;
const SNAP_MINS = 15;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getTodayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function timeToMinsFallback(t) {
  if (!t) return 420;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function snapToGrid(mins) {
  return Math.round(mins / SNAP_MINS) * SNAP_MINS;
}

export default function ScheduleScreen({
  schedule, tasks, completedTaskIds, skippedTaskIds, endDayMins,
  getCurrentMins, onMarkDone, onSkipTask, onUpdateTask, onRebuild, prefs, uniClasses
}) {
  const [currentMins, setCurrentMins] = useState(getCurrentMins());
  const [selectedDay, setSelectedDay] = useState(getTodayIndex());
  const containerRef = useRef(null);
  const todayIndex = getTodayIndex();

  // Drag state
  const [dragging, setDragging] = useState(null); // { block, startY, startMins, currentMins }
  const [dragY, setDragY] = useState(0);
  const longPressTimer = useRef(null);
  const isDragging = useRef(false);

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
  const dayName = DAY_FULL[selectedDay];

  const daySchedule = isToday
    ? schedule
    : buildSchedule({
        uniClasses: (uniClasses || []).filter(c => c.enabled !== false && c.day === dayName),
        tasks: tasks.filter(t => {
          if (t.status === 'done' || t.status === 'skipped') return false;
          if (t.recurring && t.recurringDays) return t.recurringDays.includes(DAYS[selectedDay]);
          return false;
        }),
        wakeTime: prefs.wakeTime || '07:00',
        endDayTime: prefs.endDayTime || '22:00',
        breakDuration: prefs.workStyle === 'short-sessions' ? 15 : 10,
      }).blocks;

  const startMins = timeToMinsFallback(prefs.wakeTime || '07:00');
  const endMinsDay = timeToMinsFallback(prefs.endDayTime || '22:00');
  const totalHours = Math.ceil((endMinsDay - startMins) / 60);
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startMins + i * 60);
  const pxFromMins = (mins) => ((mins - startMins) / 60) * HOUR_HEIGHT;
  const minsFromPx = (px) => startMins + (px / HOUR_HEIGHT) * 60;

  // Long press handlers
  // Attach non-passive touch listeners directly to the grid
  const gridRef = useRef(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const onTouchStart = (e) => {
      // Find which block was touched
      const target = e.target.closest('.schedule-block.draggable');
      if (!target) return;

      const blockId = target.dataset.blockId;
      const block = daySchedule.find(b => b.id === blockId);
      if (!block) return;

      e.preventDefault();
      const touch = e.touches[0];
      const startY = touch.clientY;

      longPressTimer.current = setTimeout(() => {
        isDragging.current = true;
        setDragging({ block, startY, originalMins: block.startMins, currentDropMins: block.startMins });
        if (navigator.vibrate) navigator.vibrate(40);
      }, 350);
    };

    grid.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => grid.removeEventListener('touchstart', onTouchStart);
  }, [daySchedule]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }
    if (!dragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    const deltaY = touch.clientY - dragging.startY;
    const deltaMins = (deltaY / HOUR_HEIGHT) * 60;
    const rawMins = dragging.originalMins + deltaMins;
    const snapped = snapToGrid(rawMins);
    const clamped = Math.max(startMins, Math.min(endMinsDay - dragging.block.duration, snapped));

    setDragY(deltaY);
    setDragging(d => ({ ...d, currentDropMins: clamped }));
  }, [dragging, startMins, endMinsDay]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;

    if (!isDragging.current || !dragging) {
      isDragging.current = false;
      return;
    }

    isDragging.current = false;
    const { block, currentDropMins } = dragging;

    // Update the task's preferred time and rebuild
    const newTime = minsToTime(currentDropMins);
    const task = tasks.find(t => t.id === block.taskId);
    if (task) {
      onUpdateTask(task.id, { ...task, preferredTime: newTime });
      onRebuild({ type: 'RESCHEDULE_FROM', fromMins: getCurrentMins() });
    }

    setDragging(null);
    setDragY(0);
  }, [dragging, tasks, onUpdateTask, onRebuild, getCurrentMins]);

  const handleTouchCancel = useCallback(() => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    isDragging.current = false;
    setDragging(null);
    setDragY(0);
  }, []);

  const draggedMins = dragging?.currentDropMins ?? 0;
  const draggedBlock = dragging?.block;

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

      {isToday && (
        <div className="other-day-note">Hold & drag a task to reschedule it</div>
      )}
      {!isToday && (
        <div className="other-day-note">Showing recurring tasks and classes for {dayName}</div>
      )}

      <div
        className="timeline-container"
        ref={containerRef}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{ touchAction: 'pan-y' }}
      >
        <div className="timeline-grid" ref={gridRef} style={{ height: totalHours * HOUR_HEIGHT }}>
          {hours.map(hourMins => (
            <div key={hourMins} className="hour-line" style={{ top: pxFromMins(hourMins) }}>
              <span className="hour-label">{minsToTime(hourMins)}</span>
              <div className="hour-tick" />
            </div>
          ))}

          {/* Drop target indicator while dragging */}
          {dragging && (
            <div
              className="drag-drop-indicator"
              style={{
                top: pxFromMins(draggedMins) + 8,
                height: Math.max(32, ((draggedBlock.endMins - draggedBlock.startMins) / 60) * HOUR_HEIGHT - 4),
              }}
            >
              <span className="drag-drop-time">{minsToTime(draggedMins)}</span>
            </div>
          )}

          {/* Current time indicator */}
          {isToday && currentMins >= startMins && currentMins <= endDayMins && (
            <div className="current-time-line" style={{ top: pxFromMins(currentMins) }}>
              <div className="current-time-dot" />
              <div className="current-time-bar" />
              <span className="current-time-label">{minsToTime(currentMins)}</span>
            </div>
          )}

          {/* Schedule blocks */}
          {daySchedule.map(block => {
            const isDraggingThis = draggedBlock?.id === block.id;
            const top = pxFromMins(block.startMins);
            const height = Math.max(32, ((block.endMins - block.startMins) / 60) * HOUR_HEIGHT - 4);
            const isDone = completedTaskIds.includes(block.taskId);
            const isSkipped = skippedTaskIds.includes(block.taskId);
            const isPast = isToday && block.endMins < currentMins;
            const isNec = block.isNecessity;
            const canDrag = isToday && block.type === 'task' && !isDone && !isSkipped && !isNec;

            return (
              <div
                key={block.id}
                data-block-id={block.id}
                className={`schedule-block ${block.type} ${isDone ? 'done' : ''} ${isSkipped ? 'skipped' : ''} ${isPast && !isDone ? 'past' : ''} ${isNec ? 'necessity-block' : ''} ${isDraggingThis ? 'dragging' : ''} ${canDrag ? 'draggable' : ''}`}
                style={{
                  top: isDraggingThis ? pxFromMins(draggedMins) + 8 : top + 8,
                  height,
                  borderLeftColor: block.color,
                  zIndex: isDraggingThis ? 50 : 1,
                  opacity: isDraggingThis ? 0.85 : 1,
                  transform: isDraggingThis ? 'scale(1.02)' : 'none',
                  transition: isDraggingThis ? 'none' : 'top 0.2s ease, transform 0.15s ease',
                  boxShadow: isDraggingThis ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                  touchAction: canDrag ? 'none' : 'auto',
                }}
              >
                <div className="block-content">
                  <div className="block-title">
                    {block.title}
                    {isNec && <span className="necessity-tag">⭐</span>}
                    {canDrag && <span className="drag-handle">⠿</span>}
                    {block.isSplit && <span className="split-tag">↧</span>}
                    {isDone && <span className="done-tag">✓</span>}
                    {isSkipped && <span className="skip-tag">—</span>}
                  </div>
                  <div className="block-time">
                    {minsToTime(isDraggingThis ? draggedMins : block.startMins)} – {minsToTime(isDraggingThis ? draggedMins + (block.endMins - block.startMins) : block.endMins)}
                    {' '}· {formatDuration(block.endMins - block.startMins)}
                  </div>
                </div>
                {isToday && block.type === 'task' && !isDone && !isSkipped && !isDraggingThis && (
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

      {/* Drag overlay hint */}
      {dragging && (
        <div className="drag-overlay-hint">
          Drop at {minsToTime(draggedMins)} — release to confirm
        </div>
      )}
    </div>
  );
}
