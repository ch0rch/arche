'use client'

import { useWorkspaceTheme } from '@/contexts/workspace-theme-context'
import { cn } from '@/lib/utils'

export function ThemePicker() {
  const { themes, themeId, setThemeId } = useWorkspaceTheme()

  const lightThemes = themes.filter((theme) => !theme.isDark)
  const darkThemes = themes.filter((theme) => theme.isDark)

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Light</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {lightThemes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeId(theme.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                themeId === theme.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 hover:border-border',
              )}
            >
              <div className="flex h-5 w-8 shrink-0 overflow-hidden rounded-md border border-border/50">
                <div className="w-1/2" style={{ backgroundColor: theme.swatches[0] }} />
                <div className="w-1/2" style={{ backgroundColor: theme.swatches[1] }} />
              </div>
              <span className="text-sm">{theme.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Dark</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {darkThemes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeId(theme.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                themeId === theme.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 hover:border-border',
              )}
            >
              <div className="flex h-5 w-8 shrink-0 overflow-hidden rounded-md border border-border/50">
                <div className="w-1/2" style={{ backgroundColor: theme.swatches[0] }} />
                <div className="w-1/2" style={{ backgroundColor: theme.swatches[1] }} />
              </div>
              <span className="text-sm">{theme.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
