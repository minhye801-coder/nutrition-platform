import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { primaryButtonClass } from '@/components/common/buttonStyles'
import { ConsentApiError, fetchPublicConsent, submitPublicConsent } from '@/services/consentService'
import { CONSENT_DECISION_AGREE, CONSENT_DECISION_DECLINE } from '@/types/consent'
import type { PublicConsentInfo, SubmitConsentInput } from '@/types/consent'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

const RELATION_VALUES = ['부', '모', '보호자', '기타'] as const

const REQUIRED_ITEMS: { key: keyof Pick<
  SubmitConsentInput,
  'counselingConsent' | 'personalInfoConsent' | 'sensitiveInfoConsent' | 'diagnosisUseConsent' | 'aiNoticeConfirmed'
>; label: string }[] = [
  { key: 'counselingConsent', label: '학교 영양상담 진행에 동의합니다.' },
  { key: 'personalInfoConsent', label: '상담을 위한 개인정보 수집·이용에 동의합니다.' },
  { key: 'sensitiveInfoConsent', label: '건강 등 민감정보 수집·이용에 동의합니다.' },
  { key: 'diagnosisUseConsent', label: '진단(검사) 결과를 상담에 활용하는 것에 동의합니다.' },
  { key: 'aiNoticeConfirmed', label: 'AI 보조 도구가 상담 과정에 활용될 수 있음을 안내받았습니다.' },
]

type FormValues = {
  guardianName: string
  relationToStudent: string
  guardianContact: string
  decision: typeof CONSENT_DECISION_AGREE | typeof CONSENT_DECISION_DECLINE | ''
  signatureName: string
  counselingConsent: boolean
  personalInfoConsent: boolean
  sensitiveInfoConsent: boolean
  diagnosisUseConsent: boolean
  aiNoticeConfirmed: boolean
}

const EMPTY_FORM: FormValues = {
  guardianName: '',
  relationToStudent: '',
  guardianContact: '',
  decision: '',
  signatureName: '',
  counselingConsent: false,
  personalInfoConsent: false,
  sensitiveInfoConsent: false,
  diagnosisUseConsent: false,
  aiNoticeConfirmed: false,
}

function describeConsentError(error: unknown): string {
  if (error instanceof ConsentApiError) {
    switch (error.code) {
      case 'signature_mismatch':
        return '보호자 이름과 전자서명 이름이 일치하지 않습니다.'
      case 'items_incomplete':
        return '동의하시려면 5개 항목에 모두 체크해 주세요.'
      case 'already_submitted':
        return '이미 제출된 동의서입니다.'
      case 'invalid_input':
        return '입력값을 확인해 주세요.'
      default:
        return '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export function PublicConsentPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<PublicConsentInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchPublicConsent(token)
      .then((result) => {
        if (!cancelled) setInfo(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('링크가 유효하지 않거나 이미 처리된 동의서입니다. 학교로 문의해 주세요.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !token) return

    if (!form.guardianName.trim() || !form.relationToStudent || !form.guardianContact.trim() || !form.decision) {
      setSubmitError('필수 항목을 모두 입력해 주세요.')
      return
    }
    if (!form.signatureName.trim()) {
      setSubmitError('전자서명(이름)을 입력해 주세요.')
      return
    }
    if (form.decision === CONSENT_DECISION_AGREE && !REQUIRED_ITEMS.every(({ key }) => form[key])) {
      setSubmitError('동의하시려면 5개 항목에 모두 체크해 주세요.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      await submitPublicConsent(token, {
        guardianName: form.guardianName.trim(),
        relationToStudent: form.relationToStudent,
        guardianContact: form.guardianContact.trim(),
        decision: form.decision,
        signatureName: form.signatureName.trim(),
        counselingConsent: form.counselingConsent,
        personalInfoConsent: form.personalInfoConsent,
        sensitiveInfoConsent: form.sensitiveInfoConsent,
        diagnosisUseConsent: form.diagnosisUseConsent,
        aiNoticeConfirmed: form.aiNoticeConfirmed,
      })
      setSubmitted(true)
    } catch (error) {
      setSubmitError(describeConsentError(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return <p className="py-16 text-center text-sm text-gray-500">잘못된 접근입니다.</p>
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-gray-500">불러오는 중...</p>
  }

  if (loadError || !info) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <p className="text-sm text-gray-600">{loadError || '링크를 불러올 수 없습니다.'}</p>
      </Card>
    )
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-xl space-y-2 text-center">
        <h1 className="text-lg font-semibold text-gray-900">제출이 완료되었습니다</h1>
        <p className="text-sm text-gray-600">담당 선생님이 확인 후 다음 절차를 안내드립니다. 이 화면은 닫으셔도 됩니다.</p>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">보호자동의서</h1>
        <p className="mt-1 text-sm text-gray-500">
          {info.studentName} 학생{info.topic ? ` · ${info.topic}` : ''} 상담 진행을 위한 보호자 동의를 요청드립니다.
        </p>
      </div>

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="guardianName" className="block text-xs font-medium text-gray-500">
              보호자 이름 *
            </label>
            <input
              id="guardianName"
              type="text"
              value={form.guardianName}
              onChange={(event) => updateField('guardianName', event.target.value)}
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
              {RELATION_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="guardianContact" className="block text-xs font-medium text-gray-500">
              보호자 연락처 *
            </label>
            <input
              id="guardianContact"
              type="tel"
              value={form.guardianContact}
              onChange={(event) => updateField('guardianContact', event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">동의 여부 *</p>
          <div className="flex gap-4 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="decision"
                checked={form.decision === CONSENT_DECISION_AGREE}
                onChange={() => updateField('decision', CONSENT_DECISION_AGREE)}
              />
              동의합니다
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="decision"
                checked={form.decision === CONSENT_DECISION_DECLINE}
                onChange={() => updateField('decision', CONSENT_DECISION_DECLINE)}
              />
              동의하지 않습니다
            </label>
          </div>
        </div>

        {form.decision === CONSENT_DECISION_AGREE && (
          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            {REQUIRED_ITEMS.map(({ key, label }) => (
              <label key={key} className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(event) => updateField(key, event.target.checked)}
                  className="mt-0.5"
                />
                {label}
              </label>
            ))}
          </div>
        )}

        <div>
          <label htmlFor="signatureName" className="block text-xs font-medium text-gray-500">
            전자서명(보호자 이름을 다시 입력) *
          </label>
          <input
            id="signatureName"
            type="text"
            value={form.signatureName}
            onChange={(event) => updateField('signatureName', event.target.value)}
            className={inputClass}
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
          {submitting ? '제출 중...' : '동의서 제출'}
        </button>
      </form>
    </Card>
  )
}
