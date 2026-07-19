import { useEffect, useState } from 'react'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import {
  detectGradeMismatch,
  detectPiiCandidates,
  extractPdfText,
  generateCaseRequestId,
  hasNameMismatch,
  piiTypeLabel,
  redactText,
  type PiiCandidate,
} from '@/lib/pdfDeidentify'

const NO_TEXT_MESSAGE =
  '이 PDF에서는 분석 가능한 텍스트를 찾지 못했습니다. 자료를 확인하고 필요한 항목을 직접 입력해 주세요.'

interface PdfFieldProps {
  fieldId: string
  label: string
  required: boolean
  studentName: string
  studentGrade: string
  /** 준비 완료(교사 확인 체크 완료) 상태가 바뀔 때마다 호출된다 — null이면 "아직 쓸 수 없음". */
  onReadyChange: (redactedText: string | null) => void
  /** 파일이 선택됐지만 아직 분석에 쓸 준비가 안 된 상태인지(진행 중/미확인/텍스트 없음) 부모에게 알린다. */
  onPendingChange: (pending: boolean) => void
  /**
   * 이름·학년 불일치 경고 문구 — 리다크션 전 원문에서만 판단할 수 있으므로(요구사항
   * 6절 D), 검토 화면이 분석 이후에도 계속 보여줄 수 있도록 부모(AssessmentDetailPage)에
   * 문자열로만 넘긴다. 원문 자체나 후보 목록은 넘기지 않는다.
   */
  onMismatchChange: (warnings: string[]) => void
}

/**
 * 원본은 진단결과 PDF(필수)와 응답내역 PDF(선택) 2개를 함께 다뤘다(legacy `resultPdf`/
 * `responsePdf`, Index.html:614-626) — 이 필드 하나가 그중 하나를 담당한다. 파일 선택
 * 자체에는 등록 버튼이 없다: 두 필드가 모두 준비되면 부모(PdfDeidentifyPanel)의
 * "두 자료 분석하기" 버튼 하나로만 분석이 시작된다(요구사항 4·9절, 버튼 난립 방지).
 */
