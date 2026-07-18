import { useEffect, useState } from 'react'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import {
  detectPiiCandidates,
  extractPdfText,
  generateCaseRequestId,
  piiTypeLabel,
  redactText,
  type PiiCandidate,
} from '@/lib/pdfDeidentify'

interface PdfDeidentifyPanelProps {
  /** 대조용으로만 쓴다 — 서버로 전송하지 않는다. */
  studentName: string
  onConfirm: (deidentifiedText: string, caseRequestId: string) => void
  onCancel: () => void
}

/**
 * 요구사항 9절: 원본 PDF를 브라우저에서만 읽고, 이름·학교명·생년월일 등 직접 식별정보
 * 후보를 교사가 확인한 뒤에만 정제된 텍스트를 다음 단계로 넘긴다. 자동 탐지가 완벽하지
 * 않다는 점을 확인 문구로 명시하고, 원본 PDF 바이트는 이 컴포넌트 밖으로 나가지 않는다.
 */
export function PdfDeidentifyPanel({ studentName, onConfirm, onCancel }: PdfDeidentifyPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [rawText, setRawText] = useState('')
  const [candidates, setCandidates] = useState<PiiCandidate[]>([])
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [confirmedChecked, setConfirmedChecked] = useState(false)

  useEffect(() => {
    setConfirmedChecked(false)
  }, [file, keepIds])

  async function handleFileSelected(selected: File | null) {
    setFile(selected)
    setRawText('')
    setCandidates([])
    setKeepIds(new Set())
    setError('')
    if (!selected) return
    if (selected.type !== 'application/pdf') {
      setError('PDF 파일만 선택할 수 있습니다.')
      return
    }
    setProcessing(true)
    try {
      const text = await extractPdfText(selected)
      setRawText(text)
      setCandidates(detectPiiCandidates(text, studentName))
    } catch {
      setError('PDF 텍스트를 읽는 중 문제가 발생했습니다. 스캔 이미지로만 된 PDF는 텍스트를 추출할 수 없습니다.')
    } finally {
      setProcessing(false)
    }
  }

  function toggleKeep(id: string) {
    setKeepIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const redacted = rawText ? redactText(rawText, candidates, keepIds) : ''
  const removedCount = candidates.length - keepIds.size

  function handleConfirm() {
    if (!confirmedChecked || !rawText) return
    onConfirm(redacted, generateCaseRequestId())
  }

  return (
    <div className="space-y-3 rounded-md border border-brand-200 bg-brand-50 p-3">
      <div>
        <label htmlFor="deidentifyFile" className="block text-xs font-medium text-gray-500">
          검사결과 PDF 선택(브라우저에서만 읽습니다 — 서버로 원본을 전송하지 않습니다)
        </label>
        <input
          id="deidentifyFile"
          type="file"
          accept="application/pdf"
          onChange={(event) => void handleFileSelected(event.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm"
        />
      </div>

      {processing && <p className="text-sm text-gray-600">PDF 텍스트를 읽는 중입니다...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {rawText && (
        <>
          <div className="rounded-md border border-amber-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900">
              직접 식별정보 후보 {candidates.length}건 중 {removedCount}건 제거 예정
            </p>
            <p className="mt-1 text-xs text-gray-500">
              자동 탐지는 완벽하지 않습니다. 목록을 직접 확인하고, 잘못 탐지된 항목만 "유지"로 바꾸세요.
            </p>
            {candidates.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">탐지된 후보가 없습니다. 그래도 아래 정제된 텍스트를 한 번 확인해 주세요.</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                {candidates.map((candidate) => {
                  const kept = keepIds.has(candidate.id)
                  return (
                    <li key={candidate.id} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1">
                      <span>
                        <span className="font-medium text-gray-700">[{piiTypeLabel(candidate.type)}]</span>{' '}
                        <span className={kept ? 'text-gray-500' : 'text-red-600 line-through'}>{candidate.text}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleKeep(candidate.id)}
                        className="shrink-0 text-xs font-semibold text-brand-700"
                      >
                        {kept ? '제거로 되돌리기' : '유지(오탐)'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500">AI에 전달될 정제된 텍스트 미리보기</p>
            <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-2 text-xs text-gray-700">
              {redacted}
            </pre>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmedChecked}
              onChange={(event) => setConfirmedChecked(event.target.checked)}
            />
            <span>학생 이름, 학교명, 생년월일 등 직접 식별정보가 제거되었는지 확인한 후 분석을 시작해 주세요.</span>
          </label>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!rawText || !confirmedChecked}
          className={primaryButtonClass}
        >
          분석 시작
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          취소
        </button>
      </div>
    </div>
  )
}
