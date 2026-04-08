'use client'

export function DownloadPDFButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: '#111',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        padding: '8px 16px',
        fontSize: '13px',
        fontFamily: 'inherit',
        fontWeight: '600',
        cursor: 'pointer',
        letterSpacing: '-.01em',
      }}
    >
      ↓ Download PDF
    </button>
  )
}
