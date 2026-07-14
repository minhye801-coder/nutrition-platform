import { useState, type FormEvent } from 'react'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import type { SessionUser } from '@/types/session'

const SETUP_STEPS = [
  '학교 작업공간 생성',
  '내 Google Drive에 루트 폴더 생성',
  '내 Google Drive에 데이터 Spreadsheet 생성',
  '기본 시트 탭 및 헤더 생성',
  'schoolPublicId 발급',
]

interface SetupResult {
  schoolName: string
  managerName: string
  samplePublicId: string
}

export function SetupPage() {
  return <AuthGuard>{(user) => <SetupContent user={user} />}</AuthGuard>
}

function SetupContent({ user }: { user: SessionUser }) {
  const [schoolName, setSchoolName] = useState('')
  const [managerName, setManagerName] = useState(user.name)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SetupResult | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!schoolName.trim() || !managerName.trim()) {
      setError('학교명과 담당자명을 모두 입력해 주세요.')
      return
    }
    setError('')
    setResult({
      schoolName: schoolName.trim(),
      managerName: managerName.trim(),
      samplePublicId: `SAMPLE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    })
  }

  function handleReset() {
    setResult(null)
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
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" className={`${primaryButtonClass} w-full`}>
              설치 시작
            </button>
          </form>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-brand-700">
                샘플 설치가 완료되었습니다
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {result.schoolName} · {result.managerName}
              </p>
            </div>

            <ul className="space-y-2">
              {SETUP_STEPS.map((step) => (
                <li
                  key={step}
                  className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    ✓
                  </span>
                  {step}
                </li>
              ))}
            </ul>

            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              샘플 schoolPublicId: <span className="font-mono">{result.samplePublicId}</span>
            </div>
          </Card>

          <PlaceholderNotice>
            실제 Google Sheets/Drive 생성과 schoolPublicId 발급은 아직 연결되지
            않았습니다. 지금 보이는 결과는 화면 흐름 확인용 샘플입니다.
          </PlaceholderNotice>

          <button type="button" onClick={handleReset} className={secondaryButtonClass}>
            다시 입력하기
          </button>
        </div>
      )}
    </div>
  )
}
