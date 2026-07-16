import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { primaryButtonClass } from '@/components/common/buttonStyles'
import { fetchPublicIntakeConfig, IntakeApiError, submitPublicIntake } from '@/services/intakeService'
import {
  APPLICANT_TYPE_VALUES,
  PREFERRED_TIME_VALUES,
  RELATION_TO_STUDENT_VALUES,
  TOPIC_VALUES,
  URGENCY_VALUES,
} from '@/types/intake'
import type { SubmitIntakeInput } from '@/types/intake'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

const CURRENT_SCHOOL_YEAR = String(new Date().getFullYear())

type FormValues = Omit<SubmitIntakeInput, 'privacyConsent'> & { privacyConsent: boolean }

const EMPTY_FORM: FormValues = {
  website: '',
  applicantType: '',
  applicantName: '',
  relationToStudent: '',
  schoolYear: CURRENT_SCHOOL_YEAR,
  grade: '',
  class: '',
  studentNumber: '',
  name: '',
  topic: '',
  content: '',
  preferredTime: PREFERRED_TIME_VALUES[0],
  urgency: URGENCY_VALUES[0],
  contactInfo: '',
  privacyConsent: false,
  note: '',
}

/** applicantType 선택 시 relationToStudent 기본값을 미리 채워주는 legacy 편의 기능(docs/intake-migration-spec.md 2절). */
const APPLICANT_TYPE_TO_RELATION: Record<string, string> = {
  학생: '본인',
  보호자: '보호자',
  담임교사: '담임교사',
  보건교사: '보건교사',
}

