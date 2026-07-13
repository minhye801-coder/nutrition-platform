import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'
import type {
  IntakeRequest,
  PendingConsent,
  TasteVillageStat,
  TodaySession,
} from '@/types/dashboard'

const TODAY_SESSIONS: TodaySession[] = [
  { time: '09:30', studentLabel: '3학년 2반 · 학생 A', topic: '체중관리 2회기' },
  { time: '11:00', studentLabel: '5학년 1반 · 학생 B', topic: '식습관 초기상담' },
  { time: '14:20', studentLabel: '4학년 3반 · 학생 C', topic: '성장평가 결과 안내' },
]

const INTAKE_REQUESTS: IntakeRequest[] = [
  { studentLabel: '2학년 4반 · 학생 D', submittedAt: '오늘 08:12 접수' },
  { studentLabel: '6학년 2반 · 학생 E', submittedAt: '어제 16:40 접수' },
]

const PENDING_CONSENTS: PendingConsent[] = [
  { studentLabel: '3학년 2반 · 학생 A', sentAt: '2일 전 발송' },
  { studentLabel: '5학년 1반 · 학생 B', sentAt: '3일 전 발송' },
  { studentLabel: '1학년 5반 · 학생 F', sentAt: '오늘 발송' },
]

const TASTE_VILLAGE_STATS: TasteVillageStat[] = [
  { label: '이번 주 참여 학생', value: '128명' },
  { label: '실천 미션 달성률', value: '76%' },
  { label: '신규 배지 획득', value: '34건' },
]

const SUMMARY_CARDS = [
  { label: '오늘의 상담', value: TODAY_SESSIONS.length, unit: '건' },
  { label: '신규 상담신청', value: INTAKE_REQUESTS.length, unit: '건' },
  { label: '보호자동의 대기', value: PENDING_CONSENTS.length, unit: '건' },
  { label: '맛마을 참여', value: 128, unit: '명' },
]

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
        지금 표시되는 데이터는 화면 확인용 샘플입니다. 실제 Google Sheets 연동은
        아직 연결되지 않았습니다.
      </PlaceholderNotice>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <Card key={card.label}>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {card.value}
              <span className="ml-1 text-sm font-normal text-gray-500">
                {card.unit}
              </span>
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-gray-900">오늘의 상담</h2>
          <ul className="mt-3 space-y-2">
            {TODAY_SESSIONS.map((session) => (
              <li
                key={session.time + session.studentLabel}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700">{session.studentLabel}</span>
                <span className="text-gray-500">{session.time}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold text-gray-900">신규 상담신청</h2>
          <ul className="mt-3 space-y-2">
            {INTAKE_REQUESTS.map((request) => (
              <li
                key={request.studentLabel}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700">{request.studentLabel}</span>
                <Badge tone="warning">대기</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold text-gray-900">보호자동의 대기</h2>
          <ul className="mt-3 space-y-2">
            {PENDING_CONSENTS.map((consent) => (
              <li
                key={consent.studentLabel}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700">{consent.studentLabel}</span>
                <span className="text-xs text-gray-500">{consent.sentAt}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold text-gray-900">맛마을 참여 현황</h2>
          <ul className="mt-3 space-y-2">
            {TASTE_VILLAGE_STATS.map((stat) => (
              <li
                key={stat.label}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700">{stat.label}</span>
                <span className="font-semibold text-gray-900">{stat.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
