import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'

interface ComingSoonPageProps {
  title: string
}

/**
 * legacy `counseling-manager`에는 있지만 이번 마일스톤까지는 이관되지 않은 화면들
 * (보호자 동의 관리, 공식 진단 PDF, 상담 기록 등)을 위한 공용 자리표시 페이지.
 * 메뉴 자체를 숨기거나 다른 기능으로 바꾸지 않고, 실제 기능이 붙기 전까지
 * "준비 중" 안내만 보여준다.
 */
export function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <AuthGuard requireInstallation>
      {() => (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          </div>
          <Card className="py-12 text-center">
            <p className="text-sm text-gray-500">{title} 기능은 준비 중입니다.</p>
          </Card>
        </div>
      )}
    </AuthGuard>
  )
}
