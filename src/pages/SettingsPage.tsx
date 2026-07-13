import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
        <p className="mt-1 text-sm text-gray-600">
          학교 정보, Gemini API Key, Google 계정 연결 해제를 관리합니다.
        </p>
      </div>

      <PlaceholderNotice>
        Gemini API Key 등록과 Google 계정 연결 해제 기능은 아직 연결되지 않았습니다.
        이 화면은 설정 화면의 UI 뼈대입니다.
      </PlaceholderNotice>
    </div>
  )
}
