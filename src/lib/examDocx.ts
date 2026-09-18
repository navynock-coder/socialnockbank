// สร้างไฟล์ Word (.docx) จากชุดข้อสอบต้นฉบับ ฝั่ง client ล้วนๆ (ไม่ต้องมี backend)
// ใช้ไลบรารี `docx` (ทำงานในเบราว์เซอร์ได้ผ่าน Packer.toBlob)
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak,
  BorderStyle,
} from 'docx'
import { ANSWER_TH_LABEL } from '@/lib/vocab'
import { getChoiceText, type GeneratedItem } from '@/lib/paperGenerator'
import type { ItemRow } from '@/types/database'

const ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E'] as const
const COURSE_NAME = 'คอร์สสอบเข้า ม.1 วิชาสังคมศึกษา — ครูน็อค'

interface ChoiceForDocx {
  displayKey: string
  text: string
  isCorrect: boolean
}

function headerParagraphs(paperName: string, mode: 'student' | 'answer'): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '1e3a5f' } },
      spacing: { after: 200 },
      children: [new TextRun({ text: COURSE_NAME, bold: true, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: paperName, bold: true, size: 24 })],
    }),
  ]
  if (mode === 'student') {
    paras.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({ text: 'ชื่อ-สกุล .................................................... ', size: 20 }),
          new TextRun({ text: 'เลขที่ ............. ', size: 20 }),
          new TextRun({ text: 'เวลาสอบ .............. นาที', size: 20 }),
        ],
      })
    )
  } else {
    paras.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: 'ฉบับเฉลยละเอียด (สำหรับผู้สอนเท่านั้น)', color: '15803d', bold: true, size: 20 })],
      })
    )
  }
  return paras
}

function itemParagraphsGeneric(
  stem: string,
  choices: ChoiceForDocx[],
  explanation: string | null,
  trapType: string | null,
  idx: number,
  mode: 'student' | 'answer'
): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [new TextRun({ text: `ข้อ ${idx + 1}. ${stem}`, bold: true, size: 24 })],
    }),
  ]

  for (const c of choices) {
    const isCorrect = mode === 'answer' && c.isCorrect
    paras.push(
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 40 },
        shading: isCorrect ? { fill: 'dcfce7' } : undefined,
        children: [
          new TextRun({
            text: `${ANSWER_TH_LABEL[c.displayKey]}. ${c.text}`,
            bold: isCorrect,
            color: isCorrect ? '166534' : undefined,
            size: 22,
          }),
        ],
      })
    )
  }

  if (mode === 'answer' && (explanation || trapType)) {
    if (trapType) {
      paras.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 80 },
          children: [new TextRun({ text: `กับดัก: ${trapType}`, italics: true, size: 20, color: '374151' })],
        })
      )
    }
    if (explanation) {
      paras.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 60 },
          children: [new TextRun({ text: explanation, size: 20, color: '374151' })],
        })
      )
    }
  }

  return paras
}

function itemParagraphs(item: ItemRow, idx: number, mode: 'student' | 'answer'): Paragraph[] {
  const choices: ChoiceForDocx[] = ANSWER_KEYS.map((key) => ({
    displayKey: key,
    text: getChoiceText(item, key) ?? '',
    isCorrect: item.answer === key,
  })).filter((c) => c.text)
  return itemParagraphsGeneric(item.stem, choices, item.explanation, item.trap_type, idx, mode)
}

function buildDoc(studentParas: Paragraph[], answerParas: Paragraph[]): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'TH Sarabun New', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [...studentParas, new Paragraph({ children: [new PageBreak()] }), ...answerParas],
      },
    ],
  })
}

export async function buildExamDocxBlob(paperName: string, items: ItemRow[]): Promise<Blob> {
  const studentParas: Paragraph[] = [
    ...headerParagraphs(paperName, 'student'),
    ...items.flatMap((item, idx) => itemParagraphs(item, idx, 'student')),
  ]

  const answerParas: Paragraph[] = [
    ...headerParagraphs(paperName, 'answer'),
    ...items.flatMap((item, idx) => itemParagraphs(item, idx, 'answer')),
  ]

  return Packer.toBlob(buildDoc(studentParas, answerParas))
}

// ใช้กับชุดข้อสอบที่ "สุ่มออก" จากหน้าออกชุดข้อสอบ/พิมพ์ชุดข้อสอบ — เคารพลำดับตัวเลือกที่ถูกสลับ (shuffle) ไว้แล้ว
export async function buildGeneratedExamDocxBlob(paperName: string, items: GeneratedItem[]): Promise<Blob> {
  const toChoices = (gi: GeneratedItem): ChoiceForDocx[] =>
    gi.shuffle.order.map((originalKey, i) => {
      const displayKey = ANSWER_KEYS[i]
      return {
        displayKey,
        text: getChoiceText(gi.item, originalKey) ?? '',
        isCorrect: gi.shuffle.newAnswer === displayKey,
      }
    })

  const studentParas: Paragraph[] = [
    ...headerParagraphs(paperName, 'student'),
    ...items.flatMap((gi, idx) =>
      itemParagraphsGeneric(gi.item.stem, toChoices(gi), null, null, idx, 'student')
    ),
  ]

  const answerParas: Paragraph[] = [
    ...headerParagraphs(paperName, 'answer'),
    ...items.flatMap((gi, idx) =>
      itemParagraphsGeneric(gi.item.stem, toChoices(gi), gi.item.explanation, gi.item.trap_type, idx, 'answer')
    ),
  ]

  return Packer.toBlob(buildDoc(studentParas, answerParas))
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
