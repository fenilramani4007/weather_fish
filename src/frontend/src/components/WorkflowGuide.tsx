import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';

// Persisted flag so the guide hides after all steps complete
const GUIDE_DONE_KEY = 'wf_guide_done';
export const markChatUsed = () => localStorage.setItem('wf_chat_used', '1');

interface Step {
  id: string;
  icon: string;
  titleDe: string;
  titleEn: string;
  descDe: string;
  descEn: string;
  ctaDe: string;
  ctaEn: string;
  route: string;
  done: boolean;
}

const WorkflowGuide: React.FC<{ hasReport: boolean }> = ({ hasReport }) => {
  const navigate          = useNavigate();
  const { language }      = useLanguage();
  const { user }          = useAuth();
  const { savedLocations } = useLocation();
  const de = language === 'de';

  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(GUIDE_DONE_KEY) === '1'
  );
  const [chatUsed, setChatUsed]   = useState(() =>
    localStorage.getItem('wf_chat_used') === '1'
  );

  // Listen for chat-used event from ChatPage
  useEffect(() => {
    const handler = () => setChatUsed(true);
    window.addEventListener('wf_chat_used', handler);
    return () => window.removeEventListener('wf_chat_used', handler);
  }, []);

  const steps: Step[] = [
    {
      id: 'location',
      icon: '📍',
      titleDe: 'Standort hinzufügen',
      titleEn: 'Add a location',
      descDe: 'Suche nach einer deutschen PLZ oder Stadtname, um Echtzeit-Wetterdaten zu erhalten.',
      descEn: 'Search for a German postal code or city to get live weather data.',
      ctaDe: '→ Einstellungen',
      ctaEn: '→ Settings',
      route: '/settings',
      done: savedLocations.length > 0,
    },
    {
      id: 'report',
      icon: '📻',
      titleDe: 'KI-Bericht generieren',
      titleEn: 'Generate an AI report',
      descDe: 'Die KI erstellt einen personalisierten Wetterbericht mit Neural-TTS-Stimme (Fisch, Merkel oder Haftbefehl).',
      descEn: 'The AI creates a personalised weather narration using Edge TTS neural voices — choose Fisch, Merkel or Haftbefehl.',
      ctaDe: '→ KI-Berichte',
      ctaEn: '→ AI Reports',
      route: '/reports',
      done: hasReport,
    },
    {
      id: 'profile',
      icon: '🎯',
      titleDe: 'Interessen setzen',
      titleEn: 'Set your interests',
      descDe: 'Radfahren, Wandern, Fotografie — die KI verknüpft deine Aktivitäten mit dem Wetterbericht.',
      descEn: 'Cycling, hiking, photography — the AI weaves your activities into the weather report.',
      ctaDe: '→ Mein Profil',
      ctaEn: '→ My Profile',
      route: '/profile',
      done: (user?.hobbies?.length ?? 0) > 0,
    },
    {
      id: 'chat',
      icon: '💬',
      titleDe: 'Wetter-Agenten fragen',
      titleEn: 'Ask the weather agent',
      descDe: 'Stelle komplexe Fragen: „Soll ich dieses Wochenende ein Picknick planen?" oder „Was ziehe ich heute an?"',
      descEn: 'Ask complex questions: "Should I plan a picnic this weekend?" or "What should I wear today?"',
      ctaDe: '→ KI-Chat',
      ctaEn: '→ AI Chat',
      route: '/chat',
      done: chatUsed,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone   = doneCount === steps.length;

  // Auto-dismiss when all steps complete
  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => {
        localStorage.setItem(GUIDE_DONE_KEY, '1');
        setDismissed(true);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  if (dismissed) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="wf-guide">
      {/* Header */}
      <div className="wf-guide-header">
        <div className="wf-guide-title">
          {allDone
            ? (de ? '✅ Alles eingerichtet!' : '✅ You\'re all set!')
            : (de ? `🚀 Erste Schritte — ${doneCount}/${steps.length} abgeschlossen` : `🚀 Getting Started — ${doneCount}/${steps.length} complete`)}
        </div>
        <button
          className="wf-guide-dismiss"
          onClick={() => { localStorage.setItem(GUIDE_DONE_KEY, '1'); setDismissed(true); }}
          title={de ? 'Schließen' : 'Dismiss'}
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div className="wf-guide-progress-track">
        <div className="wf-guide-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Steps */}
      <div className="wf-guide-steps">
        {steps.map((s, i) => (
          <div key={s.id} className={`wf-guide-step ${s.done ? 'done' : ''}`}>
            <div className="wf-guide-step-num">
              {s.done ? '✓' : i + 1}
            </div>
            <div className="wf-guide-step-icon">{s.icon}</div>
            <div className="wf-guide-step-body">
              <div className="wf-guide-step-title">
                {de ? s.titleDe : s.titleEn}
              </div>
              <div className="wf-guide-step-desc">
                {de ? s.descDe : s.descEn}
              </div>
            </div>
            {!s.done && (
              <button
                className="wf-guide-step-cta"
                onClick={() => navigate(s.route)}
              >
                {de ? s.ctaDe : s.ctaEn}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowGuide;
