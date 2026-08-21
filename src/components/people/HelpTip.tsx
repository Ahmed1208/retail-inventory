import { CircleHelp } from 'lucide-react'

import { cn } from '@/lib/utils'

export function HelpTip({ text, className }: { text: string; className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground',
        className
      )}
      title={text}
      aria-label={text}
    >
      <CircleHelp className="size-3.5" aria-hidden />
    </button>
  )
}
