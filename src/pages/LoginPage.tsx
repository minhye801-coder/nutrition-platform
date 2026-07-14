import { useSearchParams } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { primaryButtonClass } from '@/components/common/buttonStyles'
import { GOOGLE_LOGIN_URL } from '@/services/authService'

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Google 로그인이 취소되었습니다.',
  missing_code_or_state: '로그인 요청이 올바르지 않습니다. 다시 시도해 주세요.',
  missing_transaction: '로그인 세션이 만료되었습니다. 다시 시도해 주세요.',
  invalid_transaction: '로그인 세션이 올바르지 않습니다. 다시 시도해 주세요.',
  transaction_expired: '로그인 세션이 만료되었습니다. 다시 시도해 주세요.',
  state_mismatch: '로그인 요청 검증에 실패했습니다. 다시 시도해 주세요.',
  token_exchange_failed: 'Google 로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  oauth_not_configured: '로그인 기능이 아직 설정되지 않았습니다.',
}

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const errorCode = searchParams.get('error')
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? '로그인 중 문제가 발생했습니다.')
    : null

  return (
    <div className="mx-auto max-w-md">
      <Card className="space-y-6 text-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">로그인</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            학교에서 담당하고 계신 Google 계정으로 로그인합니다. 학생 데이터는
            선생님 본인의 Google Sheets/Drive에만 저장됩니다.
          </p>
        </div>

        <a href={GOOGLE_LOGIN_URL} className={`${primaryButtonClass} w-full`}>
          Google로 시작하기
        </a>

        {errorMessage && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
      </Card>
    </div>
  )
}
