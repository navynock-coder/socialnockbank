import * as React from 'react'
import { supabase } from '@/lib/supabase'
import type { ItemRow } from '@/types/database'

// ดึงข้อมูลข้อสอบ "ทั้งหมด" ของผู้ใช้ (ไม่แบ่งหน้า) มาไว้ฝั่ง client
// เหมาะกับสเกลข้อมูลระดับ ~1,000-5,000 ข้อ ซึ่งเพียงพอสำหรับ dashboard/สถิติ/paper generator
// หน้าคลังข้อสอบใช้ pagination แยกต่างหากจาก dataset นี้เพื่อความเร็วในการ render
export function useAllItems() {
  const [items, setItems] = React.useState<ItemRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const pageSize = 1000
    let from = 0
    let all: ItemRow[] = []
    // paginate through Supabase's default 1000-row cap
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .range(from, from + pageSize - 1)
        .order('created_at', { ascending: false })
      if (error) {
        setError(error.message)
        break
      }
      all = all.concat(data ?? [])
      if (!data || data.length < pageSize) break
      from += pageSize
    }
    setItems(all)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    reload()
  }, [reload])

  return { items, loading, error, reload }
}
