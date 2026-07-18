import { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import {
  fetchMigrationPreview,
  fetchMigrationStatus,
  runMigration,
  type MigrationPreview,
  type MigrationReport,
} from '@/services/migrationService'

/**
 * 요구사항 12절 — 기존 단일 Spreadsheet(학생정보/상담접수가 상담데이터와 섞여 있던
 * 구조)를 학생식별정보/상담데이터 두 Spreadsheet로 분리하는 마이그레이션. 미리보기
 * →(사용자 확인)→ 실행 순서를 강제한다. 이미 분리된 설치에서는 이 카드 자체를
 * 숨긴다(SettingsPage에서 조건부 렌더링).
 */
export function MigrationCard() {
  const [preview, setPreview] = useState<MigrationPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [previewError, setPreviewError] = useState('')
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<MigrationReport | null>(null)
  const [runError, setRunError] = useState('')

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
      const status = await fetchMigrationStatus()
      setReport(status)
      window.location.reload()
    } catch {
      setRunError('마이그레이션 중 문제가 발생했습니다. 기존 데이터는 변경되지 않았습니다.')
    } finally {
      setRunning(false)
    }
  }

  if (preview?.alreadyMigrated) return null

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold text-gray-900">기존 데이터 마이그레이션</h2>
      <p className="text-sm text-gray-600">
        예전 방식(학생정보·상담접수가 상담데이터와 한 Spreadsheet에 있던 구조)으로
        설치된 계정입니다. 아래 마이그레이션을 실행하면 학생식별정보를 별도
        Spreadsheet로 분리합니다 — 실행 전 기존 Spreadsheet는 자동으로 백업되고,
        실패해도 원본은 그대로 남습니다.
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
        <div className="space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
          <p>마지막 실행: {new Date(report.createdAt).toLocaleString('ko-KR')}</p>
          <p>결과: {report.status === 'completed' ? '완료' : '실패'}</p>
          {report.status === 'completed' && (
            <p>
              이전된 학생 {report.studentsMigrated}명 · 상담접수 {report.intakesMigrated}건 · 중복 가능성{' '}
              {report.duplicateCandidates}명
            </p>
          )}
        </div>
      )}

      <a href="/settings" className={secondaryButtonClass}>
        새로고침
      </a>
    </Card>
  )
}
