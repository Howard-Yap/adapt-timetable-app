import React, { useState } from 'react';
import { PRIORITY, STATUS, formatDuration } from '../engine/scheduler';

const PRIORITY_OPTIONS = [
  { value: PRIORITY.HIGH, label: '🔴 High', cls: 'high' },
  { value: PRIORITY.MEDIUM, label: '🟡 Medium', cls: 'med' },
  { value: PRIORITY.LOW, label: '🟢 Low', cls: 'low' },
];

const STATUS_FILTERS = ['all', 'pending', 'done', 'skipped'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DELAY_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120];

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
  onAddTask, onUpdateTask, onDeleteTask, onMarkDone, onSkipTask, onRebuild
}) {
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [necessityAction, setNecessityAction] = useState(null); // { taskId, type }
  const [delayMins, setDelayMins] = useState(30);

  const isNecessity = form.category === 'necessity';

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
      priority: form.category === 'necessity' ? PRIORITY.HIGH : parseInt(form.priority),
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

  const setDaily = () => setForm(f => ({ ...f, recurringDays: [...DAYS] }));

  const getTaskStatus = (task) => {
    if (completedTaskIds.includes(task.id)) return 'done';
    if (skippedTaskIds.includes(task.id)) return 'skipped';
    return 'pending';
  };

  const priorityInfo = (p) => PRIORITY_OPTIONS.find(o => o.value === p) || PRIORITY_OPTIONS[1];

  const recurringLabel = (task) => {
    if (!task.recurring || !task.recurringDays?.length) return null;
    return task.recurringDays.length === 7 ? 'Daily' : task.recurringDays.join(', ');
  };

  // Handle necessity task actions
  const handleNecessityAction = (type, taskId) => {
    if (type === 'skip') {
      onSkipTask(taskId);
      setNecessityAction(null);
    } else {
      setNecessityAction({ taskId, type });
      setDelayMins(30);
    }
  };

  const confirmNecessityAction = () => {
    const task = tasks.find(t => t.id === necessityAction.taskId);
    if (!task || !task.preferredTime) { setNecessityAction(null); return; }

    const [h, m] = task.preferredTime.split(':').map(Number);
    const currentMins = h * 60 + m;
    let newMins;

    if (necessityAction.type === 'delay') {
      newMins = currentMins + delayMins;
    } else {
      newMins = currentMins - delayMins;
    }

    newMins = Math.max(0, Math.min(newMins, 23 * 60 + 59));
    const newTime = `${String(Math.floor(newMins / 60)).padStart(2, '0')}:${String(newMins % 60).padStart(2, '0')}`;

    onUpdateTask(task.id, { ...task, preferredTime: newTime });
    onRebuild({ type: 'FULL_REBUILD' });
    setNecessityAction(null);
  };

  return (
    <div className="screen tasks-screen">
      <div className="screen-header">
        <h2 className="screen-title">Tasks</h2>
        <button className="add-task-btn" onClick={() => setShowForm(true)}>+ Add</button>
      </div>

      {/* Stats */}
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
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="task-list">
        {filtered.length === 0 && <div className="empty-state">No {filter} tasks</div>}
        {filtered.map(task => {
          const status = getTaskStatus(task);
          const p = priorityInfo(task.priority);
          const recLabel = recurringLabel(task);
          const isNec = task.category === 'necessity';

          return (
            <div key={task.id} className={`task-card ${status} ${isNec ? 'necessity-card' : ''}`}>
              <div className="task-left">
                <div className={`task-priority-dot ${isNec ? 'necessity' : p.cls}`} />
                <div className="task-info">
                  <div className="task-title">
                    {task.title}
                    {isNec && <span className="necessity-badge">necessity</span>}
                    {recLabel && <span className="recurring-badge">↻ {recLabel}</span>}
                  </div>
                  <div className="task-meta">
                    <span>{formatDuration(task.duration)}</span>
                    {task.preferredTime && <span className="preferred-time-badge">⏰ {task.preferredTime}</span>}
                    {task.deadline && <span className="task-deadline">📅 {new Date(task.deadline).toLocaleDateString()}</span>}
                    <span className={`task-status-badge ${status}`}>{status}</span>
                  </div>
                  {/* Necessity action buttons */}
                  {isNec && status === 'pending' && (
                    <div className="necessity-actions">
                      <button className="nec-action-btn" onClick={() => handleNecessityAction('delay', task.id)}>
                        Delay {task.title}
                      </button>
                      <button className="nec-action-btn" onClick={() => handleNecessityAction('earlier', task.id)}>
                        Make earlier
                      </button>
                      <button className="nec-action-btn danger" onClick={() => handleNecessityAction('skip', task.id)}>
                        Skip today
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="task-actions">
                {isNec && status === 'pending' && (
                  <button className="task-btn done" onClick={() => onMarkDone(task.id)}>✓</button>
                )}
                {!isNec && status === 'pending' && (
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
                  <div className="task-meta"><span>{formatDuration(task.duration)}</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Necessity delay/earlier modal */}
      {necessityAction && (
        <div className="modal-overlay" onClick={() => setNecessityAction(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{necessityAction.type === 'delay' ? 'Delay' : 'Make earlier'} by how much?</h3>
              <button className="modal-close" onClick={() => setNecessityAction(null)}>✕</button>
            </div>
            <div className="delay-options">
              {DELAY_OPTIONS.map(mins => (
                <button
                  key={mins}
                  className={`delay-opt-btn ${delayMins === mins ? 'selected' : ''}`}
                  onClick={() => setDelayMins(mins)}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setNecessityAction(null)}>Cancel</button>
              <button className="btn-primary" onClick={confirmNecessityAction}>Confirm</button>
            </div>
          </div>
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

            {/* Category selector */}
            <label className="input-label">Category</label>
            <div className="category-select">
              <button
                className={`category-opt ${form.category === '' ? 'selected' : ''}`}
                onClick={() => setForm(f => ({ ...f, category: '' }))}
              >Regular</button>
              <button
                className={`category-opt necessity ${form.category === 'necessity' ? 'selected' : ''}`}
                onClick={() => setForm(f => ({ ...f, category: 'necessity' }))}
              >⭐ Necessity</button>
            </div>

            {isNecessity && (
              <div className="necessity-info">
                Necessity tasks are always scheduled at their set time and are never moved by other tasks.
              </div>
            )}

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

            {!isNecessity && (
              <>
                <label className="input-label">Priority</label>
                <div className="priority-select">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`priority-opt ${form.priority == opt.value ? 'selected' : ''}`}
                      onClick={() => setForm(f => ({ ...f, priority: opt.value }))}
                    >{opt.label}</button>
                  ))}
                </div>
              </>
            )}

            <label className="input-label">
              {isNecessity ? 'Time *' : 'Preferred time (optional)'}
            </label>
            <input
              type="time"
              className="text-input"
              value={form.preferredTime}
              onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))}
            />

            <label className="input-label">Deadline (optional)</label>
            <input
              type="date"
              className="text-input"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            />

            {/* Recurring toggle */}
            <div className="recurring-row">
              <label className="input-label" style={{ margin: 0 }}>Recurring</label>
              <button
                className={`toggle-btn ${form.recurring ? 'on' : 'off'}`}
                onClick={() => setForm(f => ({ ...f, recurring: !f.recurring, recurringDays: !f.recurring ? [] : f.recurringDays }))}
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
                  >Daily</button>
                </div>
                <div className="day-selector">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      className={`day-btn ${form.recurringDays.includes(day) ? 'selected' : ''}`}
                      onClick={() => toggleDay(day)}
                    >{day}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn-ghost" onClick={resetForm}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={
                  !form.title.trim() ||
                  (form.recurring && form.recurringDays.length === 0) ||
                  (isNecessity && !form.preferredTime)
                }
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
