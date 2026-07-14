import { useCallback, useEffect, useState } from 'react'
import { fetchInstallation } from '@/services/installationService'
import type { Installation } from '@/types/installation'

interface UseInstallationResult {
  installation: Installation | null
  loading: boolean
  refresh: () => Promise<void>
}

export function useInstallation(): UseInstallationResult {
  const [installation, setInstallation] = useState<Installation | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await fetchInstallation()
    setInstallation(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { installation, loading, refresh }
}
