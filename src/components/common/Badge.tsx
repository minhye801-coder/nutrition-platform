import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'warning' | 'success' | 'danger'

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-brand-50 text-brand-700',
  danger: 'bg-red-50 text-red-700',
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  )
}
