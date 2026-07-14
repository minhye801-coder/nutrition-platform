import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { useInstallation } from '@/hooks/useInstallation'
import { createInstallation } from '@/services/installationService'
import type { Installation } from '@/types/installation'
import type { SessionUser } from '@/types/session'

const SETUP_STEPS = [
  { label: '학교명·담당자명 저장 및 schoolPublicId 발급', done: true },
  { label: '내 Google Drive에 루트 폴더 생성', done: false },
  { label: '내 Google Drive에 데이터 Spreadsheet 생성', done: false },
  { label: '기본 시트 탭 및 헤더 생성', done: false },
]

export function SetupPage() {
  return <AuthGuard>{(user) => <SetupContent user={user} />}</AuthGuard>
}

function SetupContent({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const { installation: existingInstallation, loading: checkingInstallation } = useInstallation()
  const [schoolName, setSchoolName] = useState('')
  const [managerName, setManagerName] = useState(user.name)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Installation | null>(null)

  useEffect(() => {
    if (!checkingInstallation && existingInstallation) {
      navigate('/app', { replace: true })
    }
  }, [checkingInstallation, existingInstallation, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!schoolName.trim() || !managerName.trim()) {
      setError('학교명과 담당자명을 모두 입력해 주세요.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const installation = await createInstallation({
        schoolName: schoolName.trim(),
        managerName: managerName.trim(),
      })
      setResult(installation)
    } catch {
      setError('설치 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingInstallation) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        설치 상태를 확인하는 중입니다...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">최초 설치</h1>
        <p className="mt-1 text-sm text-gray-600">
          처음 로그인한 선생님이 자신의 학교 작업공간을 만드는 단계입니다.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          로그인 계정: {user.name} ({user.email})
        </p>
      </div>

      {!result && (
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="schoolName"
                className="block text-sm font-medium text-gray-700"
              >
                학교명
              </label>
              <input
                id="schoolName"
                type="text"
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                placeholder="예: 구미봉곡초등학교"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="managerName"
                className="block text-sm font-medium text-gray-700"
              >
                담당자명
              </label>
              <input
                id="managerName"
                type="text"
                value={managerName}
                onChange={(event) => setManagerName(event.target.value)}
                placeholder="예: 김영양 선생님"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                설정 화면과 관리자 화면에는 여기 입력한 담당자명이 표시됩니다. 비워두면
                Google 계정 이름({user.name})이 대신 표시됩니다.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className={`${primaryButtonClass} w-full`}
            >
              {submitting ? '저장 중...' : '설치 시작'}
            </button>
          </form>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-brand-700">
                설치 정보가 저장되었습니다
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {result.schoolName} · {result.managerName}
              </p>
            </div>

            <ul className="space-y-2">
              {SETUP_STEPS.map((step) => (
                <li
                  key={step.label}
                  className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  <span
                    className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${
                      step.done ? 'bg-brand-600' : 'bg-gray-300'
                    }`}
                  >
                    {step.done ? '✓' : '·'}
                  </span>
                  <span className={step.done ? '' : 'text-gray-400'}>
                    {step.label}
                    {!step.done && ' (예정)'}
                  </span>
                </li>
              ))}
            </ul>

            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              schoolPublicId: <span className="font-mono">{result.schoolPublicId}</span>
            </div>
          </Card>

          <PlaceholderNotice>
            학교명·담당자명·schoolPublicId는 실제로 저장되었습니다. 다만 Google
            Sheets/Drive 생성은 아직 연결되지 않아 위 목록의 나머지 단계는 화면
            흐름 확인용입니다.
          </PlaceholderNotice>

          <button
            type="button"
            onClick={() => navigate('/app')}
            className={secondaryButtonClass}
          >
            계속하기
          </button>
        </div>
      )}
    </div>
  )
}
