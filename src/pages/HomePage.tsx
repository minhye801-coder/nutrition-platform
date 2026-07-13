import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">영양상담 AI+</h1>
        <p className="mt-1 text-gray-600">학교 영양상담 통합플랫폼</p>
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
        여러 학교의 영양교사가 하나의 사이트에서 각자의 Google 계정으로 로그인해
        본인 소유의 Google Sheets/Drive에 학생 데이터를 안전하게 저장하고 관리하는
        플랫폼입니다.
      </p>

      <Link
        to="/login"
        className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        시작하기
      </Link>
    </div>
  )
}
