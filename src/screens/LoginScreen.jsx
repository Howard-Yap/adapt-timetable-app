import React, { useState } from 'react';
import { auth, provider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export default function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      onLogin(result.user);
    } catch (err) {
      setError('Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-logo">◎</div>
        <h1 className="login-title">Adapt</h1>
        <p className="login-subtitle">
          Your AI-powered timetable that rebuilds itself around your day.
        </p>
        <div className="login-features">
          <span className="pill">🔁 Self-correcting</span>
          <span className="pill">💬 Chat-controlled</span>
          <span className="pill">🎯 Deadline-aware</span>
        </div>
        <button
          className="google-signin-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                width={18}
                height={18}
              />
              <span>Continue with Google</span>
            </>
          )}
        </button>
        {error && <div className="login-error">{error}</div>}
        <p className="login-footer">
          Your data is private and only accessible to you.
        </p>
      </div>
    </div>
  );
}