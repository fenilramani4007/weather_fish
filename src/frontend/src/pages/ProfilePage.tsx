import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ALL_HOBBIES = ['Radfahren', 'Tennis', 'Wandern', 'Schwimmen', 'Joggen', 'Gaming', 'Lesen', 'Kochen', 'Gärtnern', 'Fotografie', 'Yoga', 'Spazieren', 'Fußball', 'Arbeit'];

interface ActivityRecord {
  date: string;
  city: string;
  zipcode: string;
  hobbies: string[];
  timestamp: string;
}

interface DayGroup {
  date: string;
  records: ActivityRecord[];
}

function groupByDay(records: ActivityRecord[]): DayGroup[] {
  const map = new Map<string, ActivityRecord[]>();
  for (const r of records) {
    const existing = map.get(r.date) ?? [];
    existing.push(r);
    map.set(r.date, existing);
  }
  return Array.from(map.entries())
    .map(([date, recs]) => ({ date, records: recs }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string, lang: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch { return dateStr; }
}

function getActivityIcon(hobby: string) {
  const icons: Record<string, string> = {
    'Tennis': '🎾', 'Joggen': '🏃', 'Wandern': '🥾', 'Radfahren': '🚴',
    'Schwimmen': '🏊', 'Gaming': '🎮', 'Lesen': '📚', 'Kochen': '🍳',
    'Gärtnern': '🌱', 'Fotografie': '📷', 'Yoga': '🧘', 'Spazieren': '🚶',
    'Fußball': '⚽', 'Arbeit': '💼',
  };
  return icons[hobby] ?? '🎯';
}

const ProfilePage: React.FC = () => {
  const { user, token, logout, updateProfile } = useAuth();
  const { language } = useLanguage();
  const de = language === 'de';

  const [activities, setActivities]   = useState<ActivityRecord[]>([]);
  const [loadingAct, setLoadingAct]   = useState(true);
  const [editName, setEditName]       = useState(false);
  const [newName, setNewName]         = useState(user?.username ?? '');
  const [saving, setSaving]           = useState(false);
  const [hobbies, setHobbies]         = useState<string[]>(user?.hobbies ?? []);
  const [hobbySaved, setHobbySaved]   = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoadingAct(true);
    fetch('/api/activity/history?days=30', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { records: [] })
      .then(d => setActivities(d.records ?? []))
      .catch(() => setActivities([]))
      .finally(() => setLoadingAct(false));
  }, [token]);

  if (!user) return null;

  // Stats
  const cityCount: Record<string, number> = {};
  const hobbyCount: Record<string, number> = {};
  for (const r of activities) {
    cityCount[r.city] = (cityCount[r.city] ?? 0) + 1;
    for (const h of r.hobbies) hobbyCount[h] = (hobbyCount[h] ?? 0) + 1;
  }
  const topCity   = Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–';
  const topHobby  = Object.entries(hobbyCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–';
  const dayGroups = groupByDay(activities);

  const handleSaveName = async () => {
    if (!newName.trim() || newName === user.username) { setEditName(false); return; }
    setSaving(true);
    try { await updateProfile({ username: newName.trim() }); setEditName(false); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const toggleHobby = async (h: string) => {
    const next = hobbies.includes(h) ? hobbies.filter(x => x !== h) : [...hobbies, h];
    setHobbies(next);
    try {
      await updateProfile({ hobbies: next });
      setHobbySaved(true);
      setTimeout(() => setHobbySaved(false), 2000);
    } catch { /* revert on failure */ setHobbies(hobbies); }
  };

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <h1 className="wf-page-title">{de ? 'Mein Profil' : 'My Profile'}</h1>
      </div>

      {/* User card */}
      <div className="wf-profile-card">
        <div className="wf-profile-avatar">{getInitials(user.username)}</div>
        <div className="wf-profile-info">
          {editName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                className="wf-form-input"
                style={{ fontSize: '14px', padding: '6px 10px' }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                autoFocus
              />
              <button className="wf-btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={handleSaveName} disabled={saving}>
                {saving ? '…' : '✓'}
              </button>
              <button className="wf-btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setEditName(false)}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="wf-profile-name">{user.username}</span>
              <button className="wf-btn-ghost" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => { setNewName(user.username); setEditName(true); }}>
                ✏️
              </button>
            </div>
          )}
          <div className="wf-profile-email">{user.email}</div>
          {user.created_at && (
            <div className="wf-profile-since">
              {de ? 'Mitglied seit' : 'Member since'} {new Date(user.created_at).toLocaleDateString(de ? 'de-DE' : 'en-GB', { month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
        <button className="wf-logout-btn" onClick={logout}>
          {de ? '↩ Abmelden' : '↩ Log out'}
        </button>
      </div>

      {/* Stats row */}
      <div className="wf-profile-stats">
        <div className="wf-profile-stat">
          <div className="wf-profile-stat-val">{activities.length}</div>
          <div className="wf-profile-stat-lab">{de ? 'Suchanfragen (30 Tage)' : 'Searches (30 days)'}</div>
        </div>
        <div className="wf-profile-stat">
          <div className="wf-profile-stat-val">{dayGroups.length}</div>
          <div className="wf-profile-stat-lab">{de ? 'Aktive Tage' : 'Active days'}</div>
        </div>
        <div className="wf-profile-stat">
          <div className="wf-profile-stat-val" style={{ fontSize: '13px' }}>{topCity}</div>
          <div className="wf-profile-stat-lab">{de ? 'Häufigste Stadt' : 'Top city'}</div>
        </div>
        <div className="wf-profile-stat">
          <div className="wf-profile-stat-val" style={{ fontSize: '13px' }}>
            {topHobby !== '–' ? `${getActivityIcon(topHobby)} ${topHobby}` : '–'}
          </div>
          <div className="wf-profile-stat-lab">{de ? 'Häufigste Aktivität' : 'Top activity'}</div>
        </div>
      </div>

      {/* Hobby preferences */}
      <div className="wf-report-content" style={{ marginBottom: 0 }}>
        <div className="wf-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span>{de ? 'Meine Aktivitäten & Interessen' : 'My Activities & Interests'}</span>
          {hobbySaved && <span style={{ fontSize: '10px', color: '#4ade80' }}>✓ {de ? 'Gespeichert' : 'Saved'}</span>}
        </div>
        <div className="wf-hobby-grid">
          {ALL_HOBBIES.map(h => (
            <button
              key={h}
              className={`wf-hobby-chip ${hobbies.includes(h) ? 'on' : ''}`}
              onClick={() => toggleHobby(h)}
            >
              {getActivityIcon(h)} {h}
            </button>
          ))}
        </div>
      </div>

      {/* Activity timeline */}
      <div className="wf-report-content">
        <div className="wf-section" style={{ marginBottom: '12px' }}>
          {de ? 'Aktivitätsprotokoll (letzte 30 Tage)' : 'Activity Log (last 30 days)'}
        </div>

        {loadingAct ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '16px 0' }}>
            {de ? 'Laden…' : 'Loading…'}
          </div>
        ) : dayGroups.length === 0 ? (
          <div className="wf-empty" style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '36px', opacity: 0.3 }}>📭</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              {de ? 'Noch keine Aktivitäten — generiere deinen ersten Wetterbericht!' : 'No activity yet — generate your first weather report!'}
            </div>
          </div>
        ) : (
          <div className="wf-activity-timeline">
            {dayGroups.map(({ date, records }) => (
              <div key={date} className="wf-activity-day">
                <div className="wf-activity-date">{formatDate(date, language)}</div>
                {records.map((r, i) => (
                  <div key={i} className="wf-activity-entry">
                    <div className="wf-activity-city">
                      📍 {r.city} {r.zipcode && r.zipcode !== r.city ? `(${r.zipcode})` : ''}
                    </div>
                    {r.hobbies.length > 0 && (
                      <div className="wf-activity-chips">
                        {r.hobbies.map(h => (
                          <span key={h} className="wf-activity-chip">
                            {getActivityIcon(h)} {h}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="wf-activity-time">
                      {new Date(r.timestamp).toLocaleTimeString(de ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
