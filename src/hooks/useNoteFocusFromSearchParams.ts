import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * When URL has `noteFocus=1`, scrolls to the element with `noteElementId` and briefly highlights it.
 */
export function useNoteFocusFromSearchParams(noteElementId: string | null) {
  const [searchParams] = useSearchParams()
  const doneRef = useRef(false)
  const fromN = searchParams.get('fromNotification')

  useEffect(() => {
    doneRef.current = false
  }, [noteElementId, fromN])

  useEffect(() => {
    if (!noteElementId || doneRef.current) return
    const focus = searchParams.get('noteFocus')
    if (focus !== '1') return

    const run = () => {
      const el = document.getElementById(noteElementId)
      if (!el) return
      doneRef.current = true
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add(
        'ring-2',
        'ring-primary',
        'ring-offset-2',
        'rounded-md',
        'transition-shadow'
      )
      window.setTimeout(() => {
        el.classList.remove(
          'ring-2',
          'ring-primary',
          'ring-offset-2',
          'rounded-md',
          'transition-shadow'
        )
      }, 2200)
    }

    requestAnimationFrame(run)
  }, [noteElementId, searchParams])
}
