import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

/** 브라우저에서 PDF를 읽는다 — 원본 바이트는 이 함수 호출 이후 어디로도 전송하지 않는다(요구사항 9절). */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const pageTexts: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pageTexts.push(text)
  }
  return pageTexts.join('\n')
}

export type PiiCandidateType = 'name' | 'phone' | 'birthdate' | 'school' | 'residentNumber'

export interface PiiCandidate {
  id: string
  type: PiiCandidateType
  text: string
  start: number
  end: number
}

const TYPE_LABEL: Record<PiiCandidateType, string> = {
  name: '이름으로 보이는 값',
  phone: '전화번호',
  birthdate: '생년월일',
  school: '학교명',
  residentNumber: '주민등록번호 형식',
}

export function piiTypeLabel(type: PiiCandidateType): string {
  return TYPE_LABEL[type]
}

interface RawMatch {
  type: PiiCandidateType
  text: string
  start: number
  end: number
}

function findAll(text: string, pattern: RegExp, type: PiiCandidateType, group = 0): RawMatch[] {
  const matches: RawMatch[] = []
  for (const match of text.matchAll(pattern)) {
    const value = match[group]
    if (!value) continue
    const start = match.index! + match[0].indexOf(value)
    matches.push({ type, text: value, start, end: start + value.length })
  }
  return matches
}

/**
 * 정규식/사전 기반 휴리스틱이다 — "100% 탐지"를 보장하지 않는다(요구사항 9절). 학생
 * 이름은 선택된 학생 레코드의 실제 이름과 문자열이 일치하는 곳을 우선 찾고,
 * 추가로 "이름:"/"성명:" 라벨 뒤에 오는 2~4자 한글 값도 후보로 잡는다. 교사가 이
 * 목록을 직접 확인·수정한 뒤에만 분석을 시작할 수 있다(AssessmentDeidentifyPanel).
 */
export function detectPiiCandidates(text: string, knownStudentName?: string): PiiCandidate[] {
  const raw: RawMatch[] = []

  if (knownStudentName && knownStudentName.trim()) {
    const escaped = knownStudentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    raw.push(...findAll(text, new RegExp(escaped, 'g'), 'name'))
  }
  raw.push(...findAll(text, /(이름|성명)\s*[:：]?\s*([가-힣]{2,4})(?=\s|$|[,)])/g, 'name', 2))
  raw.push(...findAll(text, /\d{6}\s*-\s*[1-4]\d{6}/g, 'residentNumber'))
  raw.push(...findAll(text, /01[0-9]-?\d{3,4}-?\d{4}/g, 'phone'))
  raw.push(
    ...findAll(
      text,
      /(19|20)\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/g,
      'birthdate',
    ),
  )
  raw.push(...findAll(text, /[가-힣]{1,10}(초등학교|중학교|고등학교|유치원)/g, 'school'))

  raw.sort((a, b) => a.start - b.start || b.end - a.end)

  const deduped: RawMatch[] = []
  let lastEnd = -1
  for (const match of raw) {
    if (match.start < lastEnd) continue // 겹치는 뒤쪽 후보는 건너뛴다(먼저 찾은 것 우선).
    deduped.push(match)
    lastEnd = match.end
  }

  return deduped.map((match, index) => ({ id: `pii-${index}`, ...match }))
}

/**
 * `keepIds`에 없는 후보만 `[제거됨]`으로 치환한다 — 기본값은 "전부 제거"이고, 교사가
 * 명시적으로 "유지"로 표시한 후보만 원문 그대로 남는다(오탐 대응).
 */
export function redactText(text: string, candidates: PiiCandidate[], keepIds: Set<string>): string {
  let result = ''
  let cursor = 0
  for (const candidate of candidates) {
    result += text.slice(cursor, candidate.start)
    result += keepIds.has(candidate.id) ? candidate.text : '[제거됨]'
    cursor = candidate.end
  }
  result += text.slice(cursor)
  return result
}

/** `CASE-20260718-X9K4` 형태의 일회성 요청 ID(요구사항 10절) — Gemini 요청·응답을 studentUuid와 나중에 연결하는 용도. */
export function generateCaseRequestId(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const random = crypto.getRandomValues(new Uint8Array(4))
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const suffix = Array.from(random, (byte) => chars[byte % chars.length]).join('')
  return `CASE-${y}${m}${d}-${suffix}`
}
