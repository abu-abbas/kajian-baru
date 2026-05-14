import { Moon, Sun, Laptop } from 'lucide-react'
import { Button } from './button'
import { useTheme } from '../theme-provider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  // Cycles: light -> dark -> system -> light
  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const getIcon = () => {
    if (theme === 'light') return <Sun className="h-[1.2rem] w-[1.2rem] text-amber-500 transition-all animate-in zoom-in-75 duration-300" />
    if (theme === 'dark') return <Moon className="h-[1.2rem] w-[1.2rem] text-emerald-400 transition-all animate-in spin-in-45 zoom-in-75 duration-300" />
    return <Laptop className="h-[1.2rem] w-[1.2rem] text-muted-foreground transition-all animate-in zoom-in-75 duration-300" />
  }

  const getLabel = () => {
    if (theme === 'light') return 'Mode Terang'
    if (theme === 'dark') return 'Mode Gelap'
    return 'Otomatis (Sistem)'
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      title={getLabel()}
      className="relative rounded-full hover:bg-accent flex items-center justify-center h-10 w-10"
    >
      {getIcon()}
      <span className="sr-only">Ganti Tema</span>
    </Button>
  )
}
