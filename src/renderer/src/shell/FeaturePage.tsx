import type { ReactNode } from 'react'

interface Props {
  submenu: ReactNode
  children: ReactNode
}

export function FeaturePage({ submenu, children }: Props) {
  return (
    <section className="feature-page">
      <div className="feature-submenu">{submenu}</div>
      <div className="feature-content">{children}</div>
    </section>
  )
}
