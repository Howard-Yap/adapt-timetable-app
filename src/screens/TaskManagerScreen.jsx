import React, { useState } from 'react';
import { PRIORITY, STATUS, formatDuration } from '../engine/scheduler';

const PRIORITY_OPTIONS = [
  { value: PRIORITY.HIGH, label: '🔴 High', cls: 'high' },
  { value: PRIORITY.MEDIUM, label: '🟡 Medium', cls: 'med' },
  { value: PRIORITY.LOW, label: '🟢 Low', cls: 'low' },
];

const STATUS_FILTERS = ['all', 'pending', 'done', 'skipped'];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

const EMPTY_FORM = {
  title: '',
  duration: 60,
  priority: PRIORITY.MEDIUM,
  deadline: '',
  category: '',
  recurring: false,
  recurringDays: [],
  preferredTime: '',
};

export default function TaskManagerScreen({
  tasks, rolledOver, completedTaskIds, skippedTaskIds,
  onAddTask, onUpdateTask, onDeleteTask, onMarkDone, onSkipTask
}) {
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'done') return completedTaskIds.includes(t.id);
    if (filter === 'skipped') return skippedTaskIds.includes(t.id);
    if (filter === 'pending') return !completedTaskIds.includes(t.id) && !skippedTaskIds.includes(t.id);
    return true;
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingTask(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    const taskData = {
      title: form.title.trim(),
      duration: parseInt(form.duration) || 60,
      priority: parseInt(form.priority),
      deadline: form.deadline || null,
      category: form.category,
      recurring: form.recurring,
      recurringDays: form.recurring ? form.recurringDays : [],
      preferredTime: form.preferredTime || null,
    };
    if (editingTask) {
      onUpdateTask(editingTask, { ...taskData, status: STATUS.PENDING });
    } else {
      onAddTask(taskData);
    }
    resetForm();
  };

  const startEdit = (task) => {
    setForm({
      title: task.title,
      duration: task.duration,
      priority: task.priority,
      deadline: task.deadline ? task.deadline.slice(0, 10) : '',
      category: task.category || '',
      recurring: task.recurring || false,
      recurringDays: task.recurringDays || [],
      preferredTime: task.preferredTime || '',
    });
    setEditingTask(task.id);
    setShowForm(true);
  };

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      recurringDays: f.recurringDays.includes(day)
        ? f.recurringDays.filter(d => d !== day)
        : [...f.recurringDays, day],
    }));
  };

  const setDaily = () => {
    setForm(f => ({ ...f, recurringDays: [...DAYS] }));
  };

  const getTaskStatus = (task) => {
    if (completedTaskIds.includes(task.id)) return 'done';
    if (skippedTaskIds.includes(task.id)) return 'skipped';
    return 'pending';
  };

  const priorityInfo = (p) => PRIORITY_OPTIONS.find(o => o.value === p) || PRIORITY_OPTIONS[1];

  const recurringLabel = (task) => {
    if (!task.recurring || !task.recurringDays?.length) return null;
    if (task.recurringDays.length === 7) return 'Daily';
    return task.recurringDays.join(', ');
  };

  return (
    <div className="screen tasks-screen">
      <div className="screen-header">
        <h2 className="screen-title">Tasks</h2>
        <button className="add-task-btn" onClick={() => setShowForm(true)}>+ Add</button>
      </div>

      {/* Stats row */}
      <div className="task-stats">
        <div className="stat-box">
          <div className="stat-num">{tasks.length}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-box done">
          <div className="stat-num">{completedTaskIds.length}</div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-box rolled">
          <div className="stat-num">{rolledOver.length}</div>
          <div className="stat-label">Tomorrow</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="task-list">
        {filtered.length === 0 && (
          <div className="empty-state">No {filter} tasks</div>
        )}
        {filtered.map(task => {
          const status = getTaskStatus(task);
          const p = priorityInfo(task.priority);
          const recLabel = recurringLabel(task);
          return (
            <div key={task.id} className={`task-card ${status}`}>
              <div className="task-left">
                <div className={`task-priority-dot ${p.cls}`} />
                <div className="task-info">
                  <div className="task-title">
                    {task.title}
                    {recLabel && <span className="recurring-badge">↻ {recLabel}</span>}
                  </div>
                  <div className="task-meta">
                    <span>{formatDuration(task.duration)}</span>
                    {task.deadline && (
                      <span className="task-deadline">
                        📅 {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`task-status-badge ${status}`}>{status}</span>
                  </div>
                </div>
              </div>
              <div className="task-actions">
                {status === 'pending' && (
                  <>
                    <button className="task-btn done" onClick={() => onMarkDone(task.id)}>✓</button>
                    <button className="task-btn skip" onClick={() => onSkipTask(task.id)}>→</button>
                  </>
                )}
                <button className="task-btn edit" onClick={() => startEdit(task)}>✎</button>
                <button className="task-btn del" onClick={() => onDeleteTask(task.id)}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rollover section */}
      {rolledOver.length > 0 && (
        <div className="rollover-section">
          <div className="rollover-header">→ Rolled to Tomorrow</div>
          {rolledOver.map(task => (
            <div key={task.id} className="task-card rolled">
              <div className="task-left">
                <div className={`task-priority-dot ${priorityInfo(task.priority).cls}`} />
                <div className="task-info">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    <span>{formatDuration(task.duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTask ? 'Edit Task' : 'New Task'}</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>

            <label className="input-label">Task name *</label>
            <input
              className="text-input"
              placeholder="What needs to get done?"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />

            <label className="input-label">Duration (minutes)</label>
            <input
              type="number"
              className="text-input"
              min={5}
              step={5}
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
            />

            <label className="input-label">Priority</label>
            <div className="priority-select">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`priority-opt ${form.priority == opt.value ? 'selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, priority: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="input-label">Deadline (optional)</label>
            <input
              type="date"
              className="text-input"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            />

            <label className="input-label">Preferred time (optional)</label>
            <input
              type="time"
              className="text-input"
              value={form.preferredTime}
              onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))}
            />

            {/* Recurring toggle */}
            <div className="recurring-row">
              <label className="input-label" style={{ margin: 0 }}>Recurring</label>
              <button
                className={`toggle-btn ${form.recurring ? 'on' : 'off'}`}
                onClick={() => setForm(f => ({
                  ...f,
                  recurring: !f.recurring,
                  recurringDays: !f.recurring ? [] : f.recurringDays,
                }))}
              >
                {form.recurring ? 'On' : 'Off'}
              </button>
            </div>

            {form.recurring && (
              <div className="recurring-days-section">
                <div className="recurring-shortcut">
                  <button
                    className={`day-shortcut-btn ${form.recurringDays.length === 7 ? 'selected' : ''}`}
                    onClick={setDaily}
                  >
                    Daily
                  </button>
                </div>
                <div className="day-selector">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      className={`day-btn ${form.recurringDays.includes(day) ? 'selected' : ''}`}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn-ghost" onClick={resetForm}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!form.title.trim() || (form.recurring && form.recurringDays.length === 0)}
              >
                {editingTask ? 'Save changes' : 'Add task'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}
