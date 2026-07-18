import type { AccountMode } from '@/types/session'

const MODE_LABEL: Record<AccountMode, string> = {
  SCHOOL_WORKSPACE: '학교 업무용 계정',
  PERSONAL_DEMO: '체험 모드',
  WORKSPACE_PENDING: 'Workspace 승인 대기',
}

const MODE_BADGE_CLASS: Record<AccountMode, string> = {
  SCHOOL_WORKSPACE: 'bg-brand-50 text-brand-700',
  PERSONAL_DEMO: 'bg-amber-50 text-amber-700',
  WORKSPACE_PENDING: 'bg-amber-50 text-amber-700',
}

/**
 * 항상 현재 계정 모드 배지를 보여주고, SCHOOL_WORKSPACE가 아니면 체험 모드 경고
 * 배너를 함께 보여준다(요구사항 3·14절). 버튼을 숨기는 것과 무관하게 서버 API가
 * 실제 차단을 담당하므로(functions/_lib/requireInstalledAccess.ts), 이 배너는
 * 사용자에게 지금 모드를 명확히 알려주는 안내 역할만 한다.
 */
export function ModeBanner({ accountMode }: { accountMode: AccountMode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 sm:px-6">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${MODE_BADGE_CLASS[accountMode]}`}>
        {MODE_LABEL[accountMode]}
      </span>
      {accountMode !== 'SCHOOL_WORKSPACE' && (
        <p className="text-xs font-medium text-amber-700">
          체험 모드 — 실제 학생정보를 입력하거나 업로드하지 마세요.
        </p>
      )}
    </div>
  )
}
