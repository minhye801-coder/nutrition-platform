import type { ReactNode } from 'react'

interface PlaceholderNoticeProps {
  children: ReactNode
}

export function PlaceholderNotice({ children }: PlaceholderNoticeProps) {
  return (
    <div className="rounded-md border border-dashed border-brand-500/50 bg-brand-50 px-4 py-3 text-sm text-brand-700">
      {children}
    </div>
  )
}
