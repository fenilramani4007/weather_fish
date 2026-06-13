import React, { useState, useEffect, useRef } from 'react';
import Mascot from './Mascot';
import { useLocation } from '../contexts/LocationContext';

type MascotKey = 'mascotfish' | 'mascotmerkel' | 'mascothaftbefehl';

const MASCOT_LABELS: Record<MascotKey, string> = {
  mascotfish:       'Fisch',
  mascotmerkel:     'Merkel',
  mascothaftbefehl: 'Haftbefehl',
};

const TextReport: React.FC = () => {
  const { savedLocations, refreshTick } = useLocation();
  const [activeMascot, setActiveMascot] = useState<MascotKey>('mascotfish');
  const [reportText, setReportText]     = useState<string>('');
  const [isPlaying, setIsPlaying]       = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch text report from backend API (MongoDB-backed)
  useEffect(() => {
    if (!savedLocations.length) { setReportText(''); return; }
    const presenter = MASCOT_LABELS[activeMascot];
    fetch(`/api/report/${presenter}`)
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((doc: { text: string }) => setReportText(doc.text))
      .catch(() => setReportText('Bericht noch nicht verfügbar. Bitte Standort generieren.'));
  }, [activeMascot, savedLocations.length, refreshTick]);

  // Stop audio when all locations removed
  useEffect(() => {
    if (!savedLocations.length && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsPlaying(false);
    }
  }, [savedLocations.length]);

  const handlePlay = () => {
    if (!savedLocations.length || !audioRef.current) return;
    if (!audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    const name = MASCOT_LABELS[activeMascot];
    audioRef.current.src = `/speech/${name}.mp3`;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const hasLocs = savedLocations.length > 0;

  return (
    <>
      <div className="wf-card-title">
        Wetterbericht
        <span>{MASCOT_LABELS[activeMascot]}</span>
      </div>

      <div className="wf-mascot-bar">
        {(Object.keys(MASCOT_LABELS) as MascotKey[]).map(k => (
          <button
            key={k}
            className={`wf-mascot-btn ${activeMascot === k ? 'on' : ''}`}
            onClick={() => setActiveMascot(k)}
          >
            {MASCOT_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="wf-report-body">
        <div className="wf-mascot-wrap">
          <div className="wf-mascot-inner">
            <Mascot activeMascot={activeMascot} />
          </div>
        </div>
        <div className="wf-report-text">
          {hasLocs
            ? (reportText || 'Wird geladen…')
            : 'Standort hinzufügen, um einen Bericht zu erhalten.'}
        </div>
      </div>

      <div className="wf-report-footer">
        <button
          className={`wf-play ${isPlaying ? 'stop' : ''}`}
          onClick={handlePlay}
          disabled={!hasLocs}
        >
          {isPlaying ? '⏹ STOPP' : '▶ VORLESEN'}
        </button>
      </div>

      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} hidden />
    </>
  );
};

export default TextReport;
