import { useCallback, useEffect, useRef, useState } from 'react'

type QtyPatch = { qty: number }

/**
 * Quantity fields often default to 1. If the controlled value snaps back to 1 whenever
 * the input is empty, users cannot clear the field to type e.g. "2". This hook keeps a
 * local digit string while editing; the parent qty is only updated when there are digits,
 * and blur restores a valid minimum when the field was left empty.
 */
export function useQtyInputDraft(
  lineKey: string,
  productId: string,
  committedQty: number,
  onCommitQty: (patch: QtyPatch) => void
) {
  const [draft, setDraft] = useState<string | null>(null)
  const draftRef = useRef<string | null>(null)
  const committedRef = useRef(committedQty)
  committedRef.current = committedQty

  useEffect(() => {
    setDraft(null)
    draftRef.current = null
  }, [lineKey, productId])

  /** Arrow keys / merge can change qty while draft is ""; drop draft so the new qty shows. */
  useEffect(() => {
    const d = draftRef.current
    if (d === null) return
    if (d === '') {
      setDraft(null)
      draftRef.current = null
      return
    }
    const n = parseInt(d, 10)
    if (!Number.isNaN(n) && n === committedQty) {
      setDraft(null)
      draftRef.current = null
    }
  }, [committedQty])

  const resetDraft = useCallback(() => {
    draftRef.current = null
    setDraft(null)
  }, [])

  const displayValue = draft !== null ? draft : String(committedQty)

  const onQtyFocus = useCallback(() => {
    resetDraft()
  }, [resetDraft])

  const onQtyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '')
      draftRef.current = raw
      setDraft(raw)
      if (raw !== '') {
        onCommitQty({
          qty: Math.max(1, parseInt(raw, 10) || 1),
        })
      }
    },
    [onCommitQty]
  )

  const onQtyBlur = useCallback(() => {
    const last = draftRef.current
    resetDraft()
    if (last === '') {
      onCommitQty({ qty: Math.max(1, committedRef.current) })
    }
  }, [onCommitQty, resetDraft])

  return {
    displayValue,
    onQtyFocus,
    onQtyChange,
    onQtyBlur,
  }
}
