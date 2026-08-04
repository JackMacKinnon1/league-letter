'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

const SKIPPED_TAGS = new Set([
  'HEADER',
  'NAV',
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'LINK',
])

const MAX_LAYOUT_DEPTH = 2
const MAX_DELAY_STEP = 8
const REVEAL_RUN_ATTRIBUTE = 'pageRevealRun'

function isHTMLElement(element: Element): element is HTMLElement {
  return element instanceof HTMLElement
}

function shouldSkip(element: HTMLElement) {
  return (
    SKIPPED_TAGS.has(element.tagName) ||
    element.dataset.reveal === 'skip' ||
    element.hidden ||
    element.getAttribute('aria-hidden') === 'true' ||
    element.classList.contains('fixed')
  )
}

function directChildren(element: HTMLElement) {
  return Array.from(element.children).filter(
    (child): child is HTMLElement => isHTMLElement(child) && !shouldSkip(child)
  )
}

function hasLayoutClass(element: HTMLElement, prefix: string) {
  return Array.from(element.classList).some(
    (className) => className === prefix || className.startsWith(`${prefix}-`)
  )
}

function isGrid(element: HTMLElement) {
  return element.classList.contains('grid')
}

function isVerticalStack(element: HTMLElement) {
  return hasLayoutClass(element, 'space-y')
}

function isPageContainer(element: HTMLElement) {
  return (
    Array.from(element.classList).some((className) =>
      className.startsWith('max-w-')
    ) || element.classList.contains('container')
  )
}

/**
 * Flattens only high-level grids and vertical stacks. This gives cards and
 * sections their own entrance without animating every icon, label and row.
 */
function flattenLayout(element: HTMLElement, depth = 0): HTMLElement[] {
  if (depth >= MAX_LAYOUT_DEPTH) return [element]

  const children = directChildren(element)
  const canExpand =
    children.length > 0 &&
    children.length <= 12 &&
    (isGrid(element) || isVerticalStack(element))

  if (!canExpand) return [element]

  return children.flatMap((child) => {
    if (isVerticalStack(child) || isGrid(child)) {
      return flattenLayout(child, depth + 1)
    }

    return [child]
  })
}

