import React, { useState } from 'react';
import { DEFAULT_PREFERENCES, WORK_STYLES, GOALS } from '../data/defaults';

const STEPS = ['welcome', 'times', 'style', 'goals', 'done'];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFERENCES, name: '' });

  const currentStep = STEPS[step];
  const progress = (step / (STEPS.length - 1)) * 100;

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const toggleGoal = (goalId) => {
    setPrefs(p => ({
      ...p,
      goals: p.goals.includes(goalId)
        ? p.goals.filter(g => g !== goalId)
        : [...p.goals, goalId],
    }));
  };

  const handleComplete = () => {
    onComplete(prefs);
  };

  return (
    <div className="onboarding-root">
      <div className="onboarding-card">
        {/* Progress bar */}
        <div className="onboarding-progress-bar">
          <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {currentStep === 'welcome' && (
          <div className="onboarding-step">
            <div className="onboarding-logo">◎</div>
            <h1 className="onboarding-title">Adapt</h1>
            <p className="onboarding-subtitle">
              Your AI-powered timetable that rebuilds itself around your day — not the other way around.
            </p>
            <div className="feature-pills">
              <span className="pill">🔁 Self-correcting</span>
              <span className="pill">💬 Chat-controlled</span>
              <span className="pill">🎯 Deadline-aware</span>
            </div>
            <label className="input-label">What should I call you?</label>
            <input
              className="text-input"
              placeholder="Your name"
              value={prefs.name}
              onChange={e => setPrefs(p => ({ ...p, name: e.target.value }))}
            />
            <button className="btn-primary" onClick={next}>
              Let's build your day →
            </button>
          </div>
        )}

        {currentStep === 'times' && (
          <div className="onboarding-step">
            <div className="step-tag">Step 1 of 3</div>
            <h2 className="onboarding-title">Your day's boundaries</h2>
            <p className="onboarding-subtitle">
              These hard limits protect your schedule. Nothing gets scheduled outside them.
            </p>

            <div className="time-inputs">
              <div className="time-input-group">
                <label className="input-label">⏰ Wake up</label>
                <input
                  type="time"
                  className="time-input"
                  value={prefs.wakeTime}
                  onChange={e => setPrefs(p => ({ ...p, wakeTime: e.target.value }))}
                />
              </div>
              <div className="time-input-group">
                <label className="input-label">🌙 End of day</label>
                <input
                  type="time"
                  className="time-input"
                  value={prefs.endDayTime}
                  onChange={e => setPrefs(p => ({ ...p, endDayTime: e.target.value }))}
                />
                <span className="input-hint">Tasks never go beyond this. Ever.</span>
              </div>
            </div>

            <div className="step-nav">
              <button className="btn-ghost" onClick={back}>← Back</button>
              <button className="btn-primary" onClick={next}>Continue →</button>
            </div>
          </div>
        )}

        {currentStep === 'style' && (
          <div className="onboarding-step">
            <div className="step-tag">Step 2 of 3</div>
            <h2 className="onboarding-title">How do you work best?</h2>
            <p className="onboarding-subtitle">
              This shapes how your schedule is structured throughout the day.
            </p>
            <div className="style-grid">
              {WORK_STYLES.map(style => (
                <button
                  key={style.id}
                  className={`style-card ${prefs.workStyle === style.id ? 'selected' : ''}`}
                  onClick={() => setPrefs(p => ({ ...p, workStyle: style.id }))}
                >
                  <span className="style-icon">{style.icon}</span>
                  <span className="style-label">{style.label}</span>
                  <span className="style-desc">{style.desc}</span>
                </button>
              ))}
            </div>
            <div className="step-nav">
              <button className="btn-ghost" onClick={back}>← Back</button>
              <button className="btn-primary" onClick={next}>Continue →</button>
            </div>
          </div>
        )}

        {currentStep === 'goals' && (
          <div className="onboarding-step">
            <div className="step-tag">Step 3 of 3</div>
            <h2 className="onboarding-title">What are you optimising for?</h2>
            <p className="onboarding-subtitle">Select all that apply. Your schedule will reflect these priorities.</p>
            <div className="goals-grid">
              {GOALS.map(goal => (
                <button
                  key={goal.id}
                  className={`goal-card ${prefs.goals.includes(goal.id) ? 'selected' : ''}`}
                  onClick={() => toggleGoal(goal.id)}
                >
                  <span className="goal-icon">{goal.icon}</span>
                  <span className="goal-label">{goal.label}</span>
                  {prefs.goals.includes(goal.id) && <span className="goal-check">✓</span>}
                </button>
              ))}
            </div>
            <div className="step-nav">
              <button className="btn-ghost" onClick={back}>← Back</button>
              <button className="btn-primary" onClick={next} disabled={prefs.goals.length === 0}>
                Build my schedule →
              </button>
            </div>
          </div>
        )}

        {currentStep === 'done' && (
          <div className="onboarding-step done-step">
            <div className="done-animation">◎</div>
            <h2 className="onboarding-title">
              {prefs.name ? `Ready, ${prefs.name}!` : "You're all set!"}
            </h2>
            <p className="onboarding-subtitle">
              I've built your first schedule. You can update it anytime just by chatting with me.
            </p>
            <div className="summary-card">
              <div className="summary-row">
                <span>Wake up</span><strong>{prefs.wakeTime}</strong>
              </div>
              <div className="summary-row">
                <span>End of day</span><strong>{prefs.endDayTime}</strong>
              </div>
              <div className="summary-row">
                <span>Work style</span><strong>{WORK_STYLES.find(s => s.id === prefs.workStyle)?.label}</strong>
              </div>
            </div>
            <button className="btn-primary" onClick={handleComplete}>
              Open my schedule →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
