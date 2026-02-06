'use client'

import { type ReactNode } from 'react'

import { useWorkspaceTheme } from '@/contexts/workspace-theme-context'
import { cn } from '@/lib/utils'

type DashboardThemeShellProps = {
  children: ReactNode
}

export function DashboardThemeShell({ children }: DashboardThemeShellProps) {
  const { theme } = useWorkspaceTheme()

  const darkModeClasses = theme.isDark
    ? `dark ${theme.darkVariant === 'ash' ? 'dark-ash' : 'dark-ember'}`
    : ''

  return (
    <div
      className={cn('relative min-h-screen text-foreground', darkModeClasses)}
      style={{
        backgroundAttachment: 'fixed',
        backgroundImage: theme.gradient,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
      }}
    >
      {children}
    </div>
  )
}
