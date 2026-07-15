import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { fetchSetupStatus, retrySetup, startSetup } from '@/services/setupService'
import type { SetupStatusResponse, SetupStep } from '@/types/setup'
import type { SessionUser } from '@/types/session'

type Phase = 'loading' | 'form' | 'running' | 'needs_consent' | 'failed' | 'completed'

interface CompletedInfo {
  schoolName: string
  managerName: string
  schoolPublicId: string
  spreadsheetUrl: string
  folderUrl: string
}

export function SetupPage() {
  return <AuthGuard>{(user) => <SetupContent user={user} />}</AuthGuard>
}

function StepList({ steps }: { steps: SetupStep[] }) {
  return (
    <ul className="space-y-2">
      {steps.map((step) => (
        <li
          key={step.key}
          className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
        >
          <span
            className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${
              step.status === 'done'
                ? 'bg-brand-600'
                : step.status === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-300'
            }`}
          >
            {step.status === 'done' ? '✓' : step.status === 'error' ? '!' : '·'}
          </span>
          <span className={step.status === 'pending' ? 'text-gray-400' : ''}>{step.label}</span>
        </li>
      ))}
    </ul>
  )
}

function SetupContent({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [schoolName, setSchoolName] = useState('')
  const [managerName, setManagerName] = useState(user.name)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [steps, setSteps] = useState<SetupStep[]>([])
  const [consentUrl, setConsentUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [completed, setCompleted] = useState<CompletedInfo | null>(null)

  function applyResult(result: SetupStatusResponse, autoRedirectConsent: boolean) {
    switch (result.status) {
      case 'already_installed':
        navigate('/app', { replace: true })
        return
      case 'completed':
        setSteps(result.steps)
        setCompleted({
          schoolName: result.schoolName,
          managerName: result.managerName,
          schoolPublicId: result.schoolPublicId,
          spreadsheetUrl: result.spreadsheetUrl,
          folderUrl: result.folderUrl,
        })
        setPhase('completed')
        return
      case 'needs_consent':
        setSteps(result.steps)
        setConsentUrl(result.consentUrl)
        setPhase('needs_consent')
        if (autoRedirectConsent) {
          window.location.href = result.consentUrl
        }
        return
      case 'failed':
        setSteps(result.steps)
        setErrorMessage(result.errorMessage)
        setPhase('failed')
        return
      case 'in_progress':
        setSteps(result.steps)
        setPhase('running')
        void continueInstall()
        return
      case 'not_started':
      default:
        setPhase('form')
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchSetupStatus()
      .then((result) => {
        if (!cancelled) applyResult(result, false)
      })
      .catch(() => {
        if (!cancelled) setPhase('form')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function continueInstall() {
    setPhase('running')
    setErrorMessage('')
    try {
      const result = await retrySetup()
      applyResult(result, true)
    } catch {
      setErrorMessage('설치 상태를 이어가는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      setPhase('failed')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!schoolName.trim() || !managerName.trim()) {
      setFormError('학교명과 담당자명을 모두 입력해 주세요.')
      return
    }
    setFormError('')
    setSubmitting(true)
    setPhase('running')
    try {
      const result = await startSetup({ schoolName: schoolName.trim(), managerName: managerName.trim() })
      applyResult(result, true)
    } catch {
      setErrorMessage('설치 시작 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      setPhase('failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'loading') {
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

      {phase === 'form' && (
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700">
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
              <label htmlFor="managerName" className="block text-sm font-medium text-gray-700">
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
                설정 화면과 관리자 화면에는 여기 입력한 담당자명이 표시됩니다.
              </p>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
              {submitting ? '확인 중...' : '설치 시작'}
            </button>
          </form>
        </Card>
      )}

      {phase === 'running' && (
        <Card className="space-y-4">
          <p className="text-sm text-gray-600">
            내 Google Drive에 학교 작업공간을 만들고 있습니다. 잠시만 기다려 주세요...
          </p>
          {steps.length > 0 && <StepList steps={steps} />}
        </Card>
      )}

      {phase === 'needs_consent' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <p className="text-sm text-gray-700">
              내 Google Drive에 폴더와 Spreadsheet를 만들려면 Drive 접근 권한이
              필요합니다. 아래 버튼을 눌러 Google 동의 화면에서 권한을 허용해 주세요.
            </p>
            <StepList steps={steps} />
            <button
              type="button"
              onClick={() => {
                window.location.href = consentUrl
              }}
              className={`${primaryButtonClass} w-full`}
            >
              Google 권한 허용하기
            </button>
          </Card>
        </div>
      )}

      {phase === 'failed' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <StepList steps={steps} />
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button type="button" onClick={() => void continueInstall()} className={`${primaryButtonClass} w-full`}>
              다시 시도
            </button>
          </Card>
        </div>
      )}

      {phase === 'completed' && completed && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-brand-700">설치가 완료되었습니다</p>
              <p className="mt-1 text-sm text-gray-600">
                {completed.schoolName} · {completed.managerName}
              </p>
            </div>

            <StepList steps={steps} />

            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              schoolPublicId: <span className="font-mono">{completed.schoolPublicId}</span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={completed.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className={`${secondaryButtonClass} text-center`}
              >
                Spreadsheet 열기
              </a>
              <a
                href={completed.folderUrl}
                target="_blank"
                rel="noreferrer"
                className={`${secondaryButtonClass} text-center`}
              >
                Drive 폴더 열기
              </a>
            </div>
          </Card>

          <button type="button" onClick={() => navigate('/app')} className={`${primaryButtonClass} w-full`}>
            관리자 화면으로 이동
          </button>
        </div>
      )}
    </div>
  )
}
