import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'

const SETUP_STEPS = [
  '학교명 · 담당자명 입력',
  '새 작업공간 생성',
  '내 Google Drive에 루트 폴더 생성',
  '내 Google Drive에 데이터 Spreadsheet 생성',
  '기본 시트 탭 및 헤더 생성',
  'schoolPublicId 발급',
  'Gemini API Key 입력(선택, 나중에 설정 가능)',
]

export function SetupPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">최초 설치</h1>
        <p className="mt-1 text-sm text-gray-600">
          처음 로그인한 선생님이 자신의 학교 작업공간을 만드는 단계입니다.
        </p>
      </div>

      <ol className="space-y-2">
        {SETUP_STEPS.map((step, index) => (
          <li
            key={step}
            className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700"
          >
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <PlaceholderNotice>
        실제 Google Drive/Sheets 생성 로직은 아직 연결되지 않았습니다. 이 화면은
        설치 흐름의 UI 뼈대입니다.
      </PlaceholderNotice>
    </div>
  )
}
