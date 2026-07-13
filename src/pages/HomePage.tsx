import { Link } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { primaryButtonClass } from '@/components/common/buttonStyles'

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
  return (
    <div className="space-y-16">
      <section className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
          N+
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            영양상담 AI+
          </h1>
          <p className="mt-2 text-base text-gray-500 sm:text-lg">
            학교 영양상담 통합플랫폼
          </p>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">
          여러 학교의 영양교사가 하나의 사이트에서 각자의 Google 계정으로 로그인해
          본인 소유의 Google Sheets/Drive에 학생 데이터를 안전하게 저장하고
          관리하는 플랫폼입니다.
        </p>
        <Link to="/login" className={primaryButtonClass}>
          Google로 시작하기
        </Link>
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
