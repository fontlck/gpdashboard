interface LoadingSpinnerProps {
  size?: number
  color?: string
}

export function LoadingSpinner({ size = 20, color = '#C4A35E' }: LoadingSpinnerProps) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PageLoader() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#080A10',
    }}>
      <LoadingSpinner size={32} />
    </div>
  )
}
