import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  type FeatureControlId,
  mergeFeatureState,
  buildDefaultFeatureState,
} from '@/config/featureControls'

const STORAGE_KEY = 'stockpilot-feature-controls'

function readStored(): Partial<Record<string, boolean>> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Partial<Record<string, boolean>>
  } catch {
    return null
  }
}

function writeStored(state: Record<FeatureControlId, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}

type FeatureControlContextValue = {
  state: Record<FeatureControlId, boolean>
  isEnabled: (id: FeatureControlId) => boolean
  setEnabled: (id: FeatureControlId, enabled: boolean) => void
  resetToDefaults: () => void
}

const FeatureControlContext = createContext<FeatureControlContextValue | null>(
  null
)

export function FeatureControlProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Record<FeatureControlId, boolean>>(() =>
    mergeFeatureState(readStored())
  )

  const setEnabled = useCallback((id: FeatureControlId, enabled: boolean) => {
    setState((prev) => {
      const next = { ...prev, [id]: enabled }
      writeStored(next)
      return next
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    const next = buildDefaultFeatureState()
    writeStored(next)
    setState(next)
  }, [])

  const isEnabled = useCallback(
    (id: FeatureControlId) => state[id] !== false,
    [state]
  )

  const value = useMemo(
    () => ({
      state,
      isEnabled,
      setEnabled,
      resetToDefaults,
    }),
    [state, isEnabled, setEnabled, resetToDefaults]
  )

  return (
    <FeatureControlContext.Provider value={value}>
      {children}
    </FeatureControlContext.Provider>
  )
}

export function useFeatureControlContext(): FeatureControlContextValue {
  const ctx = useContext(FeatureControlContext)
  if (!ctx) {
    throw new Error(
      'useFeatureControlContext must be used within FeatureControlProvider'
    )
  }
  return ctx
}

/** Read-only: whether a feature is enabled (for gating buttons/routes). */
export function useFeatureEnabled(id: FeatureControlId): boolean {
  const { isEnabled } = useFeatureControlContext()
  return isEnabled(id)
}

/** Read/write: toggle from Control panel or tests. */
export function useFeatureControl(id: FeatureControlId) {
  const { isEnabled, setEnabled } = useFeatureControlContext()
  return {
    enabled: isEnabled(id),
    setEnabled: (v: boolean) => setEnabled(id, v),
  }
}
