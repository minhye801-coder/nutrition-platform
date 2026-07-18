import { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import {
  fetchMigrationPreview,
  fetchMigrationStatus,
  runMigration,
  type MigrationPreview,
  type MigrationReport,
  type UnresolvedRecord,
} from '@/services/migrationService'

const REASON_LABEL: Record<UnresolvedRecord['reason'], string> = {
  empty_student_id: 'StudentID 없음',
  invalid_format: 'StudentID 형식 오류',
  not_found_in_identity_sheet: '학생정보에서 StudentID를 찾을 수 없음',
  name_based_reference_not_migrated: '승인되었지만 아직 StudentID로 연결되지 않음(예전 이름 기반 참조)',
}

function formatGradeClassNumber(item: UnresolvedRecord): string {
  const parts: string[] = []
  if (item.grade) parts.push(`${item.grade}학년`)
  if (item.studentClass) parts.push(`${item.studentClass}반`)
  if (item.studentNumber) parts.push(`${item.studentNumber}번`)
  return parts.join(' ') || '-'
}

/**
 * 요구사항 12절 — 기존 단일 Spreadsheet(학생정보/상담접수가 상담데이터와 섞여 있던
 * 구조)를 학생식별정보/상담데이터 두 Spreadsheet로 분리하는 마이그레이션. 미리보기
 * →(사용자 확인)→ 실행 순서를 강제한다. 이미 분리된 설치에서는 이 카드 자체를
 * 숨긴다(SettingsPage에서 조건부 렌더링). 연결되지 않은 상담기록이 1건이라도 있으면
 * "완료"로 표시하지 않고 NEEDS_REVIEW로 안내한다 — 마이그레이션 자체는 되돌리지 않고
 * (백업이 있으니 언제든 복구 가능), 검토가 필요하다는 것만 알린다.
 */
export function MigrationCard() {
  const [preview, setPreview] = useState<MigrationPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [previewError, setPreviewError] = useState('')
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<MigrationReport | null>(null)
  const [runError, setRunError] = useState('')
  const [unresolvedRecords, setUnresolvedRecords] = useState<UnresolvedRecord[]>([])

  useEffect(() => {
    fetchMigrationPreview()
      .then(setPreview)
      .catch(() => setPreviewError('미리보기를 불러오지 못했습니다.'))
      .finally(() => setLoadingPreview(false))
    fetchMigrationStatus()
      .then(setReport)
      .catch(() => {})
  }, [])

  async function handleRun() {
    if (running) return
    setRunning(true)
    setRunError('')
    try {
      const result = await runMigration()
      if (!result.ok) {
        setRunError('마이그레이션에 실패했습니다. 기존 데이터는 변경되지 않았습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      setUnresolvedRecords(result.unresolvedRecords ?? [])
      const status = await fetchMigrationStatus()
      setReport(status)
    } catch {
      setRunError('마이그레이션 중 문제가 발생했습니다. 기존 데이터는 변경되지 않았습니다.')
    } finally {
      setRunning(false)
    }
  }

  if (preview?.alreadyMigrated) return null

  const needsReview = report?.status === 'needs_review'

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold text-gray-900">기존 데이터 마이그레이션</h2>
      <p className="text-sm text-gray-600">
        예전 방식(학생정보·상담접수가 상담데이터와 한 Spreadsheet에 있던 구조)으로
        설치된 계정입니다. 아래 마이그레이션을 실행하면 학생식별정보를 별도
        Spreadsheet로 분리합니다 — 실행 전 기존 Spreadsheet는 자동으로 백업되고,
        실패해도 원본은 그대로 남습니다. 기존 데이터는 마이그레이션 과정에서 삭제되지
        않습니다.
      </p>

      {loadingPreview ? (
        <p className="text-sm text-gray-500">대상 확인 중...</p>
      ) : previewError ? (
        <p className="text-sm text-red-600">{previewError}</p>
      ) : preview ? (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500">대상 학생 수</dt>
            <dd className="font-medium text-gray-900">{preview.studentCount}명</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">대상 상담접수 수</dt>
            <dd className="font-medium text-gray-900">{preview.intakeCount}건</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">중복 가능성 있는 학생</dt>
            <dd className="font-medium text-gray-900">{preview.duplicateCandidateCount}명</dd>
          </div>
        </dl>
      ) : null}

      {runError && <p className="text-sm text-red-600">{runError}</p>}

      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={running || loadingPreview || !preview || preview.studentCount === 0}
        className={primaryButtonClass}
      >
        {running ? '마이그레이션 실행 중...' : '마이그레이션 실행'}
      </button>

      {report && (
        <div className="space-y-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <p>마지막 실행: {new Date(report.createdAt).toLocaleString('ko-KR')}</p>
            <Badge tone={report.status === 'completed' ? 'success' : needsReview ? 'warning' : 'danger'}>
              {report.status === 'completed' ? '완료' : needsReview ? '검토 필요' : '실패'}
            </Badge>
          </div>
          {report.status !== 'failed' && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
              <div>
                <dt className="text-gray-400">전체 학생 수</dt>
                <dd className="font-medium text-gray-800">{report.totalStudents}명</dd>
              </div>
              <div>
                <dt className="text-gray-400">전체 상담기록 수</dt>
                <dd className="font-medium text-gray-800">{report.totalRecords}건</dd>
              </div>
              <div>
                <dt className="text-gray-400">정상 연결된 상담기록 수</dt>
                <dd className="font-medium text-gray-800">{report.linkedRecords}건</dd>
              </div>
              <div>
                <dt className="text-gray-400">연결되지 않은 상담기록 수</dt>
                <dd className={`font-medium ${report.unresolvedReferences > 0 ? 'text-amber-700' : 'text-gray-800'}`}>
                  {report.unresolvedReferences}건
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">중복 식별자 수</dt>
                <dd className="font-medium text-gray-800">{report.duplicateIdentifierCount}건</dd>
              </div>
              <div>
                <dt className="text-gray-400">동명이인 검토 대상 수</dt>
                <dd className="font-medium text-gray-800">{report.samenameReviewCount}건</dd>
              </div>
              <div>
                <dt className="text-gray-400">변환 실패 수</dt>
                <dd className="font-medium text-gray-800">{report.conversionFailureCount}건</dd>
              </div>
              <div>
                <dt className="text-gray-400">백업 파일 생성 여부</dt>
                <dd className="font-medium text-gray-800">{report.backupSpreadsheetId ? '생성됨' : '없음'}</dd>
              </div>
              <div>
                <dt className="text-gray-400">복구 가능 여부</dt>
                <dd className="font-medium text-gray-800">{report.recoverable ? '가능' : '불가'}</dd>
              </div>
            </dl>
          )}
          {needsReview && (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-800">
              연결되지 않은 상담기록이 있어 마이그레이션이 "검토 필요" 상태입니다. 기존 데이터는 삭제되지
              않았습니다 — 아래 목록을 확인해 학생정보를 직접 보정한 뒤 다시 확인해 주세요.
            </p>
          )}
        </div>
      )}

      {unresolvedRecords.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-700">연결되지 않은 상담기록 상세({unresolvedRecords.length}건)</p>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-1 pr-2">출처</th>
                  <th className="py-1 pr-2">행 번호</th>
                  <th className="py-1 pr-2">학년·반·번호</th>
                  <th className="py-1 pr-2">이름(일부)</th>
                  <th className="py-1 pr-2">기존 식별값(일부)</th>
                  <th className="py-1 pr-2">사유</th>
                </tr>
              </thead>
              <tbody>
                {unresolvedRecords.map((item, index) => (
                  <tr key={`${item.source}-${item.rowNumber}-${index}`} className="border-b border-gray-100">
                    <td className="py-1 pr-2">{item.source}</td>
                    <td className="py-1 pr-2">{item.rowNumber}</td>
                    <td className="py-1 pr-2">{formatGradeClassNumber(item)}</td>
                    <td className="py-1 pr-2">{item.namePartialMasked || '-'}</td>
                    <td className="py-1 pr-2 font-mono">{item.studentIdMasked || '-'}</td>
                    <td className="py-1 pr-2">{REASON_LABEL[item.reason]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <a href="/settings" className={secondaryButtonClass}>
        새로고침
      </a>
    </Card>
  )
}
