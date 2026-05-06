'use client'

interface Props {
  filename?: string
  /** When provided, renders as a direct download link instead of calling window.print() */
  pdfHref?: string
}

const btnStyle: React.CSSProperties = {
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
  textDecoration: 'none',
}

export function DownloadPDFButton({ filename, pdfHref }: Props) {
  if (pdfHref) {
    return (
      // eslint-disable-next-line @next/next/no-html-link-for-pages
      <a
        href={pdfHref}
        download={filename ?? true}
        style={btnStyle}
      >
        ↓ Download PDF
      </a>
    )
  }

  // Fallback: browser print dialog
  const handleClick = () => {
    const prev = document.title
    if (filename) document.title = filename
    window.print()
    if (filename) setTimeout(() => { document.title = prev }, 1000)
  }

  return (
    <button onClick={handleClick} style={btnStyle}>
      ↓ Download PDF
    </button>
  )
}
