import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  className?: string
  rows?: number
  columns?: number
}

/** Reusable table-row skeleton for loading states */
export function LoadingSkeleton({
  className,
  rows = 5,
  columns = 5,
}: LoadingSkeletonProps) {
  return (
    <div className={cn('animate-pulse', className)}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 border-b border-border/50 px-4 py-3"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 flex-1 rounded bg-muted min-w-0"
              style={{
                maxWidth: colIndex === 0 ? '20%' : undefined,
                flex: colIndex === 0 ? '0 0 20%' : 1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
