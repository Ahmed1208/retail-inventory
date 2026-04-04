import { useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void) {
  const el = document.documentElement
  const mo = new MutationObserver(onStoreChange)
  mo.observe(el, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark')
}

function getServerSnapshot() {
  return false
}

/** True when `<html>` has the `dark` class (Tailwind dark mode). */
export function useDocumentDarkClass(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
