// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AssessmentDetailContent } from '../src/pages/AssessmentDetailPage'
import type { AssessmentListItem } from '../src/types/assessment'

const fetchAssessmentMock = vi.fn()

vi.mock('../src/services/assessmentService', () => ({
  fetchAssessment: (...args: unknown[]) => fetchAssessmentMock(...args),
  extractAssessment: vi.fn(),
  reviewAssessment: vi.fn(),
  createAssessment: vi.fn(),
  AssessmentApiError: class AssessmentApiError extends Error {},
}))

const DETAIL: AssessmentListItem = {
  caseTopic: '편식·균형 식생활',
  caseStatus: '결과 확인',
  studentName: '김민수',
  grade: '5',
  studentClass: '2',
  studentNumber: '15',
  assessment: {
    assessmentId: 'ASSESS-1',
    tenantId: 't',
    caseId: 'CASE-1',
    studentUuid: 'STU-AAAA-AAAA-AAAA',
    round: '1차',
    timepoint: '사전',
    fileUrl: '',
    fileId: '',
    fileName: '',
    uploadedAt: '2026-07-15T00:00:00.000Z',
    uploadedBy: 'teacher@example.com',
    status: '검토 대기',
    reviewNote: '',
    reviewedAt: '',
    reviewedBy: '',
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    extractionStatus: 'AI 추출',
    extractedAt: '2026-07-15T00:10:00.000Z',
    caseRequestId: 'CASE-20260715-AB12',
    warnings: '',
    responseHighlights: '아침 결식이 잦다는 응답이 확인됩니다.\n스마트폰 사용 시간이 평소보다 길다는 응답입니다.',
    reviewFlags: '',
    mergedIntoAssessmentId: '',
    gradeBand: '초등 고학년',
    sex: '남',
    heightCm: '142.3',
    heightPercentile: '55',
    weightKg: '36.8',
    weightPercentile: '60',
    bmi: '18.2',
    bmiPercentile: '58',
    subjectiveHealth: '보통',
    bodyImage: '보통',
    mealFrequency: '3회',
    regularMealTime: '보통',
    eatingSpeed: '빠름',
    mealAmount: '보통',
    totalLevel: '양호',
    totalScore: '78',
    balanceLevel: '보통',
    balanceScore: '72',
    moderationLevel: '양호',
    moderationScore: '80',
    practiceLevel: '보통',
    practiceScore: '75',
    eatingAttitude: '보통',
    eatingAttitudeScore: '74',
    allergy: '없음',
    disease: '없음',
    sleepLevel: '양호',
    sleepDuration: '8시간',
    mentalHealth: '양호',
    smartphoneUsageLevel: '보통',
    weekdaySmartphoneHours: '2',
    weekendSmartphoneHours: '4',
    smartphoneOverdependence: '주의',
    additionalRequest: '',
  },
}

describe('AssessmentDetailPage — 통합 검토 화면', () => {
  beforeEach(() => {
    fetchAssessmentMock.mockReset().mockResolvedValue(DETAIL)
  })

  it('shows the student identity, official diagnosis result fields, and response-detail highlights together', async () => {
    render(
      <MemoryRouter initialEntries={['/assessments/ASSESS-1']}>
        <Routes>
          <Route path="/assessments/:assessmentId" element={<AssessmentDetailContent />} />
        </Routes>
      </MemoryRouter>,
    )

    // A. 학생 및 검사정보
    expect(await screen.findByText('김민수')).toBeInTheDocument()

    // B. 공식 진단결과 — 필드 그룹 값이 입력창에 채워져 있어야 한다.
    expect(await screen.findByLabelText('종합 점수')).toHaveValue('78') // totalScore
    expect(screen.getByLabelText('종합 등급')).toHaveValue('양호') // totalLevel

    // C. 응답내역 — responseHighlights가 별도 카드로 표시돼야 한다(요구사항 5·6절).
    expect(screen.getByText('아침 결식이 잦다는 응답이 확인됩니다.')).toBeInTheDocument()
    expect(screen.getByText('스마트폰 사용 시간이 평소보다 길다는 응답입니다.')).toBeInTheDocument()
  })

  it('shows a placeholder instead of AI-generated content when no response highlights exist yet', async () => {
    fetchAssessmentMock.mockResolvedValue({
      ...DETAIL,
      assessment: { ...DETAIL.assessment, responseHighlights: '' },
    })

    render(
      <MemoryRouter initialEntries={['/assessments/ASSESS-1']}>
        <Routes>
          <Route path="/assessments/:assessmentId" element={<AssessmentDetailContent />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('등록된 응답내역이 없습니다.')).toBeInTheDocument()
  })

  it('renders all 9 requested category headings so the review screen reads in the required order', async () => {
    render(
      <MemoryRouter initialEntries={['/assessments/ASSESS-1']}>
        <Routes>
          <Route path="/assessments/:assessmentId" element={<AssessmentDetailContent />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('김민수')

    for (const heading of [
      '검사 기본정보',
      '영역별 점수와 판정',
      '식생활 주요 응답',
      '생활습관 주요 응답',
      '수면 관련 응답',
      '스마트폰·신체활동 관련 응답',
      '알레르기·질환 등 상담 참고사항',
      '확인이 필요한 응답',
      '누락 또는 판독 실패 항목',
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument()
    }
  })

  it('shows a persisted review flag code (e.g. from a previous session) translated to Korean when the record is reopened', async () => {
    fetchAssessmentMock.mockResolvedValue({
      ...DETAIL,
      assessment: { ...DETAIL.assessment, reviewFlags: 'STUDENT_NAME_MISMATCH\nRESPONSE_PDF_MISSING' },
    })

    render(
      <MemoryRouter initialEntries={['/assessments/ASSESS-1']}>
        <Routes>
          <Route path="/assessments/:assessmentId" element={<AssessmentDetailContent />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('학생 이름 불일치')).toBeInTheDocument()
    expect(screen.getByText('응답내역 PDF 미제공')).toBeInTheDocument()
  })
})
