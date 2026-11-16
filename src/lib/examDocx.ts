// สร้างไฟล์ Word (.docx) ฝั่ง client — หน้าตาเดียวกับไฟล์ Word ที่ SOCIALNOCK LAB ส่งออก
// (TH Sarabun New 16 pt, หัวกระดาษมีโลโก้ + ชื่อชุด + เส้นใต้, ช่องชื่อ/คะแนน, คำชี้แจงพื้นเทา, ตัวเลือกสั้นจัด 2 คอลัมน์)
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx'
import { identityShuffle, type GeneratedItem } from '@/lib/paperGenerator'
import { LAB_COURSE_LINE, LAB_LOGO_URL, TH_CH, choicesAreShort, strandCounts, strandMeta, toLabQuestions, type LabQuestion } from '@/lib/labDoc'
import type { ItemRow } from '@/types/database'

const FONT = 'TH Sarabun New'
const GRAY = '4B5568'
const GREEN = '155F35'

export interface DocxOptions {
  durationMinutes?: number
  answerSheet?: boolean
}

let logoCache: Promise<ArrayBuffer | null> | null = null
function loadLogo(): Promise<ArrayBuffer | null> {
  logoCache ??= fetch(LAB_LOGO_URL)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null)
  return logoCache
}

const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, bold: o.bold, size: o.size, color: o.color, font: FONT })

function header(title: string, sub: string, count: number, logo: ArrayBuffer | null, opts: DocxOptions = {}): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: 0 },
      children: [
        ...(logo ? [new ImageRun({ type: 'png', data: logo, transformation: { width: 48, height: 48 } }), run('  ')] : []),
        run(title, { bold: true, size: 40 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '172033', space: 4 } },
      children: [
        run([LAB_COURSE_LINE, sub, `${count} ข้อ`, opts.durationMinutes ? `เวลา ${opts.durationMinutes} นาที` : ''].filter(Boolean).join(' · '), {
          size: 26,
          color: GRAY,
        }),
      ],
    }),
  ]
}

function idBlock(count: number): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: 40 },
      tabStops: [
        { type: TabStopType.LEFT, position: 5600 },
        { type: TabStopType.LEFT, position: 7400 },
      ],
      children: [run('ชื่อ–สกุล ............................................'), new TextRun({ text: '\tเลขที่ ........\tห้อง ........', font: FONT })],
    }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 120 }, children: [run(`คะแนน ........ / ${count}`, { bold: true })] }),
  ]
}

const shaded = (text: string) =>
  new Paragraph({
    spacing: { after: 160 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F5F8' },
    children: [run(text, { size: 28 })],
  })

function questionParas(q: LabQuestion, isKey: boolean): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      keepNext: true,
      spacing: { before: 80, after: 40 },
      indent: { left: 454, hanging: 454 },
      tabStops: [{ type: TabStopType.LEFT, position: 454 }],
      children: [run(`${q.no}.`, { bold: true }), new TextRun({ text: '\t', font: FONT }), run(q.stem)],
    }),
  ]
  const choiceRun = (j: number) => {
    const ok = isKey && j === q.answer
    return run(`${TH_CH[j]}. ${q.choices[j]}`, { bold: ok, color: ok ? GREEN : undefined })
  }
  if (choicesAreShort(q.choices)) {
    for (let j = 0; j < q.choices.length; j += 2) {
      out.push(
        new Paragraph({
          keepNext: j + 2 < q.choices.length,
          spacing: { after: 20 },
          indent: { left: 454 },
          tabStops: [{ type: TabStopType.LEFT, position: 4800 }],
          children: [choiceRun(j), ...(q.choices[j + 1] != null ? [new TextRun({ text: '\t', font: FONT }), choiceRun(j + 1)] : [])],
        })
      )
    }
  } else {
    q.choices.forEach((_, j) =>
      out.push(new Paragraph({ keepNext: j < q.choices.length - 1, spacing: { after: 20 }, indent: { left: 454 }, children: [choiceRun(j)] }))
    )
  }
  if (isKey && (q.explanation || q.trap)) {
    out.push(
      new Paragraph({
        spacing: { before: 40, after: 60 },
        indent: { left: 454 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F5F8' },
        children: [...(q.trap ? [run(`กับดัก: ${q.trap} · `, { bold: true, size: 26, color: 'A86500' })] : []), run(q.explanation, { size: 26, color: GRAY })],
      })
    )
  }
  return out
}

