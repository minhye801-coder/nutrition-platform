// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AssessmentsContent } from '../src/pages/AssessmentsPage'
import type { ConsentListItem } from '../src/types/consent'
import type { AssessmentListItem } from '../src/types/assessment'

const fetchConsentsMock = vi.fn()
const fetchAssessmentsMock = vi.fn()
const createAssessmentMock = vi.fn()
const navigateMock = vi.fn()

vi.mock('../src/services/consentService', () => ({
  fetchConsents: (...args: unknown[]) => fetchConsentsMock(...args),
  ConsentApiError: class ConsentApiError extends Error {},
}))

vi.mock('../src/services/assessmentService', () => ({
  fetchAssessments: (...args: unknown[]) => fetchAssessmentsMock(...args),
  createAssessment: (...args: unknown[]) => createAssessmentMock(...args),
  AssessmentApiError: class AssessmentApiError extends Error {},
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const TARGET: ConsentListItem = {
  consent: {
    consentId: 'CONSENT-1',
    tenantId: 't',
    intakeId: '',
    caseId: 'CASE-1',
    studentUuid: 'STU-AAAA-AAAA-AAAA',
    consentToken: '',
    status: '동의 완료',
    studentAssent: '',
    counselingConsent: '',
    personalInfoConsent: '',
    sensitiveInfoConsent: '',
    diagnosisUseConsent: '',
    aiNoticeConfirmed: '',
    requestedAt: '',
    respondedAt: '',
    consentedAt: '',
    consentPdfFileId: '',
    confirmedAt: '',
    confirmedBy: '',
    note: '',
    createdAt: '',
    updatedAt: '',
  },
  caseTopic: '편식·균형 식생활',
  caseStatus: '진단 대기',
  caseOpenedAt: '2026-07-01T00:00:00.000Z',
  studentName: '김민수',
  gradeClass: '5학년 2반',
  grade: '5',
  studentClass: '2',
  studentNumber: '15',
}

describe('AssessmentsPage — 진단자료 확인 버튼 이중 클릭 방지', () => {
  beforeEach(() => {
    fetchConsentsMock.mockReset().mockResolvedValue([TARGET])
    fetchAssessmentsMock.mockReset().mockResolvedValue([] as AssessmentListItem[])
    navigateMock.mockReset()
    // 실제 네트워크만큼은 아니지만, 두 번째 클릭이 첫 번째 요청 완료 전에 들어올 수 있도록
    // 약간의 비동기 지연을 흉내낸다.
    createAssessmentMock.mockReset().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ assessmentId: 'ASSESS-NEW' }), 10)),
    )
  })

  it('rapid double-click on the same card only creates one assessment', async () => {
    render(
      <MemoryRouter>
        <AssessmentsContent />
      </MemoryRouter>,
    )

    const button = await screen.findByRole('button', { name: '진단자료 확인' })
    fireEvent.click(button)
    fireEvent.click(button) // 첫 요청이 끝나기 전에 즉시 다시 클릭

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/assessments/ASSESS-NEW'))
    expect(createAssessmentMock).toHaveBeenCalledTimes(1)
    // 요구사항 3절 테스트 3: 사전 기록이 없는 케이스는 새로 등록할 때 평가시점이 기본값 '사전'이다.
    expect(createAssessmentMock).toHaveBeenCalledWith('CASE-1', '1차', '사전')
  })

  it('opens the existing 사전 assessment instead of creating a new one when it already exists', async () => {
    fetchAssessmentsMock.mockResolvedValue([
      {
        assessment: {
          assessmentId: 'ASSESS-EXISTING',
          caseId: 'CASE-1',
          timepoint: '사전',
          updatedAt: '2026-07-02T00:00:00.000Z',
          status: '검토 대기',
          extractionStatus: '수동 입력',
        },
        caseTopic: '',
        caseStatus: '',
        studentName: '김민수',
        grade: '5',
        studentClass: '2',
        studentNumber: '15',
      },
    ] as unknown as AssessmentListItem[])

    render(
      <MemoryRouter>
        <AssessmentsContent />
      </MemoryRouter>,
    )

    const button = await screen.findByRole('button', { name: '진단자료 확인' })
    fireEvent.click(button)

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/assessments/ASSESS-EXISTING'))
    expect(createAssessmentMock).not.toHaveBeenCalled()
  })
})
