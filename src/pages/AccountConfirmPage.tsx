import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { useSession } from '@/hooks/useSession'
import { useInstallation } from '@/hooks/useInstallation'
import { confirmSchoolUse } from '@/services/accountService'
import { logout, GOOGLE_CHOOSE_ACCOUNT_URL } from '@/services/authService'
import { startGuestSession } from '@/lib/demoAck'

/** 요구사항 4절 — 필수 확인 항목 7개, 순서와 문구 그대로. */
const WORKSPACE_CHECKLIST = [
  '이 계정은 학교, 교육청 또는 교육기관에서 발급받은 업무용 Google Workspace 계정입니다.',
  '소속 기관에서 학생 개인정보 및 상담자료를 처리할 업무 권한이 있습니다.',
  'Google Drive와 Google Sheets 사용이 소속 기관의 개인정보 보호 지침에서 허용되는지 확인했습니다.',
  '실제 학생정보는 업무 목적에 필요한 최소 범위에서만 입력하겠습니다.',
  '진단검사 원본 PDF는 학교 업무용 PC에 보관하고, AI 분석 전 학생 이름 등 직접 식별정보가 제거되었는지 확인하겠습니다.',
  '보호자동의서와 학생 상담자료는 소속 기관의 보관 및 파기 기준에 따라 관리하겠습니다.',
  '개인 Gmail이나 개인 저장공간으로 학생자료를 이전하거나 공유하지 않겠습니다.',
]

/** 모든 필수 항목을 체크해야 활성화 버튼이 눌린다(요구사항 9절 테스트 6) — 순수 함수라 유닛 테스트로 직접 검증한다. */
export function isChecklistComplete(checked: boolean[]): boolean {
  return checked.length > 0 && checked.every(Boolean)
}

/**
 * 최초 로그인 시(그리고 confirmationVersion이 바뀐 뒤 아직 재확인하지 않은 매
 * 로그인마다) 계정 성격에 맞는 안내를 보여주는 화면. requireInstalledAccess 계열
 * 서버 게이트가 이미 실제 권한을 판정하므로, 이 화면 자체는 UX 안내와 "확인했다"는
 * 사실 기록(SCHOOL_WORKSPACE는 서버에)만 담당한다. 개인 계정(PERSONAL_ACCOUNT_BLOCKED)은
 * 확인할 항목이 없으므로 즉시 차단 안내만 보여준다.
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

  if (user.accountMode === 'SCHOOL_WORKSPACE' || user.accountMode === 'DEMO_GUEST') {
    // 이미 확인을 마쳤거나(SCHOOL_WORKSPACE) 애초에 확인이 필요 없는(DEMO_GUEST)
    // 사용자가 직접 URL로 들어온 경우 — 정상 목적지로 되돌린다.
    navigate(user.accountMode === 'SCHOOL_WORKSPACE' ? (installation ? '/app' : '/setup') : '/app', { replace: true })
    return null
  }

  if (user.accountMode === 'PERSONAL_ACCOUNT_BLOCKED') {
    return <PersonalAccountBlockedScreen />
  }

  return <WorkspaceConfirmScreen installationLoading={installationLoading} hasInstallation={Boolean(installation)} email={user.email} hostedDomain={user.hostedDomain} />
}

/** 요구사항 3절 — 개인 Gmail 계정 처리. */
function PersonalAccountBlockedScreen() {
  const navigate = useNavigate()

  function handleStartGuest() {
    startGuestSession()
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
          <h1 className="text-xl font-bold text-gray-900">개인 Google 계정은 사용할 수 없습니다</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            이 앱의 학교 업무용 기능은 학교, 교육청 또는 교육기관에서 발급한 Google
            Workspace 업무용 계정으로만 사용할 수 있습니다.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            개인 Gmail 계정에는 학생 이름, 건강정보, 상담기록, 검사 PDF 및 보호자
            동의서를 입력하거나 저장하지 마세요.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            서비스 기능을 살펴보려면 로그인 없이 체험 모드를 이용해 주세요.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={handleStartGuest} className={`${primaryButtonClass} flex-1`}>
            로그인 없이 체험하기
          </button>
          <button type="button" onClick={() => void handleChooseAnotherAccount()} className={secondaryButtonClass}>
            다른 계정으로 로그인
          </button>
        </div>
      </Card>
    </div>
  )
}

/** 요구사항 4절 — Workspace 최초 확인 화면. */
function WorkspaceConfirmScreen({
  installationLoading,
  hasInstallation,
  email,
  hostedDomain,
}: {
  installationLoading: boolean
  hasInstallation: boolean
  email: string
  hostedDomain: string | null
}) {
  const navigate = useNavigate()
  const [checked, setChecked] = useState<boolean[]>(WORKSPACE_CHECKLIST.map(() => false))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const allChecked = isChecklistComplete(checked)

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
          <h1 className="text-xl font-bold text-gray-900">학교 업무용 계정 사용 확인</h1>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">로그인 이메일</dt>
              <dd className="text-gray-800">{email}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">확인된 Google Workspace 도메인</dt>
              <dd className="text-gray-800">{hostedDomain}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">
            이 앱은 학생 영양상담 및 건강 관련 정보를 처리할 수 있으므로, 학교 또는
            교육청에서 발급한 업무용 Google Workspace 계정으로만 사용해야 합니다.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            개인 계정, 개인이 임의로 개설한 Workspace 계정, 기관에서 승인하지 않은
            계정에는 실제 학생정보를 입력하거나 저장하면 안 됩니다.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            학생 개인정보 처리와 Google Drive·Sheets 저장은 소속 학교 또는 교육청의
            개인정보 보호 지침, 내부 승인 절차 및 업무 권한에 따라 사용해야 합니다.
          </p>
        </div>

        <ul className="space-y-2">
          {WORKSPACE_CHECKLIST.map((item, index) => (
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

        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          위 확인은 서비스 이용을 위한 필수 절차입니다. 확인 여부와 관계없이 개인정보
          보호 관련 법령 및 소속 기관의 규정을 준수해야 합니다.
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleActivate()}
            disabled={!allChecked || submitting || installationLoading}
            className={`${primaryButtonClass} flex-1`}
          >
            {submitting ? '활성화하는 중...' : '확인하고 학교용 기능 사용'}
          </button>
          <button type="button" onClick={() => void handleLogout()} className={secondaryButtonClass}>
            로그아웃
          </button>
        </div>
      </Card>
    </div>
  )
}
