import React from 'react';

interface OverviewConfidenceProps {
  confidence: number;
  checklist: string[];
}

export const OverviewConfidence: React.FC<OverviewConfidenceProps> = ({
  confidence,
  checklist = [],
}) => {
  const getHealthLevel = (score: number) => {
    if (score >= 80) return { label: 'Optimal deterministic resolution', tone: 'ok' as const };
    if (score >= 60) return { label: 'Moderate architectural resolution', tone: 'warn' as const };
    return { label: 'Partial ingestion / analysis gaps', tone: 'risk' as const };
  };

  const health = getHealthLevel(confidence);
  const statusClass = health.tone === 'ok' ? 'st--ok' : health.tone === 'warn' ? 'st--warn' : 'st--risk';

  // Group checklist into 4 core architectural evidence dimensions
  const categorizeChecks = () => {
    const astItems: string[] = [];
    const depItems: string[] = [];
    const execItems: string[] = [];
    const dbItems: string[] = [];

    checklist.forEach((item) => {
      const lower = item.toLowerCase();
      if (lower.includes('ast')) {
        astItems.push(item);
      } else if (lower.includes('dependency') || lower.includes('import')) {
        depItems.push(item);
      } else if (
        lower.includes('execution') ||
        lower.includes('chain') ||
        lower.includes('route') ||
        lower.includes('controller')
      ) {
        execItems.push(item);
      } else if (
        lower.includes('database') ||
        lower.includes('db') ||
        lower.includes('prisma') ||
        lower.includes('model')
      ) {
        dbItems.push(item);
      }
    });

    return [
      {
        title: 'AST structure & language coverage',
        items: astItems,
      },
      {
        title: 'Import & dependency topology',
        items: depItems,
      },
      {
        title: 'Route-controller-service execution resolution',
        items: execItems,
      },
      {
        title: 'Database schema & client integration',
        items: dbItems,
      },
    ].filter((dim) => dim.items.length > 0);
  };

  const dimensions = categorizeChecks();

  const size = 132;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.min(Math.max(confidence, 0), 100) / 100 * circumference;
  const ringColor =
    health.tone === 'ok' ? 'var(--emerald)' : health.tone === 'warn' ? 'var(--amber)' : 'var(--signal)';

  return (
    <section aria-label="Confidence & Architectural Evidence">
      <div className="panel">
        <div className="panel__head">
          <div className="t">Confidence &amp; evidence</div>
          <div className="r">{checklist.length} checks</div>
        </div>
        <div className="panel__body">
          <div className="conf">
            <div className="conf__ring">
              <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="var(--rule)"
                  strokeWidth={stroke}
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="conf__val">
                {confidence}
                <small>%</small>
              </div>
            </div>
            <div className="conf__lbl">Engine confidence</div>
          </div>

          <div className="mt-4 border-t border-rule pt-4">
            <span className={`st ${statusClass}`}>
              <i />
              {health.label}
            </span>
            <p className="mt-2 text-[12px] leading-[1.6] text-ink-2">
              Confidence reflects deterministic AST parsing, dependency link completeness, and layered
              execution verification without heuristic guessing.
            </p>
          </div>

          {dimensions.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-rule pt-4">
              {dimensions.map((dim, idx) => (
                <div key={idx}>
                  <span className="figcap mb-1.5 block">{dim.title}</span>
                  <div className="space-y-1.5">
                    {dim.items.map((line, lIdx) => {
                      const isWarning = line.startsWith('⚠');
                      const text = line.replace(/^[✓⚠]\s*/, '');
                      return (
                        <div
                          key={lIdx}
                          className="flex items-start gap-2 font-mono text-[11px] leading-[1.55]"
                        >
                          <span className={isWarning ? 'text-amber' : 'text-emerald'}>
                            {isWarning ? '⚠' : '✓'}
                          </span>
                          <span className="text-ink-2">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
