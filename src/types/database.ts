export interface SchoolRow {
  code: string
  name_th: string
  is_active: boolean
  sort_order: number
}

export interface ItemRow {
  id: string
  item_id: string
  school: string | null
  year: number
  pack: string | null
  exam_date: string | null
  strand: string
  topic: string | null
  subtopic: string | null
  bloom: string
  difficulty: number | null
  stem: string
  choice_a: string | null
  choice_b: string | null
  choice_c: string | null
  choice_d: string | null
  choice_e: string | null
  answer: string
  explanation: string | null
  trap_type: string | null
  media_url: string | null
  stimulus_id: string | null
  status: string
  p_value: number | null
  times_used: number
  created_at: string
  user_id: string | null
}

export type ItemInsert = Omit<ItemRow, 'id' | 'created_at' | 'times_used'> & {
  times_used?: number
}

export interface StimulusRow {
  stimulus_id: string
  school: string | null
  year: number | null
  content: string | null
  media_url: string | null
  user_id: string | null
}

export interface PaperRow {
  id: string
  paper_name: string
  mode: string | null
  config: Record<string, unknown> | null
  item_ids: string[]
  total_items: number
  created_at: string
  user_id: string | null
}

// Minimal Supabase Database type map (hand-written, not generated)
export interface Database {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow
        Insert: SchoolRow
        Update: Partial<SchoolRow>
      }
      items: {
        Row: ItemRow
        Insert: ItemInsert
        Update: Partial<ItemRow>
      }
      stimulus: {
        Row: StimulusRow
        Insert: StimulusRow
        Update: Partial<StimulusRow>
      }
      papers: {
        Row: PaperRow
        Insert: Omit<PaperRow, 'id' | 'created_at'>
        Update: Partial<PaperRow>
      }
    }
  }
}
