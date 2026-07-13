import { useState } from 'react'
import { Card } from '@/components/common/Card'
import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'
import { primaryButtonClass } from '@/components/common/buttonStyles'

export function LoginPage() {
  const [clicked, setClicked] = useState(false)

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

        <button
          type="button"
          onClick={() => setClicked(true)}
          className={`${primaryButtonClass} w-full`}
        >
          Google로 시작하기
        </button>

        {clicked && (
          <PlaceholderNotice>
            Google 로그인 기능은 아직 준비 중입니다. 연결이 완료되면 이 버튼으로
            바로 로그인할 수 있습니다.
          </PlaceholderNotice>
        )}
      </Card>
    </div>
  )
}
