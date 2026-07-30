import { useMemo } from 'react';

const HistoryTimeline = ({ history }) => {
  const sorted = useMemo(() => {
    if (!history) return [];
    return [...history].sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  }, [history]);

  if (sorted.length === 0) {
    return <p className="text-center italic text-brand-gray py-8">Sin historial de modificaciones.</p>;
  }

  return (
    <div className="space-y-3">
      {sorted.map((entry, i) => (
        <div key={i} className="bg-brand-bg border border-brand-border p-4 rounded-xl">
          <p className="font-medium text-brand-ink whitespace-pre-line text-sm">{entry.action}</p>
          {entry.fechaBaja && (
            <p className="text-xs text-brand-slate mt-1">Fecha de baja: {entry.fechaBaja.toDate().toLocaleDateString()}</p>
          )}
          {entry.changes?.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {entry.changes.map((c, j) => (
                <li key={j}><span className="capitalize text-brand-slate font-medium">{c.field}:</span>{' '}
                  <span className="text-rose-500">'{c.from}'</span> → <span className="text-emerald-600">'{c.to}'</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-brand-gray mt-2 text-right">
            {entry.timestamp?.toDate().toLocaleString()} · <span className="text-brand-orange font-medium">{entry.user}</span>
          </p>
        </div>
      ))}
    </div>
  );
};

export default HistoryTimeline;
