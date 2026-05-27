export default function PartnerDashboardLoading() {
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

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="sk-card">
            <div className="sk" style={{ width: 70, height: 11, marginBottom: 14 }} />
            <div className="sk" style={{ width: '65%', height: 30, marginBottom: 10 }} />
            <div className="sk" style={{ width: 90, height: 18, borderRadius: 20 }} />
          </div>
        ))}
      </div>

      {/* Doc grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="sk-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="sk" style={{ width: 80, height: 16 }} />
              <div className="sk" style={{ width: 60, height: 22, borderRadius: 20 }} />
            </div>
            {[1,2,3].map(j => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="sk" style={{ width: '40%', height: 14 }} />
                <div className="sk" style={{ width: '30%', height: 14 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
