import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { useSession } from '@/hooks/useSession'
import { useInstallation } from '@/hooks/useInstallation'
import { confirmSchoolUse } from '@/services/accountService'
import { logout, GOOGLE_CHOOSE_ACCOUNT_URL } from '@/services/authService'
import { acknowledgeDemoMode } from '@/lib/demoAck'

const SCHOOL_CHECKLIST = [
  '학교 또는 교육청에서 발급한 업무용 Google Workspace 계정입니다.',
  '학교의 개인정보 보호 지침과 승인된 저장 환경을 확인했습니다.',
  '학생정보는 상담 업무에 필요한 최소 범위에서 처리하겠습니다.',
  'AI 분석에는 학생 이름 등 직접 식별정보가 전송되지 않음을 확인했습니다.',
]

/**
 * 최초 로그인 시(그리고 아직 확인하지 않은 매 로그인마다) 계정 성격에 맞는 안내를
 * 보여주는 화면. requireInstalledAccess 계열 서버 게이트가 이미 실제 권한을
 * 판정하므로, 이 화면 자체는 UX 안내와 "동의했다"는 사실 기록(SCHOOL_WORKSPACE는
 * 서버에, 데모는 세션 스토리지에)만 담당한다.
 */
export function AccountConfirmPage() {
  const navigate = useNavigate()
  const { status, user } = useSession()
  const { installation, loading: installationLoading } = useInstallation()

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login', { replace: true })
    }
  }, [status, navigate])

  if (status !== 'authenticated' || !user) {
    return <div className="py-16 text-center text-sm text-gray-500">확인하는 중입니다...</div>
  }

  if (user.accountMode === 'SCHOOL_WORKSPACE' && !user.schoolUseConfirmed) {
    return <SchoolConfirmScreen installationLoading={installationLoading} hasInstallation={Boolean(installation)} />
  }

  if (user.accountMode === 'SCHOOL_WORKSPACE') {
    // 이미 확인을 마쳤는데 직접 URL로 들어온 경우 — 정상 목적지로 되돌린다.
    navigate(installation ? '/app' : '/setup', { replace: true })
    return null
  }

  return <DemoIntroScreen pending={user.accountMode === 'WORKSPACE_PENDING'} hostedDomain={user.hostedDomain} />
}

function SchoolConfirmScreen({
  installationLoading,
  hasInstallation,
}: {
  installationLoading: boolean
  hasInstallation: boolean
}) {
  const navigate = useNavigate()
  const [checked, setChecked] = useState<boolean[]>(SCHOOL_CHECKLIST.map(() => false))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const allChecked = checked.every(Boolean)

  async function handleActivate() {
    setSubmitting(true)
    setError('')
    const ok = await confirmSchoolUse()
    if (!ok) {
      setError('활성화 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      setSubmitting(false)
      return
    }
    navigate(hasInstallation ? '/app' : '/setup', { replace: true })
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">학교 업무용 계정 확인</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            이 계정은 학교 또는 교육청에서 발급한 업무용 Google Workspace 계정으로
            확인되었습니다. 학생 개인정보는 학교의 개인정보 보호 지침과 승인된 업무
            환경에 따라 처리해야 합니다.
          </p>
        </div>

        <ul className="space-y-2">
          {SCHOOL_CHECKLIST.map((item, index) => (
            <li key={item}>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked[index]}
                  onChange={(event) =>
                    setChecked((prev) => prev.map((value, i) => (i === index ? event.target.checked : value)))
                  }
                />
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleActivate()}
            disabled={!allChecked || submitting || installationLoading}
            className={`${primaryButtonClass} flex-1`}
          >
            {submitting ? '활성화하는 중...' : '학교용 기능 활성화'}
          </button>
          <button type="button" onClick={() => void handleLogout()} className={secondaryButtonClass}>
            로그아웃
          </button>
        </div>
      </Card>
    </div>
  )
}

function DemoIntroScreen({ pending, hostedDomain }: { pending: boolean; hostedDomain: string | null }) {
  const navigate = useNavigate()

  function handleContinue() {
    acknowledgeDemoMode()
    navigate('/app', { replace: true })
  }

  async function handleChooseAnotherAccount() {
    await logout()
    window.location.href = GOOGLE_CHOOSE_ACCOUNT_URL
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">개인 Google 계정 체험 모드</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            개인 Google 계정에서는 체험 모드만 사용할 수 있습니다. 체험 모드에서는
            실제 학생의 이름, 건강정보, 상담기록, 검사 PDF 및 보호자 동의서를 입력하거나
            저장할 수 없습니다. 반드시 가상 학생 자료만 사용해 주세요.
          </p>
          {pending && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              이 계정은 {hostedDomain} 조직의 Google Workspace 계정이지만, 아직 학교
              업무용 도메인으로 승인되지 않았습니다. 담당자에게 도메인 승인을 요청하거나,
              승인 전까지는 체험 모드로 화면과 흐름을 확인할 수 있습니다.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={handleContinue} className={`${primaryButtonClass} flex-1`}>
            체험 모드로 계속
          </button>
          <button type="button" onClick={() => void handleChooseAnotherAccount()} className={secondaryButtonClass}>
            다른 계정으로 로그인
          </button>
        </div>
      </Card>
    </div>
  )
}
