import React, { useState, useRef } from 'react';
import { timeToMins } from '../engine/scheduler';
import { parseICS } from '../engine/icsParser';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EVENT_COLORS = [
  { label: 'Purple', value: '#7c6bff' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Pink', value: '#ec4899' },
];

const CLASS_TYPES = [
  { id: 'lecture', label: '📚 Lecture' },
  { id: 'tutorial', label: '✏️ Tutorial' },
  { id: 'lab', label: '🔬 Lab' },
  { id: 'seminar', label: '💬 Seminar' },
  { id: 'exam', label: '📝 Exam' },
  { id: 'other', label: '📌 Other' },
];

function getTodayDay() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

export default function TimetableScreen({ uniClasses, onAddClass, onDeleteClass, onToggleClass }) {
  const [showForm, setShowForm] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [importCount, setImportCount] = useState(0);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    title: '',
    classType: 'lecture',
    startTime: '09:00',
    endTime: '11:00',
    location: '',
    color: '#7c6bff',
    days: ['Monday'],
  });

  const today = getTodayDay();

  const resetForm = () => {
    setForm({ title: '', classType: 'lecture', startTime: '09:00', endTime: '11:00', location: '', color: '#7c6bff', days: ['Monday'] });
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || form.days.length === 0) return;
    form.days.forEach(day => {
      onAddClass({
        id: `uni-${Date.now()}-${day}-${Math.random().toString(36).slice(2)}`,
        title: form.title.trim(),
        classType: form.classType,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location,
        color: form.color,
        day,
        enabled: true,
      });
    });
    resetForm();
  };

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  };

  const handleICSImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const classes = parseICS(evt.target.result);
        if (classes.length === 0) {
          setImportStatus('error');
          setTimeout(() => setImportStatus(null), 4000);
          return;
        }
        const existing = uniClasses.map(c => `${c.title}-${c.day}-${c.startTime}`);
        const newClasses = classes.filter(c => !existing.includes(`${c.title}-${c.day}-${c.startTime}`));
        newClasses.forEach(cls => onAddClass(cls));
        setImportCount(newClasses.length);
        setImportStatus('success');
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err) {
        setImportStatus('error');
        setTimeout(() => setImportStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const eventsByDay = DAYS.reduce((acc, day) => {
    acc[day] = (uniClasses || [])
      .filter(c => c.day === day)
      .sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));
    return acc;
  }, {});

  const todayEvents = eventsByDay[today] || [];
  const totalClasses = (uniClasses || []).length;

  return (
    <div className="screen timetable-screen">
      <div className="screen-header">
        <h2 className="screen-title">Uni Timetable</h2>
        <div className="timetable-header-btns">
          <button className="import-btn" onClick={() => fileInputRef.current?.click()}>↑ Import</button>
          <button className="add-task-btn" onClick={() => setShowForm(true)}>+ Add</button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".ics" style={{ display: 'none' }} onChange={handleICSImport} />

      {importStatus === 'success' && (
        <div className="import-success">✓ Imported {importCount} class{importCount !== 1 ? 'es' : ''} from your calendar!</div>
      )}
      {importStatus === 'error' && (
        <div className="import-error">✕ Couldn't read that file. Make sure it's a valid .ics calendar file.</div>
      )}

      {totalClasses === 0 ? (
        <div className="empty-timetable">
          <div className="empty-timetable-icon">📅</div>
          <div className="empty-timetable-title">No classes added yet</div>
          <div className="empty-timetable-desc">Import your uni calendar or add classes manually. They'll automatically be blocked out in your daily schedule.</div>
          <div className="import-options">
            <button className="import-option-btn" onClick={() => fileInputRef.current?.click()}>
              <span className="import-option-icon">📥</span>
              <span className="import-option-label">Import .ics file</span>
              <span className="import-option-desc">From Google Calendar, Outlook or Apple Calendar</span>
            </button>
            <button className="import-option-btn" onClick={() => setShowForm(true)}>
              <span className="import-option-icon">✏️</span>
              <span className="import-option-label">Add manually</span>
              <span className="import-option-desc">Enter classes one by one</span>
            </button>
          </div>
          <div className="ics-instructions">
            <div className="ics-instructions-title">How to export from Google Calendar</div>
            <div className="ics-step">1. Go to calendar.google.com</div>
            <div className="ics-step">2. Click ⚙️ Settings → Import & Export</div>
            <div className="ics-step">3. Click "Export" to download your .ics file</div>
            <div className="ics-step">4. Come back here and tap "↑ Import"</div>
          </div>
        </div>
      ) : (
        <>
          <div className="today-classes-card">
            <div className="today-classes-label">TODAY — {today.toUpperCase()}</div>
            {todayEvents.length === 0 ? (
              <div className="no-classes">No classes today 🎉 Your full day is free for tasks.</div>
            ) : (
              <div className="today-classes-list">
                {todayEvents.map(event => (
                  <div key={event.id} className="today-class-item" style={{ borderLeftColor: event.color }}>
                    <div className="class-time">{event.startTime} – {event.endTime}</div>
                    <div className="class-title">{event.title}</div>
                    {event.location && <div className="class-location">📍 {event.location}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-title" style={{ marginTop: 20, marginBottom: 12 }}>Weekly Schedule</div>

          {DAYS.map(day => {
            const dayEvents = eventsByDay[day];
            const isToday = day === today;
            return (
              <div key={day} className={`day-section ${isToday ? 'today' : ''}`}>
                <div className="day-header">
                  <span className="day-name">{day}</span>
                  {isToday && <span className="today-badge">Today</span>}
                  <span className="day-count">{dayEvents.length} class{dayEvents.length !== 1 ? 'es' : ''}</span>
                </div>
                {dayEvents.length === 0 ? (
                  <div className="no-events-row">Free day</div>
                ) : (
                  <div className="day-events">
                    {dayEvents.map(event => (
                      <div key={event.id} className={`event-row ${!event.enabled ? 'disabled' : ''}`}>
                        <div className="event-color-dot" style={{ background: event.color }} />
                        <div className="event-info">
                          <div className="event-title">
                            {event.title}
                            <span className="class-type-tag">{CLASS_TYPES.find(t => t.id === event.classType)?.label.split(' ')[0]}</span>
                            {event.fromImport && <span className="imported-tag">imported</span>}
                          </div>
                          <div className="event-meta">{event.startTime} – {event.endTime}{event.location && ` · 📍 ${event.location}`}</div>
                        </div>
                        <div className="event-controls">
                          <button className={`toggle-btn ${event.enabled ? 'on' : 'off'}`} onClick={() => onToggleClass(event.id)}>
                            {event.enabled ? '●' : '○'}
                          </button>
                          <button className="del-event-btn" onClick={() => onDeleteClass(event.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-card timetable-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Class</h3>
              <button className="modal-close" onClick={resetForm}>✕</button>
            </div>
            <label className="input-label">Subject / Class name *</label>
            <input className="text-input" placeholder="e.g. Introduction to Psychology" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
            <label className="input-label">Type</label>
            <div className="type-select">
              {CLASS_TYPES.map(t => (
                <button key={t.id} className={`type-opt ${form.classType === t.id ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, classType: t.id }))}>{t.label}</button>
              ))}
            </div>
            <div className="time-row">
              <div className="time-col">
                <label className="input-label">Start time</label>
                <input type="time" className="text-input" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="time-col">
                <label className="input-label">End time</label>
                <input type="time" className="text-input" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <label className="input-label">Location (optional)</label>
            <input className="text-input" placeholder="e.g. Room B204" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            <label className="input-label">Which day(s)?</label>
            <div className="days-select">
              {DAYS.map((day, i) => (
                <button key={day} className={`day-opt ${form.days.includes(day) ? 'selected' : ''}`} onClick={() => toggleDay(day)}>{DAY_SHORT[i]}</button>
              ))}
            </div>
            <label className="input-label">Colour</label>
            <div className="color-select">
              {EVENT_COLORS.map(c => (
                <button key={c.value} className={`color-opt ${form.color === c.value ? 'selected' : ''}`} style={{ background: c.value }} onClick={() => setForm(f => ({ ...f, color: c.value }))} />
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={resetForm}>Cancel</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={!form.title.trim() || form.days.length === 0}>Add to timetable</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}