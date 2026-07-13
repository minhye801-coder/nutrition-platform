import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'

export function LoginPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">로그인</h1>
        <p className="mt-1 text-sm text-gray-600">
          본인의 Google 계정으로 로그인합니다.
        </p>
      </div>

      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-400"
      >
        Google 계정으로 로그인 (준비 중)
      </button>

      <PlaceholderNotice>
        Google OAuth 로그인은 아직 연결되지 않았습니다. 이 자리에 로그인 버튼과
        인증 흐름이 들어갈 예정입니다.
      </PlaceholderNotice>
    </div>
  )
}
