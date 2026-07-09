import React, { useState } from 'react';

interface RepoSummaryProps {
  framework: string | null;
  languages: string[];
  entryPoints: string[];
  fileCount: number;
  totalSize: number;
  confidence: number;
  checklist: string[];
}

export default function RepoSummaryWidget({
  framework,
  languages,
  entryPoints,
  fileCount,
  totalSize,
  confidence,
  checklist,
}: RepoSummaryProps) {
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return '#3b82f6'; // Muted Blue
    if (score >= 50) return '#eab308'; // Muted Yellow
    return '#f43f5e'; // Rose Red
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Repository Scan Summary
        </h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.45)', marginTop: '4px', lineHeight: '1.4' }}>
          Below are the structural metrics resolved from your repository files before parsing full relationships.
        </p>
      </div>

      {/* Grid of basic stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        
        {/* Framework */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '12px 14px',
          position: 'relative'
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            Framework
          </span>
          <span style={{ fontSize: '14px', color: '#ffffff', fontWeight: 600, marginTop: '4px', display: 'inline-block' }}>
            {framework || 'Vanilla / Custom'}
          </span>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>Detected configuration type.</div>
        </div>

        {/* Total Size */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '12px 14px'
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            Total Code Size
          </span>
          <span style={{ fontSize: '14px', color: '#ffffff', fontWeight: 600, marginTop: '4px', display: 'inline-block' }}>
            {formatSize(totalSize)}
          </span>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>Combined size of source files.</div>
        </div>

        {/* File Count */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '12px 14px'
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            Scanned Code Files
          </span>
          <span style={{ fontSize: '14px', color: '#ffffff', fontWeight: 600, marginTop: '4px', display: 'inline-block' }}>
            {fileCount} / 250
          </span>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>Valid source files matching limit filters.</div>
        </div>

        {/* Languages */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '12px 14px',
          cursor: 'pointer'
        }}
        onClick={() => setShowAllLanguages(true)}
        >
          <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            Languages
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {languages.slice(0, 2).map(lang => (
              <span key={lang} className="badge" style={{ background: 'rgba(59, 130, 246, 0.06)', borderColor: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', fontSize: '9px', padding: '1px 6px' }}>
                {lang}
              </span>
            ))}
            {languages.length > 2 && (
              <span style={{ fontSize: '9px', color: '#60a5fa', textDecoration: 'underline', alignSelf: 'center', fontWeight: 500 }}>
                +{languages.length - 2} more
              </span>
            )}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>Click to view details.</div>
        </div>
      </div>

      {/* Entry Points Section */}
      <div>
        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>
          Detected Entry Points
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {entryPoints.length > 0 ? (
            entryPoints.map(ep => (
              <div key={ep} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(59, 130, 246, 0.02)', border: '1px dashed rgba(59, 130, 246, 0.12)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa' }} />
                {ep}
              </div>
            ))
          ) : (
            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic' }}>
              No common code entry files detected.
            </span>
          )}
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px', lineHeight: '1.4' }}>
          Entry points are the starting execution files (e.g. server.ts or index.js) from which dependency flows are traced.
        </p>
      </div>

      {/* Confidence Score Circle + Checklist */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{
            width: '76px', height: '76px', borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.03)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 15px rgba(0, 0, 0, 0.4)`
          }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: getConfidenceColor(confidence) }}>{confidence}%</span>
            <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.3)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Confidence</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {checklist.map((item, index) => {
            const isWarning = item.startsWith('⚠');
            return (
              <div key={index} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', color: isWarning ? '#ef4444' : '#10b981', fontWeight: 500 }}>
                {item}
              </div>
            );
          })}
        </div>
      </div>

      {/* Languages List Modal overlay */}
      {showAllLanguages && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(5, 3, 8, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onClick={() => setShowAllLanguages(false)}
        >
          <div style={{
            background: '#0c0c14',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '360px',
            width: '100%',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Scanned Languages</h4>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>All source code languages detected in the files.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {languages.map(lang => (
                <div key={lang} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)',
                  padding: '8px 12px', borderRadius: '8px', fontSize: '13px'
                }}>
                  <span style={{ color: '#fff', fontWeight: 500 }}>{lang}</span>
                  <span style={{ color: '#60a5fa', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>active</span>
                </div>
              ))}
            </div>

            <button className="btn-secondary" onClick={() => setShowAllLanguages(false)} style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '8px' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
