export default function AdminOverviewLoading() {
  return (
    <>
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .sk { background: rgba(255,255,255,.07); border-radius: 8px; animation: sk-pulse 1.6s ease-in-out infinite; }
        .sk-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 24px; }
      `}</style>

      {/* Top bar skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="sk" style={{ width: 180, height: 28, marginBottom: 8 }} />
          <div className="sk" style={{ width: 120, height: 16 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="sk" style={{ width: 140, height: 36, borderRadius: 20 }} />
          <div className="sk" style={{ width: 120, height: 36, borderRadius: 20 }} />
          <div className="sk" style={{ width: 100, height: 36, borderRadius: 20 }} />
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="sk-card">
            <div className="sk" style={{ width: 80, height: 12, marginBottom: 14 }} />
            <div className="sk" style={{ width: '70%', height: 32, marginBottom: 10 }} />
            <div className="sk" style={{ width: 100, height: 20, borderRadius: 20 }} />
          </div>
        ))}
      </div>

      {/* YTD strip */}
      <div className="sk-card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i}>
              <div className="sk" style={{ width: 60, height: 11, marginBottom: 10 }} />
              <div className="sk" style={{ width: '80%', height: 24 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Spotlight row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {[1,2].map(i => (
          <div key={i} className="sk-card">
            <div className="sk" style={{ width: 100, height: 12, marginBottom: 14 }} />
            <div className="sk" style={{ width: '60%', height: 26, marginBottom: 8 }} />
            <div className="sk" style={{ width: 120, height: 16 }} />
          </div>
        ))}
      </div>

      {/* Branch table */}
      <div className="sk-card" style={{ marginBottom: 28 }}>
        <div className="sk" style={{ width: 140, height: 18, marginBottom: 20 }} />
        {[1,2,3,4].map(i => (
          <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <div className="sk" style={{ flex: 2, height: 16 }} />
            <div className="sk" style={{ flex: 1, height: 16 }} />
            <div className="sk" style={{ flex: 1, height: 16 }} />
            <div className="sk" style={{ flex: 1, height: 16 }} />
            <div className="sk" style={{ width: 60, height: 16 }} />
          </div>
        ))}
      </div>

      {/* Recent reports table */}
      <div className="sk-card">
        <div className="sk" style={{ width: 120, height: 18, marginBottom: 20 }} />
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <div className="sk" style={{ width: 80, height: 16 }} />
            <div className="sk" style={{ flex: 1, height: 16 }} />
            <div className="sk" style={{ flex: 1, height: 16 }} />
            <div className="sk" style={{ width: 90, height: 16 }} />
            <div className="sk" style={{ width: 70, height: 20, borderRadius: 20 }} />
          </div>
        ))}
      </div>
    </>
  )
}