function PdfField({
  fieldId,
  label,
  required,
  studentName,
  studentGrade,
  onReadyChange,
  onPendingChange,
  onMismatchChange,
}: PdfFieldProps) {
  const [rawText, setRawText] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<PiiCandidate[]>([])
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [noText, setNoText] = useState(false)
  const [confirmedChecked, setConfirmedChecked] = useState(false)
  const [fileName, setFileName] = useState('')

  const redacted = rawText ? redactText(rawText, candidates, keepIds) : ''
  const nameMismatch = hasNameMismatch(candidates)
  const gradeMismatch = rawText ? detectGradeMismatch(rawText, studentGrade) : { foundGrades: [], mismatch: false }
  const hasFile = Boolean(fileName)
  const ready = confirmedChecked && Boolean(rawText)

  useEffect(() => {
    onReadyChange(ready ? redacted : null)
    // 파일을 선택했는데 아직 분석에 쓸 준비가 안 됐으면(처리 중/텍스트 없음/미확인) pending.
    onPendingChange(hasFile && !ready)
    const warnings: string[] = []
    if (nameMismatch) {
      warnings.push(`${label}: PDF에서 발견된 이름이 등록된 학생 이름(${studentName || '미상'})과 다릅니다.`)
    }
    if (gradeMismatch.mismatch) {
      warnings.push(
        `${label}: PDF에 표기된 학년(${gradeMismatch.foundGrades.join(', ')}학년)이 등록된 학년(${studentGrade}학년)과 다릅니다.`,
      )
    }
    onMismatchChange(warnings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, redacted, hasFile, nameMismatch, gradeMismatch.mismatch])

  async function handleFileSelected(selected: File | null) {
    setFileName(selected?.name ?? '')
    setRawText(null)
    setCandidates([])
    setKeepIds(new Set())
    setError('')
    setNoText(false)
    setConfirmedChecked(false)
    if (!selected) return
    if (selected.type !== 'application/pdf') {
      setError('PDF 파일만 선택할 수 있습니다.')
      return
    }
    setProcessing(true)
    try {
      const text = await extractPdfText(selected)
      if (!text.trim()) {
        setNoText(true)
      } else {
        setRawText(text)
        setCandidates(detectPiiCandidates(text, studentName))
      }
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

  const removedCount = candidates.length - keepIds.size

  return (
    <div className="space-y-3 rounded-md border border-brand-200 bg-brand-50 p-3">
      <div>
        <label htmlFor={fieldId} className="block text-xs font-medium text-gray-500">
          {label}{required ? ' (필수)' : ' (선택)'} — 브라우저에서만 읽습니다, 서버로 원본을 전송하지 않습니다
        </label>
        <input
          id={fieldId}
          type="file"
          accept="application/pdf"
          onChange={(event) => void handleFileSelected(event.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm"
        />
      </div>

      {processing && <p className="text-sm text-gray-600">PDF 텍스트를 읽는 중입니다...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {noText && <p className="text-sm text-amber-700">{NO_TEXT_MESSAGE}</p>}

      {rawText && (
        <>
          {nameMismatch && (
            <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
              PDF에서 발견된 이름이 등록된 학생 이름({studentName || '미상'})과 다릅니다. 다른 학생의 자료가
              아닌지 확인해 주세요.
            </div>
          )}
          {gradeMismatch.mismatch && (
            <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
              PDF에 표기된 학년({gradeMismatch.foundGrades.join(', ')}학년)이 등록된 학년({studentGrade}학년)과
              다릅니다.
            </div>
          )}

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
            <span>학생 이름, 학교명, 생년월일 등 직접 식별정보가 제거되었는지 확인했습니다.</span>
          </label>
        </>
      )}
    </div>
  )
}

interface PdfDeidentifyPanelProps {
  /** 대조용으로만 쓴다 — 서버로 전송하지 않는다. */
  studentName: string
  /** 학년 불일치 경고 대조용 — 서버로 전송하지 않는다. */
  studentGrade: string
  onConfirm: (diagnosisText: string, caseRequestId: string, responseText: string | undefined, mismatchWarnings: string[]) => void
  onCancel: () => void
}

/**
 * 요구사항 4·9절: 학생 한 명당 진단결과 PDF(필수)+응답내역 PDF(선택) 두 자료를 한 화면에서
 * 다루고, 분석 시작 버튼은 하나만 둔다(legacy "PDF 업로드 및 자동 확인" 버튼 1개와 동일한
 * 원칙). 원본 PDF를 브라우저에서만 읽고, 이름·학교명·생년월일 등 직접 식별정보 후보를
 * 교사가 확인한 뒤에만 정제된 텍스트를 다음 단계로 넘긴다. 자동 탐지가 완벽하지 않다는
 * 점을 확인 문구로 명시하고, 원본 PDF 바이트는 이 컴포넌트 밖으로 나가지 않는다.
 */
export function PdfDeidentifyPanel({ studentName, studentGrade, onConfirm, onCancel }: PdfDeidentifyPanelProps) {
  const [diagnosisText, setDiagnosisText] = useState<string | null>(null)
  const [diagnosisPending, setDiagnosisPending] = useState(false)
  const [diagnosisMismatch, setDiagnosisMismatch] = useState<string[]>([])
  const [responseText, setResponseText] = useState<string | null>(null)
  const [responsePending, setResponsePending] = useState(false)
  const [responseMismatch, setResponseMismatch] = useState<string[]>([])

  // 이중 클릭 방지는 이 컴포넌트가 아니라 부모(AssessmentDetailPage)의 책임이다 — 부모가
  // 분석 요청 중(extracting=true)에는 이 패널 자체를 화면에서 치우고 "분석 중..." 문구로
  // 바꾸므로, 버튼이 사라진 상태에서는 다시 누를 수 없다(요구사항 8·9절). 여기서 별도
  // submitting 상태를 두면 요청 실패 후 버튼이 영영 비활성 상태로 남는 문제가 생긴다.
  const canAnalyze = Boolean(diagnosisText) && !diagnosisPending && !responsePending

  function handleConfirm() {
    if (!canAnalyze || !diagnosisText) return
    onConfirm(diagnosisText, generateCaseRequestId(), responseText ?? undefined, [
      ...diagnosisMismatch,
      ...responseMismatch,
    ])
  }

  return (
    <div className="space-y-3">
      <PdfField
        fieldId="diagnosisResultFile"
        label="진단결과 PDF 선택"
        required
        studentName={studentName}
        studentGrade={studentGrade}
        onReadyChange={setDiagnosisText}
        onPendingChange={setDiagnosisPending}
        onMismatchChange={setDiagnosisMismatch}
      />
      <PdfField
        fieldId="diagnosisResponseFile"
        label="응답내역 PDF 선택"
        required={false}
        studentName={studentName}
        studentGrade={studentGrade}
        onReadyChange={setResponseText}
        onPendingChange={setResponsePending}
        onMismatchChange={setResponseMismatch}
      />

      <div className="flex gap-2">
        <button type="button" onClick={handleConfirm} disabled={!canAnalyze} className={primaryButtonClass}>
          두 자료 분석하기
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          취소
        </button>
      </div>
    </div>
  )
}