function keyTable(qs: LabQuestion[]): Table {
  const widths = [600, 600, 3900, 1950, 2300]
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'C9D1DC' }
  const cell = (text: string, w: number, head = false, color?: string) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF1F5' } : undefined,
      children: [new Paragraph({ spacing: { after: 0 }, children: [run(text, { bold: head || !!color, size: head ? 26 : 28, color })] })],
    })
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: ['ข้อ', 'ตอบ', 'คำตอบที่ถูก', 'สาระ · หัวข้อ', 'รหัสข้อสอบ'].map((h, i) => cell(h, widths[i], true)) }),
      ...qs.map(
        (q) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell(String(q.no), widths[0]),
              cell(TH_CH[q.answer] ?? '-', widths[1], false, GREEN),
              cell(q.choices[q.answer] ?? '', widths[2]),
              cell([strandMeta(q.strand)?.code, q.topic].filter(Boolean).join(' · ') || '–', widths[3]),
              cell(q.itemId, widths[4]),
            ],
          })
      ),
    ],
  })
}

function answerSheetParas(title: string, count: number, logo: ArrayBuffer | null): Paragraph[] {
  const paras = [...header(title, 'กระดาษคำตอบ', count, logo), ...idBlock(count), shaded('กากบาท ✕ ทับวงเล็บของคำตอบที่เลือก ข้อละหนึ่งคำตอบ')]
  for (let i = 0; i < count; i++) {
    paras.push(new Paragraph({ spacing: { after: 20 }, children: [run(`${String(i + 1).padStart(3, ' ')}.    ( ก )    ( ข )    ( ค )    ( ง )    ( จ )`)] }))
  }
  return paras
}

async function buildLabDocx(title: string, qs: LabQuestion[], opts: DocxOptions = {}): Promise<Blob> {
  const logo = await loadLogo()
  const name = title || 'ชุดข้อสอบ'
  const student = [
    ...header(name, 'แบบทดสอบ', qs.length, logo, opts),
    ...idBlock(qs.length),
    shaded(`คำชี้แจง: ข้อสอบมี ${qs.length} ข้อ ให้เลือกคำตอบที่ถูกที่สุดเพียงข้อเดียว แล้วกากบาท ✕ ทับตัวอักษรหน้าคำตอบ`),
    ...qs.flatMap((q) => questionParas(q, false)),
  ]
  const key = [
    ...header(name, 'เฉลยสำหรับครู', qs.length, logo),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        run('ตารางวิเคราะห์ข้อสอบ: ' + strandCounts(qs).map(([s, n]) => `${strandMeta(s)?.code ?? ''} ${s} ${n} ข้อ`.trim()).join(' · '), { bold: true, size: 28 }),
      ],
    }),
    ...qs.flatMap((q) => questionParas(q, true)),
    new Paragraph({ spacing: { before: 200, after: 80 }, children: [run('สรุปเฉลย', { bold: true, size: 32 })] }),
  ]
  const brk = () => new Paragraph({ children: [new PageBreak()] })
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 32 }, paragraph: { spacing: { after: 60 } } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1418 } } },
        children: [
          ...student,
          ...(opts.answerSheet ? [brk(), ...answerSheetParas(name, qs.length, logo)] : []),
          brk(),
          ...key,
          keyTable(qs),
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}

export async function buildExamDocxBlob(paperName: string, items: ItemRow[]): Promise<Blob> {
  const generated: GeneratedItem[] = items.map((item) => ({ item, shuffle: identityShuffle(item) }))
  return buildLabDocx(paperName, toLabQuestions(generated))
}

// ใช้กับชุดข้อสอบที่ "สุ่มออก" จากหน้าออกชุดข้อสอบ/พิมพ์ชุดข้อสอบ — เคารพลำดับตัวเลือกที่ถูกสลับ (shuffle) ไว้แล้ว
export async function buildGeneratedExamDocxBlob(paperName: string, items: GeneratedItem[], opts: DocxOptions = {}): Promise<Blob> {
  return buildLabDocx(paperName, toLabQuestions(items), opts)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