function collectRevealGroups(root: HTMLElement): HTMLElement[][] {
  const main = root.querySelector('main')
  if (!main || !isHTMLElement(main)) return []

  const groups: HTMLElement[][] = []

  for (const topLevelChild of directChildren(main)) {
    // A page section usually contains one centered max-width wrapper. Animate
    // that wrapper's major children rather than fading the entire section once.
    if (topLevelChild.tagName === 'SECTION') {
      const sectionChildren = directChildren(topLevelChild)
      const sectionContent =
        sectionChildren.length === 1 && isPageContainer(sectionChildren[0])
          ? sectionChildren[0]
          : topLevelChild

      const contentChildren = directChildren(sectionContent)

      if (isGrid(sectionContent) || isVerticalStack(sectionContent)) {
        const items = flattenLayout(sectionContent)
        if (items.length) groups.push(items)
        continue
      }

      if (contentChildren.length > 0 && contentChildren.length <= 14) {
        const items = contentChildren.flatMap((child) => flattenLayout(child))
        if (items.length) groups.push(items)
        continue
      }

      groups.push([topLevelChild])
      continue
    }

    // Several pages use a centered div directly inside <main> rather than a
    // section. Treat it the same way.
    if (isPageContainer(topLevelChild)) {
      const items = directChildren(topLevelChild).flatMap((child) =>
        flattenLayout(child)
      )

      if (items.length) {
        groups.push(items)
        continue
      }
    }

    groups.push([topLevelChild])
  }

  return groups
}

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const rootRef = useRef<HTMLDivElement>(null)
  const runNumberRef = useRef(0)
  const [restoreReplay, setRestoreReplay] = useState(0)

  // A page restored from the browser back/forward cache does not always remount
  // React. Replay the entrance sequence in that case as well.
  useLayoutEffect(() => {
    const replayRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) setRestoreReplay((value) => value + 1)
    }

    window.addEventListener('pageshow', replayRestoredPage)
    return () => window.removeEventListener('pageshow', replayRestoredPage)
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const runId = `${pathname}:${restoreReplay}:${++runNumberRef.current}`
    const animatedElements = new Set<HTMLElement>()
    const pendingElements = new Set<HTMLElement>()
    const completionTimers = new Set<number>()
    let scanFrame = 0
    let firstRevealFrame = 0
    let secondRevealFrame = 0

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    const finishReveal = (element: HTMLElement) => {
      // Keep the run marker until the route changes. That prevents MutationObserver
      // callbacks caused by class cleanup from replaying the same item endlessly.
      element.classList.remove('stagger-reveal', 'stagger-reveal-visible')
      element.style.removeProperty('--reveal-order')
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          const element = entry.target as HTMLElement
          element.classList.add('stagger-reveal-visible')
          observer.unobserve(element)

          const order =
            Number(element.style.getPropertyValue('--reveal-order')) || 0
          const timer = window.setTimeout(() => {
            finishReveal(element)
            completionTimers.delete(timer)
          }, 860 + order * 72)

          completionTimers.add(timer)
        }
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -7% 0px',
      }
    )

    const observePendingElements = () => {
      if (pendingElements.size === 0) return

      // Two animation frames guarantee that the hidden state is painted before
      // above-the-fold elements are made visible. This makes the animation replay
      // reliably on fast cached client-side navigations as well as first load.
      window.cancelAnimationFrame(firstRevealFrame)
      window.cancelAnimationFrame(secondRevealFrame)

      firstRevealFrame = window.requestAnimationFrame(() => {
        secondRevealFrame = window.requestAnimationFrame(() => {
          pendingElements.forEach((element) => {
            if (element.isConnected) observer.observe(element)
          })
          pendingElements.clear()
        })
      })
    }

    const registerRevealItems = () => {
      const revealGroups = collectRevealGroups(root)

      revealGroups.forEach((group) => {
        group.forEach((element, index) => {
          if (element.dataset[REVEAL_RUN_ATTRIBUTE] === runId) return

          // A persistent layout can reuse DOM nodes across routes. Explicitly reset
          // any previous finished state before assigning this navigation's run.
          element.classList.remove('stagger-reveal', 'stagger-reveal-visible')
          element.style.removeProperty('--reveal-order')
          element.dataset[REVEAL_RUN_ATTRIBUTE] = runId
          animatedElements.add(element)

          if (reducedMotion) return

          element.classList.add('stagger-reveal')
          element.style.setProperty(
            '--reveal-order',
            String(Math.min(index, MAX_DELAY_STEP))
          )
          pendingElements.add(element)
        })
      })

      if (!reducedMotion) observePendingElements()
    }

    const scheduleScan = () => {
      window.cancelAnimationFrame(scanFrame)
      scanFrame = window.requestAnimationFrame(registerRevealItems)
    }

    // Scan immediately for server-rendered content, and keep scanning while the
    // route streams, resolves Suspense boundaries, or replaces cached page content.
    registerRevealItems()
    const mutationObserver = new MutationObserver(scheduleScan)
    mutationObserver.observe(root, {
      childList: true,
      subtree: true,
    })

    return () => {
      window.cancelAnimationFrame(scanFrame)
      window.cancelAnimationFrame(firstRevealFrame)
      window.cancelAnimationFrame(secondRevealFrame)
      mutationObserver.disconnect()
      observer.disconnect()
      completionTimers.forEach((timer) => window.clearTimeout(timer))
      completionTimers.clear()
      pendingElements.clear()

      animatedElements.forEach((element) => {
        element.classList.remove('stagger-reveal', 'stagger-reveal-visible')
        element.style.removeProperty('--reveal-order')
        delete element.dataset[REVEAL_RUN_ATTRIBUTE]
      })
      animatedElements.clear()
    }
  }, [pathname, restoreReplay])

  return (
    <div
      key={`${pathname}:${restoreReplay}`}
      ref={rootRef}
      className="page-transition min-h-screen"
      data-page-route={pathname}
    >
      {children}
    </div>
  )
}
