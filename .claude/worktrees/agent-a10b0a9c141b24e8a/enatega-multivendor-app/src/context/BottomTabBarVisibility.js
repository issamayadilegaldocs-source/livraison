import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'

// Asymmetric sensitivity: the bar should reappear eagerly (small upward scroll,
// no delay) but hide reluctantly (only on a deliberate downward scroll).
const SHOW_SCROLL_DELTA = 4
const HIDE_SCROLL_DELTA = 28
const TOP_REVEAL_OFFSET = 24
const HIDE_DEBOUNCE_MS = 220
const SHOW_DEBOUNCE_MS = 0

const BottomTabBarVisibilityContext = createContext({
  hidden: false,
  onScroll: () => undefined,
  showTabBar: () => undefined,
  setBlocked: () => undefined
})

export function BottomTabBarVisibilityProvider({
  children,
  hidden,
  setHidden,
  forceVisible = false
}) {
  const lastScrollYRef = useRef(0)
  const hiddenRef = useRef(false)
  const scrollHiddenRef = useRef(false)
  const blockedRef = useRef(false)
  const forceVisibleRef = useRef(forceVisible)
  const pendingHiddenRef = useRef(false)
  const debounceTimerRef = useRef(null)

  const clearDebounceTimer = useCallback(() => {
    if (!debounceTimerRef.current) return
    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = null
  }, [])

  const commitHidden = useCallback(
    (nextHidden) => {
      clearDebounceTimer()
      if (hiddenRef.current === nextHidden) return
      hiddenRef.current = nextHidden
      pendingHiddenRef.current = nextHidden
      setHidden(nextHidden)
    },
    [clearDebounceTimer, setHidden]
  )

  const updateHidden = useCallback(
    (nextHidden, immediate = false) => {
      if (forceVisibleRef.current) {
        commitHidden(false)
        return
      }

      pendingHiddenRef.current = nextHidden

      if (immediate) {
        commitHidden(nextHidden)
        return
      }

      clearDebounceTimer()

      if (hiddenRef.current === nextHidden) return

      debounceTimerRef.current = setTimeout(() => {
        commitHidden(pendingHiddenRef.current)
      }, nextHidden ? HIDE_DEBOUNCE_MS : SHOW_DEBOUNCE_MS)
    },
    [clearDebounceTimer, commitHidden]
  )

  const applyHiddenState = useCallback(
    (immediate = false) => {
      updateHidden(!forceVisibleRef.current && (blockedRef.current || scrollHiddenRef.current), immediate)
    },
    [updateHidden]
  )

  const setBlocked = useCallback(
    (blocked) => {
      blockedRef.current = blocked
      applyHiddenState(blocked)
    },
    [applyHiddenState]
  )

  const showTabBar = useCallback(() => {
    lastScrollYRef.current = 0
    scrollHiddenRef.current = false
    applyHiddenState(true)
  }, [applyHiddenState])

  React.useEffect(() => clearDebounceTimer, [clearDebounceTimer])

  React.useEffect(() => {
    forceVisibleRef.current = forceVisible

    if (forceVisible) {
      scrollHiddenRef.current = false
      commitHidden(false)
      return
    }

    applyHiddenState()
  }, [applyHiddenState, commitHidden, forceVisible])

  const onScroll = useCallback(
    (event) => {
      const currentY = Math.max(event.nativeEvent.contentOffset.y, 0)
      const delta = currentY - lastScrollYRef.current

      if (currentY <= TOP_REVEAL_OFFSET) {
        lastScrollYRef.current = currentY
        scrollHiddenRef.current = false
        applyHiddenState()
        return
      }

      const goingDown = delta > 0
      const threshold = goingDown ? HIDE_SCROLL_DELTA : SHOW_SCROLL_DELTA
      if (Math.abs(delta) < threshold) return

      lastScrollYRef.current = currentY
      scrollHiddenRef.current = goingDown
      applyHiddenState()
    },
    [applyHiddenState]
  )

  const value = useMemo(
    () => ({
      hidden,
      onScroll,
      showTabBar,
      setBlocked
    }),
    [hidden, onScroll, showTabBar, setBlocked]
  )

  return (
    <BottomTabBarVisibilityContext.Provider value={value}>
      {children}
    </BottomTabBarVisibilityContext.Provider>
  )
}

export function useBottomTabBarScroll() {
  return useContext(BottomTabBarVisibilityContext).onScroll
}

export function useBottomTabBarHidden() {
  return useContext(BottomTabBarVisibilityContext).hidden
}

export function useShowBottomTabBarOnFocus() {
  const { showTabBar } = useContext(BottomTabBarVisibilityContext)

  useFocusEffect(
    useCallback(() => {
      showTabBar()
    }, [showTabBar])
  )
}

// Imperative blocker — lets a screen hide the tab bar (e.g. while a bottom
// sheet is open) WITHOUT routing through that screen's own state. Calling this
// updates the provider/tab-navigator only; the calling screen does not
// re-render, which keeps sheet-open taps off the screen's render path.
export function useBottomTabBarSetBlocked() {
  return useContext(BottomTabBarVisibilityContext).setBlocked
}

export function useBottomTabBarBlock(blocked) {
  const { setBlocked } = useContext(BottomTabBarVisibilityContext)

  React.useEffect(() => {
    setBlocked(blocked)

    return () => {
      setBlocked(false)
    }
  }, [blocked, setBlocked])
}
