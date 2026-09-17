import * as React from 'react'
import { supabase } from '@/lib/supabase'
import type { SchoolRow } from '@/types/database'

export function useSchools() {
  const [schools, setSchools] = React.useState<SchoolRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) setError(error.message)
    else setSchools(data ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    reload()
  }, [reload])

  const schoolMap = React.useMemo(() => {
    const m = new Map<string, SchoolRow>()
    schools.forEach((s) => m.set(s.code, s))
    return m
  }, [schools])

  return { schools, schoolMap, loading, error, reload }
}
