import { Link, useNavigate } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { startGuestSession } from '@/lib/demoAck'

interface Feature {
  code: string
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    code: 'AI',
    title: 'AI 영양상담',
    description: '학생 상담 기록, 진단 결과, 실천 목표를 한 곳에서 관리합니다.',
  },
  {
    code: '맛',
    title: '맛마을 탐험소',
    description: '학생들이 급식을 돌아보고 스스로 실천 목표를 점검하는 공간입니다.',
  },
  {
    code: '신청',
    title: '상담신청',
    description: '학생과 보호자가 별도 로그인 없이 온라인으로 상담을 신청합니다.',
  },
  {
    code: '동의',
    title: '보호자동의',
    description: '안전한 링크로 보호자 동의를 받고 그 기록을 보관합니다.',
  },
]

export function HomePage() {
  const navigate = useNavigate()

  function handleStartGuest() {
    startGuestSession()
    navigate('/app')
  }

  return (
    <div className="space-y-16">
      <section className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
          N+
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">AI 영양상담</h1>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">
          학교 또는 교육청에서 발급한 Google Workspace 업무용 계정으로 로그인하거나,
          가상자료로 서비스를 체험할 수 있습니다.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/login" className={primaryButtonClass}>
            학교 업무용 계정으로 로그인
          </Link>
          <button type="button" onClick={handleStartGuest} className={secondaryButtonClass}>
            로그인 없이 체험하기
          </button>
        </div>
        <p className="max-w-xl text-xs leading-relaxed text-gray-500">
          실제 학생정보를 처리할 때에는 반드시 학교 또는 교육청에서 승인한 업무용
          Google Workspace 계정을 사용해 주세요.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-center text-xl font-bold text-gray-900">주요 기능</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                {feature.code}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  {feature.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
