import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { fetchSetupStatus, retrySetup, startSetup } from '@/services/setupService'
import type { SetupStatusResponse, SetupStep } from '@/types/setup'
import type { SessionUser } from '@/types/session'

type Phase = 'loading' | 'form' | 'running' | 'redirecting' | 'needs_consent' | 'failed' | 'completed'

/** Google 재동의 화면으로 실제 이동하기 전, 사용자가 안내 문구를 읽을 시간을 준다. */
const REDIRECT_DELAY_MS = 1400

/** 설치가 진행되는 동안 GET /api/setup/status를 이 주기로 폴링해 단계 상태를 실시간에 가깝게 보여준다. */
const POLL_INTERVAL_MS = 1200

interface CompletedInfo {
  schoolName: string
  managerName: string
  schoolPublicId: string
  spreadsheetUrl: string
  folderUrl: string
}

interface SavedInfo {
  schoolName: string
  managerName: string
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
          className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
            step.status === 'active'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          <span
            className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${
              step.status === 'done'
                ? 'bg-green-500'
                : step.status === 'active'
                  ? 'animate-pulse bg-amber-500'
                  : step.status === 'error'
                    ? 'bg-red-500'
                    : 'bg-gray-300'
            }`}
          >
            {step.status === 'done' ? '✓' : step.status === 'error' ? '!' : step.status === 'active' ? '…' : '·'}
          </span>
          <span className={step.status === 'pending' ? 'text-gray-400' : 'font-medium'}>
            {step.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ProgressBar({ steps }: { steps: SetupStep[] }) {
  if (steps.length === 0) return null
  const doneCount = steps.filter((step) => step.status === 'done').length
  const percent = Math.round((doneCount / steps.length) * 100)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>설치 진행률</span>
        <span>
          {doneCount}/{steps.length}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

/** 학교명/담당자명이 서버(installation_progress)에 이미 저장되어 있음을 보여줘,
 * Google 동의 화면을 거쳐 돌아와도 입력값이 사라지지 않았다는 것을 알려준다. */
function SavedInfoNotice({ info }: { info: SavedInfo }) {
  return (
    <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
      입력하신 학교명·담당자명은 그대로 저장되어 있습니다 — {info.schoolName} · {info.managerName}
    </p>
  )
}

function DriveConsentNotice() {
  return (
    <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-blue-800">
      <p className="font-medium">설치 시작을 누르면 Google 화면이 한 번 더 열립니다.</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        <li>방금 완료한 로그인과는 별개로, Drive 접근을 위한 추가 권한 승인 화면입니다(재로그인이 아닙니다).</li>
        <li>이 앱이 만든 파일만 관리할 수 있는 최소 권한(drive.file)만 요청합니다.</li>
        <li>선생님의 기존 Google Drive 파일·폴더는 열람하지 않습니다.</li>
      </ul>
    </div>
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
  const [consentDenied, setConsentDenied] = useState(false)
  const [savedInfo, setSavedInfo] = useState<SavedInfo | null>(null)

  /** Google 동의 화면으로 즉시 이동하지 않고, 안내 문구를 잠깐 보여준 뒤 이동한다. */
  function goToConsent(url: string) {
    setConsentUrl(url)
    setConsentDenied(false)
    setPhase('redirecting')
    window.setTimeout(() => {
      window.location.href = url
    }, REDIRECT_DELAY_MS)
  }

  function applyResult(result: SetupStatusResponse, autoRedirectConsent: boolean) {
    if ('schoolName' in result && 'managerName' in result) {
      setSavedInfo({ schoolName: result.schoolName, managerName: result.managerName })
    }

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
        if (autoRedirectConsent) {
          goToConsent(result.consentUrl)
        } else {
          setConsentUrl(result.consentUrl)
          setPhase('needs_consent')
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
    // Google 동의 화면에서 거부하고 돌아오면 콜백이 /setup?consent=access_denied로
    // 리다이렉트한다. 이 신호를 한 번만 소비하고 주소창에서는 지운다.
    const consentParam = new URLSearchParams(window.location.search).get('consent')
    if (consentParam) {
      setConsentDenied(true)
      window.history.replaceState(null, '', '/setup')
    }

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

  // 설치가 실제로 진행되는 동안(POST가 응답을 기다리는 동안), 서버가 이미 D1에
  // 단계별로 기록해 둔 진행 상태를 짧은 주기로 폴링해 화면에 반영한다. 최종
  // 결과는 여전히 POST 응답(applyResult)이 확정한다 — 이 폴링은 그 사이의
  // "지금 몇 번째 단계인지"만 보여주는 보조 표시다.
  useEffect(() => {
    if (phase !== 'running') return
    let cancelled = false
    const interval = window.setInterval(() => {
      fetchSetupStatus()
        .then((result) => {
          if (!cancelled && 'steps' in result) setSteps(result.steps)
        })
        .catch(() => {
          // 폴링 실패는 무시한다 — 최종 결과는 원래의 POST 요청이 책임진다.
        })
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [phase])

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
    setSavedInfo({ schoolName: schoolName.trim(), managerName: managerName.trim() })
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

            <DriveConsentNotice />

            <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
              {submitting ? '확인 중...' : 'Google Drive 연결하고 설치하기'}
            </button>
          </form>
        </Card>
      )}

      {phase === 'running' && (
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900">학교 작업공간을 만들고 있습니다</p>
            <p className="mt-1 text-sm text-gray-600">
              내 Google Drive에 폴더와 Spreadsheet를 생성하는 중입니다. 잠시만 기다려 주세요...
            </p>
          </div>
          <ProgressBar steps={steps} />
          {steps.length > 0 && <StepList steps={steps} />}
        </Card>
      )}

      {phase === 'redirecting' && (
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Google Drive 연결 화면으로 이동합니다</p>
            <p className="mt-1 text-sm text-gray-600">권한 승인 후 자동으로 설치가 계속됩니다.</p>
          </div>
          {savedInfo && <SavedInfoNotice info={savedInfo} />}
        </Card>
      )}

      {phase === 'needs_consent' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            {consentDenied ? (
              <p className="text-sm text-red-600">
                Google 권한 요청이 거부되었거나 완료되지 않았습니다. 내 Google Drive에
                폴더와 Spreadsheet를 만들려면 Drive 접근 권한 승인이 반드시 필요합니다.
                아래 버튼으로 다시 승인해 주세요.
              </p>
            ) : (
              <p className="text-sm text-gray-700">
                내 Google Drive에 폴더와 Spreadsheet를 만들려면 Drive 접근 권한이
                필요합니다. 아래 버튼을 눌러 Google 동의 화면에서 권한을 허용해 주세요.
              </p>
            )}
            {savedInfo && <SavedInfoNotice info={savedInfo} />}
            <ProgressBar steps={steps} />
            <StepList steps={steps} />
            <button
              type="button"
              onClick={() => goToConsent(consentUrl)}
              className={`${primaryButtonClass} w-full`}
            >
              {consentDenied ? 'Drive 권한 다시 승인하기' : 'Google 권한 허용하기'}
            </button>
          </Card>
        </div>
      )}

      {phase === 'failed' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            {savedInfo && <SavedInfoNotice info={savedInfo} />}
            <ProgressBar steps={steps} />
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
              <p className="text-sm font-semibold text-green-700">✓ 설치가 완료되었습니다</p>
              <p className="mt-1 text-sm text-gray-600">학교 작업공간이 정상적으로 만들어졌습니다.</p>
            </div>

            <ProgressBar steps={steps} />
            <StepList steps={steps} />

            <dl className="space-y-2 rounded-md bg-gray-50 px-3 py-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">학교명</dt>
                <dd className="font-medium text-gray-900">{completed.schoolName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">담당자명</dt>
                <dd className="font-medium text-gray-900">{completed.managerName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">schoolPublicId</dt>
                <dd className="font-mono text-xs text-gray-500">{completed.schoolPublicId}</dd>
              </div>
            </dl>

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
            관리자로 이동
          </button>
        </div>
      )}
    </div>
  )
}
