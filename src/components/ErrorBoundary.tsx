import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  retryKey: number
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryKey: 0 }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <ErrorFallback
          onRetry={() =>
            this.setState((s) => ({ hasError: false, retryKey: s.retryKey + 1 }))
          }
        />
      )
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold text-foreground">
        {t('errorBoundary.title')}
      </h2>
      <p className="text-muted-foreground max-w-md">
        {t('errorBoundary.message')}
      </p>
      <Button onClick={onRetry}>{t('errorBoundary.retry')}</Button>
    </div>
  )
}
