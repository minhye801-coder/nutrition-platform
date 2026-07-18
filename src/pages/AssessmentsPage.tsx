import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass } from '@/components/common/buttonStyles'
import { fetchConsents, ConsentApiError } from '@/services/consentService'
import { AssessmentApiError, fetchAssessments, uploadAssessment } from '@/services/assessmentService'
import { ASSESSMENT_STATUS_CONFIRMED, EXTRACTION_STATUS_AI } from '@/types/assessment'
import type { AssessmentListItem } from '@/types/assessment'
import type { ConsentListItem } from '@/types/consent'
import type { SessionUser } from '@/types/session'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

/** 검사결과 PDF를 새로 올릴 수 있는 케이스 단계 — 승인 시 '진단 대기'가 되고, 업로드 후 '결과 확인'이 된다(추가 회차 업로드 허용). */
const UPLOADABLE_CASE_STATUSES = ['진단 대기', '결과 확인']

function statusBadge(status: string) {
  return status === ASSESSMENT_STATUS_CONFIRMED ? (
    <Badge tone="success">확인 완료</Badge>
  ) : (
    <Badge tone="warning">검토 대기</Badge>
  )
}

function describeError(error: unknown): string {
  if (error instanceof AssessmentApiError || error instanceof ConsentApiError) {
    switch (error.code) {
      case 'not_found':
        return '해당 케이스를 찾을 수 없습니다.'
      case 'invalid_file_type':
        return 'PDF 파일만 업로드할 수 있습니다.'
      case 'invalid_file_size':
        return '파일 크기를 확인해 주세요(최대 20MB).'
      case 'invalid_input':
        return '입력값을 확인해 주세요.'
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export function AssessmentsPage() {
  return <AuthGuard requireInstallation>{(user) => <AssessmentsContent user={user} />}</AuthGuard>
}

/** 체험 모드에서 "샘플로 체험하기"를 누르면 서비스 계층(demoAssessmentStore)이 실제로
 * 읽지 않는 빈 File을 형식상으로만 넘긴다 — 원본 PDF 업로드 자체를 차단하기 위함이다. */
const DEMO_SAMPLE_FILE = new File([], '샘플_진단결과.pdf', { type: 'application/pdf' })

function AssessmentsContent({ user }: { user: SessionUser }) {
  const isDemo = user.accountMode !== 'SCHOOL_WORKSPACE'
  const [items, setItems] = useState<AssessmentListItem[]>([])
  const [uploadTargets, setUploadTargets] = useState<ConsentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [caseId, setCaseId] = useState('')
  const [round, setRound] = useState('1차')
  const [timepoint, setTimepoint] = useState('사전')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [assessments, consents] = await Promise.all([fetchAssessments(), fetchConsents()])
      setItems(assessments)
      setUploadTargets(
        consents.filter((item) => UPLOADABLE_CASE_STATUSES.includes(item.caseStatus)),
      )
    } catch (error) {
      setLoadError(describeError(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const uploadFile = isDemo ? DEMO_SAMPLE_FILE : file
    if (uploading || !caseId || !uploadFile || !round.trim() || !timepoint) return

    setUploading(true)
    setUploadError('')
    try {
      await uploadAssessment(caseId, uploadFile, round.trim(), timepoint)
      setFile(null)
      setCaseId('')
      await load()
    } catch (error) {
      setUploadError(describeError(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">진단·검사</h1>
        <p className="mt-1 text-sm text-gray-500">검사결과 PDF를 업로드하고, AI 자동확인 또는 직접 입력으로 검토·확정합니다.</p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">검사결과 PDF 업로드</h2>
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={(event) => void handleUpload(event)}>
          <div className="sm:col-span-2">
            <label htmlFor="caseId" className="block text-xs font-medium text-gray-500">
              대상 케이스 *
            </label>
            <select id="caseId" value={caseId} onChange={(event) => setCaseId(event.target.value)} className={inputClass}>
              <option value="">선택하세요</option>
              {uploadTargets.map((item) => (
                <option key={item.consent.caseId} value={item.consent.caseId}>
                  {item.studentName || '이름 미상'} · {item.caseTopic || '주제 없음'} ({item.caseStatus})
                </option>
              ))}
            </select>
            {!loading && uploadTargets.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">보호자동의가 완료된 케이스가 없습니다.</p>
            )}
          </div>
          <div>
            <label htmlFor="round" className="block text-xs font-medium text-gray-500">
              검사차수 *
            </label>
            <input id="round" type="text" value={round} onChange={(event) => setRound(event.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="timepoint" className="block text-xs font-medium text-gray-500">
              평가시점 *
            </label>
            <select id="timepoint" value={timepoint} onChange={(event) => setTimepoint(event.target.value)} className={inputClass}>
              <option value="사전">사전</option>
              <option value="사후">사후</option>
            </select>
          </div>
          <div className="sm:col-span-4">
            <label htmlFor="file" className="block text-xs font-medium text-gray-500">
              검사결과 PDF *
            </label>
            {isDemo ? (
              <p className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                체험 모드에서는 원본 PDF를 업로드할 수 없습니다. "업로드" 버튼을 누르면
                준비된 샘플 검사결과로 진단·확인 흐름을 체험할 수 있습니다.
              </p>
            ) : (
              <input
                id="file"
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm"
              />
            )}
          </div>
          {uploadError && <p className="text-sm text-red-600 sm:col-span-4">{uploadError}</p>}
          <div className="sm:col-span-4">
            <button type="submit" disabled={uploading} className={primaryButtonClass}>
              {uploading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">업로드된 검사결과가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2">학생명</th>
                  <th className="py-2 pr-2">검사차수/시점</th>
                  <th className="py-2 pr-2">추출방식</th>
                  <th className="py-2 pr-2">상태</th>
                  <th className="py-2 pr-2">업로드일</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {items.map(({ assessment, studentName }) => (
                  <tr key={assessment.assessmentId} className="border-b border-gray-100">
                    <td className="py-2 pr-2 text-gray-900">{studentName || '-'}</td>
                    <td className="py-2 pr-2 text-gray-700">
                      {assessment.round} / {assessment.timepoint}
                    </td>
                    <td className="py-2 pr-2 text-gray-700">
                      {assessment.extractionStatus === EXTRACTION_STATUS_AI ? 'AI 추출' : '수동 입력'}
                    </td>
                    <td className="py-2 pr-2">{statusBadge(assessment.status)}</td>
                    <td className="py-2 pr-2 text-gray-500">{assessment.uploadedAt.slice(0, 10)}</td>
                    <td className="py-2 pr-2 text-right">
                      <Link
                        to={`/assessments/${assessment.assessmentId}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        검토
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