function describeIntakeError(error: unknown): string {
  if (error instanceof IntakeApiError) {
    switch (error.code) {
      case 'privacy_consent_required':
        return '개인정보 수집·이용에 동의해야 신청할 수 있습니다.'
      case 'invalid_input':
        return '입력값을 확인해 주세요. 필수 항목이 비어 있거나 형식이 올바르지 않습니다.'
      case 'unavailable':
        return '일시적으로 신청을 받을 수 없습니다. 학교로 직접 문의해 주세요.'
      default:
        return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export function PublicIntakePage() {
  const { schoolPublicId } = useParams<{ schoolPublicId: string }>()
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [configError, setConfigError] = useState('')
  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!schoolPublicId) return
    let cancelled = false
    fetchPublicIntakeConfig(schoolPublicId)
      .then((config) => {
        if (!cancelled) setSchoolName(config.schoolName)
      })
      .catch(() => {
        if (!cancelled) setConfigError('학교 정보를 불러올 수 없습니다. 안내받은 링크가 올바른지 확인해 주세요.')
      })
    return () => {
      cancelled = true
    }
  }, [schoolPublicId])

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'applicantType') {
        const mapped = APPLICANT_TYPE_TO_RELATION[value as string]
        if (mapped) next.relationToStudent = mapped
      }
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !schoolPublicId) return

    if (
      !form.applicantType ||
      !form.applicantName.trim() ||
      !form.relationToStudent ||
      !form.schoolYear.trim() ||
      !form.grade ||
      !form.class.trim() ||
      !form.name.trim() ||
      !form.topic ||
      !form.content.trim() ||
      !form.contactInfo.trim()
    ) {
      setSubmitError('필수 항목을 모두 입력해 주세요.')
      return
    }
    if (!form.privacyConsent) {
      setSubmitError('개인정보 수집·이용에 동의해야 신청할 수 있습니다.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      await submitPublicIntake(schoolPublicId, {
        ...form,
        applicantName: form.applicantName.trim(),
        schoolYear: form.schoolYear.trim(),
        class: form.class.trim(),
        studentNumber: form.studentNumber?.trim() || undefined,
        name: form.name.trim(),
        content: form.content.trim(),
        contactInfo: form.contactInfo.trim(),
        note: form.note?.trim() || undefined,
      })
      setSubmitted(true)
    } catch (error) {
      setSubmitError(describeIntakeError(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (!schoolPublicId) {
    return <p className="py-16 text-center text-sm text-gray-500">잘못된 접근입니다.</p>
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-xl space-y-2 text-center">
        <h1 className="text-lg font-semibold text-gray-900">상담신청이 접수되었습니다</h1>
        <p className="text-sm text-gray-600">
          담당 선생님이 신청 내용을 확인한 뒤 순차적으로 연락드립니다. 이 화면은 닫으셔도 됩니다.
        </p>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">상담 신청</h1>
        <p className="mt-1 text-sm text-gray-500">
          {configError ? configError : schoolName ? `${schoolName} 영양상담 신청서` : '학교 정보를 불러오는 중입니다...'}
        </p>
      </div>

      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
        {/* 허니팟 — 실제 사용자에게는 보이지 않는다. 값이 채워지면 서버가 봇으로 간주해 거부한다. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          value={form.website}
          onChange={(event) => updateField('website', event.target.value)}
        />

        <div>
          <label htmlFor="applicantType" className="block text-xs font-medium text-gray-500">
            신청자 유형 *
          </label>
          <select
            id="applicantType"
            value={form.applicantType}
            onChange={(event) => updateField('applicantType', event.target.value)}
            className={inputClass}
          >
            <option value="">선택하세요</option>
            {APPLICANT_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="applicantName" className="block text-xs font-medium text-gray-500">
            신청자 이름 *
          </label>
          <input
            id="applicantName"
            type="text"
            value={form.applicantName}
            onChange={(event) => updateField('applicantName', event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="relationToStudent" className="block text-xs font-medium text-gray-500">
            학생과의 관계 *
          </label>
          <select
            id="relationToStudent"
            value={form.relationToStudent}
            onChange={(event) => updateField('relationToStudent', event.target.value)}
            className={inputClass}
          >
            <option value="">선택하세요</option>
            {RELATION_TO_STUDENT_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contactInfo" className="block text-xs font-medium text-gray-500">
            보호자 연락처 *
          </label>
          <input
            id="contactInfo"
            type="tel"
            placeholder="학생 본인 번호가 아닌 보호자 휴대전화 번호"
            value={form.contactInfo}
            onChange={(event) => updateField('contactInfo', event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="schoolYear" className="block text-xs font-medium text-gray-500">
            학년도 *
          </label>
          <input
            id="schoolYear"
            type="text"
            value={form.schoolYear}
            onChange={(event) => updateField('schoolYear', event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="grade" className="block text-xs font-medium text-gray-500">
            학년 *
          </label>
          <select
            id="grade"
            value={form.grade}
            onChange={(event) => updateField('grade', event.target.value)}
            className={inputClass}
          >
            <option value="">선택하세요</option>
            {['1', '2', '3', '4', '5', '6'].map((value) => (
              <option key={value} value={value}>
                {value}학년
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="class" className="block text-xs font-medium text-gray-500">
            반 *
          </label>
          <input
            id="class"
            type="number"
            min={1}
            value={form.class}
            onChange={(event) => updateField('class', event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="studentNumber" className="block text-xs font-medium text-gray-500">
            번호
          </label>
          <input
            id="studentNumber"
            type="number"
            min={1}
            value={form.studentNumber}
            onChange={(event) => updateField('studentNumber', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-xs font-medium text-gray-500">
            학생 이름 *
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="topic" className="block text-xs font-medium text-gray-500">
            상담 주제 *
          </label>
          <select
            id="topic"
            value={form.topic}
            onChange={(event) => updateField('topic', event.target.value)}
            className={inputClass}
          >
            <option value="">선택하세요</option>
            {TOPIC_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="preferredTime" className="block text-xs font-medium text-gray-500">
            희망 상담 시간
          </label>
          <select
            id="preferredTime"
            value={form.preferredTime}
            onChange={(event) => updateField('preferredTime', event.target.value)}
            className={inputClass}
          >
            {PREFERRED_TIME_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="content" className="block text-xs font-medium text-gray-500">
            상담을 신청하는 이유 *
          </label>
          <textarea
            id="content"
            rows={4}
            value={form.content}
            onChange={(event) => updateField('content', event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="urgency" className="block text-xs font-medium text-gray-500">
            확인 필요 정도
          </label>
          <select
            id="urgency"
            value={form.urgency}
            onChange={(event) => updateField('urgency', event.target.value)}
            className={inputClass}
          >
            {URGENCY_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="note" className="block text-xs font-medium text-gray-500">
            기타 전달사항
          </label>
          <textarea
            id="note"
            rows={2}
            value={form.note}
            onChange={(event) => updateField('note', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.privacyConsent}
              onChange={(event) => updateField('privacyConsent', event.target.checked)}
              className="mt-0.5"
            />
            개인정보 수집·이용에 동의합니다. *
          </label>
        </div>

        {submitError && <p className="text-sm text-red-600 sm:col-span-2">{submitError}</p>}

        <div className="sm:col-span-2">
          <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
            {submitting ? '제출 중...' : '상담 신청하기'}
          </button>
        </div>
      </form>
    </Card>
  )
}
