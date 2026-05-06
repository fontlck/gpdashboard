'use client'

interface Props {
  filename?: string
}

export function DownloadPDFButton({ filename }: Props) {
  const handleClick = () => {
    const prev = document.title
    if (filename) document.title = filename
    window.print()
    if (filename) setTimeout(() => { document.title = prev }, 1000)
  }

  return (
    <button
      onClick={handleClick}
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
