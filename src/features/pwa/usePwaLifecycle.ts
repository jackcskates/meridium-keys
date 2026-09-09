import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface PwaEnvironmentInput {
  maxTouchPoints: number
  platform: string
  standaloneDisplay: boolean
  userAgent: string
  webkitStandalone?: boolean
}

export function detectPwaEnvironment(input: PwaEnvironmentInput) {
  const isIos = /iphone|ipad|ipod/i.test(input.userAgent)
    || (input.platform === 'MacIntel' && input.maxTouchPoints > 1)

  return {
    isIos,
    isStandalone: input.standaloneDisplay || input.webkitStandalone === true,
  }
}

function readEnvironment() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return detectPwaEnvironment({
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform,
    standaloneDisplay: window.matchMedia('(display-mode: standalone)').matches,
    userAgent: navigator.userAgent,
    webkitStandalone: iosNavigator.standalone,
  })
}

export function usePwaLifecycle() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [environment, setEnvironment] = useState(readEnvironment)

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateEnvironment = () => setEnvironment(readEnvironment())
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstallPrompt(null)
      updateEnvironment()
    }
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    displayMode.addEventListener('change', updateEnvironment)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      displayMode.removeEventListener('change', updateEnvironment)
    }
  }, [])

  const install = useCallback(async () => {
    if (!installPrompt) return 'unavailable' as const
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    return choice.outcome
  }, [installPrompt])

  return {
    ...environment,
    canPromptInstall: Boolean(installPrompt),
    isOnline,
    install,
  }
}
