/**
 * ApiStatus Component
 * Displays the status of the backend API connection
 */

export type ApiStatusState = 'checking' | 'online' | 'offline'

interface ApiStatusProps {
  status: ApiStatusState
  onRetry?: () => void
}

export function ApiStatus({ status, onRetry }: ApiStatusProps) {
  return (
    <div className={`craft-api-status craft-api-status--${status}`}>
      <span className="craft-api-status__indicator" />
      <span className="craft-api-status__text">
        {status === 'checking' && 'Checking API...'}
        {status === 'online' && 'API Online'}
        {status === 'offline' && 'API Offline'}
      </span>
      {status === 'offline' && onRetry && (
        <button
          type="button"
          className="craft-api-status__retry"
          onClick={onRetry}
          title="Retry connection"
        >
          Retry
        </button>
      )}
    </div>
  )
}
