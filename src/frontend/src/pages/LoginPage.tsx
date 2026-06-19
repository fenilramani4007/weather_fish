import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login, register, loading } = useAuth();
  const [tab, setTab]           = useState<'login' | 'register'>('login');
  const [email, setEmail]       = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, username, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <div className="wf-login-page">
      <div className="wf-login-card">
        {/* Logo */}
        <div className="wf-login-logo">
          <span className="wf-login-fish">🐟</span>
          <div>
            <div className="wf-login-title">WEATHER-FISH</div>
            <div className="wf-login-subtitle">KI-gestützte Wetterberichte · OTH Amberg-Weiden</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="wf-login-tabs">
          <button
            className={`wf-login-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Anmelden
          </button>
          <button
            className={`wf-login-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
          >
            Registrieren
          </button>
        </div>

        <form className="wf-login-form" onSubmit={handleSubmit}>
          <div className="wf-form-group">
            <label className="wf-form-label">E-Mail</label>
            <input
              className="wf-form-input"
              type="email"
              placeholder="max@mustermann.de"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {tab === 'register' && (
            <div className="wf-form-group">
              <label className="wf-form-label">Benutzername</label>
              <input
                className="wf-form-input"
                type="text"
                placeholder="MaxMustermann"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                minLength={2}
              />
            </div>
          )}

          <div className="wf-form-group">
            <label className="wf-form-label">Passwort</label>
            <input
              className="wf-form-input"
              type="password"
              placeholder={tab === 'register' ? 'Mindestens 6 Zeichen' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={tab === 'register' ? 6 : 1}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="wf-login-error">{error}</div>}

          <button className="wf-btn-primary wf-login-submit" type="submit" disabled={loading}>
            {loading ? '⏳ Bitte warten…' : tab === 'login' ? '→ Anmelden' : '→ Konto erstellen'}
          </button>
        </form>

        <div className="wf-login-footer">
          Powered by Gemini AI · Edge TTS · OTH Amberg-Weiden
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
