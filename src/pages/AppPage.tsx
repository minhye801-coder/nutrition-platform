import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'

export function AppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">영양상담 관리자</h1>
        <p className="mt-1 text-sm text-gray-600">
          로그인한 선생님의 학생정보·상담 데이터를 관리하는 화면입니다.
        </p>
      </div>

      <PlaceholderNotice>
        Google Sheets 연동(설정/학생정보 탭 읽기)은 아직 연결되지 않았습니다. 이
        화면은 관리자 대시보드의 UI 뼈대입니다.
      </PlaceholderNotice>
    </div>
  )
}
