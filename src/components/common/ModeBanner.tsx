import type { ClientAccountMode } from '@/types/session'

const MODE_LABEL: Record<ClientAccountMode, string> = {
  SCHOOL_WORKSPACE: '학교 업무용 계정',
  PERSONAL_ACCOUNT_BLOCKED: '개인 계정(사용 불가)',
  WORKSPACE_CONFIRMATION_REQUIRED: '확인 대기',
  DEMO_GUEST: '체험 모드',
}

const MODE_BADGE_CLASS: Record<ClientAccountMode, string> = {
  SCHOOL_WORKSPACE: 'bg-brand-50 text-brand-700',
  PERSONAL_ACCOUNT_BLOCKED: 'bg-amber-50 text-amber-700',
  WORKSPACE_CONFIRMATION_REQUIRED: 'bg-amber-50 text-amber-700',
  DEMO_GUEST: 'bg-amber-50 text-amber-700',
}

interface ModeBannerProps {
  accountMode: ClientAccountMode
  /** DEMO_GUEST 전용 — "체험 종료" 버튼 동작. */
  onExitGuest?: () => void
  /** DEMO_GUEST 전용 — "학교 업무용 계정으로 로그인" 버튼 동작. */
  onLoginAsWorkspace?: () => void
}

/**
 * 항상 현재 계정 모드 배지를 보여주고, SCHOOL_WORKSPACE가 아니면 체험 모드 경고
 * 배너를 함께 보여준다. 버튼을 숨기는 것과 무관하게 서버 API가 실제 차단을
 * 담당하므로(functions/_lib/requireInstalledAccess.ts, functions/_lib/requireSession.ts),
 * 이 배너는 사용자에게 지금 모드를 명확히 알려주는 안내 역할만 한다.
 */
export function ModeBanner({ accountMode, onExitGuest, onLoginAsWorkspace }: ModeBannerProps) {
  const isGuest = accountMode === 'DEMO_GUEST'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 sm:px-6">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${MODE_BADGE_CLASS[accountMode]}`}
      >
        {MODE_LABEL[accountMode]}
      </span>
      {isGuest ? (
        <>
          <p className="text-xs font-medium text-amber-700">
            체험 모드 — 가상자료만 사용되며 작성한 내용은 저장되지 않습니다.
          </p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onExitGuest} className="text-xs font-semibold text-gray-500 hover:underline">
              체험 종료
            </button>
            <button
              type="button"
              onClick={onLoginAsWorkspace}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              학교 업무용 계정으로 로그인
            </button>
          </div>
        </>
      ) : (
        accountMode !== 'SCHOOL_WORKSPACE' && (
          <p className="text-xs font-medium text-amber-700">
            체험 모드 — 실제 학생정보를 입력하거나 업로드하지 마세요.
          </p>
        )
      )}
    </div>
  )
}
