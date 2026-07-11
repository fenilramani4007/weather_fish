import React, { useState, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';

interface HistoryRecord {
  recorded_at: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  overcast: string;
  precipitation: string | null;
  daily_summary?: {
    mintemp: number;
    maxtemp: number;
    overcast: string;
    rain_prob: number;
  };
}

interface HistoryResponse {
  zipcode: string;
  count: number;
  records: HistoryRecord[];
}

// ── SVG line chart ────────────────────────────────────────────────────────────

interface ChartProps {
  records: HistoryRecord[];
  language: 'de' | 'en';
}

const W = 560;  // viewBox width
const H = 160;  // viewBox height
const PAD = { top: 20, right: 16, bottom: 36, left: 36 };

const TemperatureChart: React.FC<ChartProps> = ({ records, language }) => {
  if (records.length < 2) return null;
  const de = language === 'de';

  const temps   = records.map(r => r.temperature);
  const minTemp = Math.min(...temps) - 2;
  const maxTemp = Math.max(...temps) + 2;
  const tempRange = maxTemp - minTemp || 1;

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const toX = (i: number) => PAD.left + (i / (records.length - 1)) * chartW;
  const toY = (t: number) => PAD.top + chartH - ((t - minTemp) / tempRange) * chartH;

  const linePath = records
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(r.temperature).toFixed(1)}`)
    .join(' ');

  const areaPath =
    `M ${toX(0).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} ` +
    records.map((r, i) => `L ${toX(i).toFixed(1)} ${toY(r.temperature).toFixed(1)}`).join(' ') +
    ` L ${toX(records.length - 1).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  // Y-axis labels (3 ticks)
  const yTicks = [minTemp + 2, Math.round((minTemp + maxTemp) / 2), maxTemp - 2];

  // X-axis: show date label every ~4 records (or fewer if small dataset)
  const step = Math.max(1, Math.floor(records.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c9a227" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c9a227" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y grid lines */}
      {yTicks.map(t => (
        <g key={t}>
          <line
            x1={PAD.left} y1={toY(t)} x2={W - PAD.right} y2={toY(t)}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1"
          />
          <text
            x={PAD.left - 6} y={toY(t) + 4}
            textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)"
          >
            {Math.round(t)}°
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#tempGrad)" />

      {/* Temperature line */}
      <path d={linePath} fill="none" stroke="#c9a227" strokeWidth="2" strokeLinejoin="round" />

      {/* Data points + precipitation indicators */}
      {records.map((r, i) => {
        const x = toX(i);
        const y = toY(r.temperature);
        const hasRain = r.precipitation === 'rain';
        return (
          <g key={i}>
            {hasRain && (
              <line
                x1={x} y1={PAD.top + chartH - 10} x2={x} y2={PAD.top + chartH}
                stroke="#5ab4e8" strokeWidth="2" strokeLinecap="round"
              />
            )}
            <circle cx={x} cy={y} r="3.5" fill={hasRain ? '#5ab4e8' : '#c9a227'} stroke="#12122a" strokeWidth="1.5" />
          </g>
        );
      })}

      {/* X-axis date labels */}
      {records.map((r, i) => {
        if (i % step !== 0 && i !== records.length - 1) return null;
        const date = new Date(r.recorded_at);
        const label = date.toLocaleDateString(de ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit' });
        const time  = date.toLocaleTimeString(de ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
        return (
          <text
            key={i}
            x={toX(i)} y={H - 4}
            textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.4)"
          >
            {label} {time}
          </text>
        );
      })}

      {/* Y-axis line */}
      <line
        x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH}
        stroke="rgba(255,255,255,0.12)" strokeWidth="1"
      />
    </svg>
  );
};

// ── Humidity + rain probability bar chart ─────────────────────────────────────

const HumidityBars: React.FC<ChartProps> = ({ records, language }) => {
  if (records.length < 2) return null;
  const de = language === 'de';

  const barW = Math.max(4, Math.min(24, Math.floor((W - PAD.left - PAD.right) / records.length) - 2));
  const chartH = 80;

  return (
    <svg viewBox={`0 0 ${W} ${chartH + 24}`} style={{ width: '100%', height: 'auto' }}>
      <text x={PAD.left} y={12} fontSize="9" fill="rgba(255,255,255,0.4)">
        {de ? 'Luftfeuchtigkeit %' : 'Humidity %'}
      </text>
      {records.map((r, i) => {
        const x  = PAD.left + (i / (records.length - 1)) * (W - PAD.left - PAD.right) - barW / 2;
        const h  = ((r.humidity ?? 0) / 100) * chartH;
        const y  = 18 + chartH - h;
        const hasRain = r.precipitation === 'rain';
        return (
          <rect
            key={i}
            x={x} y={y} width={barW} height={h}
            fill={hasRain ? 'rgba(90,180,232,0.55)' : 'rgba(201,162,39,0.3)'}
            rx="2"
          />
        );
      })}
      {/* 50% reference line */}
      <line
        x1={PAD.left} y1={18 + chartH * 0.5}
        x2={W - PAD.right} y2={18 + chartH * 0.5}
        stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3,3"
      />
      <text x={PAD.left - 6} y={18 + chartH * 0.5 + 4} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.25)">
        50%
      </text>
    </svg>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const HistoryChart: React.FC = () => {
  const { currentLocation } = useLocation();
  const currentLocationId = currentLocation?.id;
  const { language } = useLanguage();
  const de = language === 'de';

  const [data, setData]       = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [days, setDays]       = useState(7);

  useEffect(() => {
    if (!currentLocationId) { setData(null); return; }
    setLoading(true);
    setError('');
    fetch(`/api/history/${currentLocationId}?days=${days}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HistoryResponse>;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [currentLocationId, days]);

  if (!currentLocation) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon">📈</div>
        <div className="wf-empty-label">{de ? 'Kein Standort ausgewählt' : 'No location selected'}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon wf-pulse">📈</div>
        <div className="wf-empty-label">{de ? 'Lade Verlaufsdaten…' : 'Loading history…'}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon">⚠️</div>
        <div className="wf-empty-label">{de ? 'Fehler beim Laden' : 'Failed to load'}</div>
        <div className="wf-empty-sub" style={{ fontSize: '10px' }}>{error}</div>
      </div>
    );
  }

  if (!data || data.count === 0) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon">📭</div>
        <div className="wf-empty-label">
          {de ? 'Noch keine Verlaufsdaten' : 'No history data yet'}
        </div>
        <div className="wf-empty-sub">
          {de
            ? 'Wetterdaten werden bei jeder Generierung gespeichert.'
            : 'Weather data is recorded on every generation.'}
        </div>
      </div>
    );
  }

  const records = data.records;
  const temps   = records.map(r => r.temperature);
  const avgTemp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  const rainCount = records.filter(r => r.precipitation === 'rain').length;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {[
          {
            label: de ? 'Datenpunkte' : 'Data points',
            value: String(data.count),
          },
          {
            label: de ? 'Ø Temperatur' : 'Avg temp',
            value: `${avgTemp}°C`,
          },
          {
            label: de ? 'Min / Max' : 'Min / Max',
            value: `${Math.min(...temps)}° / ${Math.max(...temps)}°C`,
          },
          {
            label: de ? 'Regenstunden' : 'Rain hours',
            value: String(rainCount),
          },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: '1 1 auto',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '6px',
            padding: '6px 10px',
            textAlign: 'center',
            minWidth: '80px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold, #c9a227)' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted, #888)', marginTop: '2px', letterSpacing: '0.05em' }}>
              {stat.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Day range selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[3, 7, 14].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`wf-tab ${days === d ? 'on' : ''}`}
            style={{ flex: 1, fontSize: '11px' }}
          >
            {d} {de ? 'Tage' : 'days'}
          </button>
        ))}
      </div>

      {/* Temperature line chart */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em' }}>
          {de ? '🌡 TEMPERATURVERLAUF' : '🌡 TEMPERATURE TREND'}
          <span style={{ marginLeft: '12px', color: 'rgba(90,180,232,0.8)' }}>
            ● {de ? 'Regen' : 'Rain'}
          </span>
        </div>
        <TemperatureChart records={records} language={language} />
      </div>

      {/* Humidity bars */}
      <div>
        <HumidityBars records={records} language={language} />
      </div>
    </div>
  );
};

export default HistoryChart;
