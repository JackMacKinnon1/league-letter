'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
const REVEAL_DELAY_MS = 72
const REVEAL_DURATION_MS = 720

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

function isNearViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return rect.bottom > 0 && rect.top < window.innerHeight * 0.93
}

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const rootRef = useRef<HTMLDivElement>(null)
  const [restoreReplay, setRestoreReplay] = useState(0)

  // A page restored from the browser back/forward cache does not always remount
  // React. Replay the entrance sequence in that case as well.
  useEffect(() => {
    const replayRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) setRestoreReplay((value) => value + 1)
    }

    window.addEventListener('pageshow', replayRestoredPage)
    return () => window.removeEventListener('pageshow', replayRestoredPage)
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const registeredElements = new WeakSet<HTMLElement>()
    const revealOrders = new WeakMap<HTMLElement, number>()
    const runningAnimations = new Set<Animation>()
    let scanFrame = 0

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    const playReveal = (element: HTMLElement) => {
      if (reducedMotion || !element.isConnected) return

      const order = revealOrders.get(element) ?? 0
      const animation = element.animate(
        [
          {
            opacity: 0,
            transform: 'translateY(18px) scale(0.992)',
            filter: 'blur(5px)',
          },
          {
            opacity: 1,
            transform: 'translateY(0) scale(1)',
            filter: 'blur(0px)',
          },
        ],
        {
          duration: REVEAL_DURATION_MS,
          delay: Math.min(order, MAX_DELAY_STEP) * REVEAL_DELAY_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'backwards',
        }
      )

      runningAnimations.add(animation)

      const removeAnimation = () => runningAnimations.delete(animation)
      animation.addEventListener('finish', removeAnimation, { once: true })
      animation.addEventListener('cancel', removeAnimation, { once: true })
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          const element = entry.target as HTMLElement
          intersectionObserver.unobserve(element)
          playReveal(element)
        }
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -7% 0px',
      }
    )

    const registerRevealItems = () => {
      const revealGroups = collectRevealGroups(root)

      revealGroups.forEach((group) => {
        group.forEach((element, index) => {
          if (registeredElements.has(element)) return

          registeredElements.add(element)
          revealOrders.set(element, Math.min(index, MAX_DELAY_STEP))

          if (reducedMotion) return

          if (isNearViewport(element)) {
            playReveal(element)
          } else {
            intersectionObserver.observe(element)
          }
        })
      })
    }

    const scheduleScan = () => {
      window.cancelAnimationFrame(scanFrame)
      scanFrame = window.requestAnimationFrame(registerRevealItems)
    }

    // This does not add classes, data attributes, or inline styles to React-owned
    // elements. Web Animations are visual-only, so they cannot create a hydration
    // mismatch even when a nested route is still hydrating.
    registerRevealItems()

    const mutationObserver = new MutationObserver(scheduleScan)
    mutationObserver.observe(root, {
      childList: true,
      subtree: true,
    })

    return () => {
      window.cancelAnimationFrame(scanFrame)
      mutationObserver.disconnect()
      intersectionObserver.disconnect()
      runningAnimations.forEach((animation) => animation.cancel())
      runningAnimations.clear()
    }
  }, [pathname, restoreReplay])

  return (
    <div
      key={`${pathname}:${restoreReplay}`}
      ref={rootRef}
      className="page-transition min-h-screen"
    >
      {children}
    </div>
  )
}
