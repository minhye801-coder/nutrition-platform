import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import {
  createStudent,
  deactivateStudent,
  DuplicateStudentError,
  fetchStudents,
  restoreStudent,
  StudentApiError,
  updateStudent,
} from '@/services/studentService'
import type { Student } from '@/types/student'
import type { SessionUser } from '@/types/session'

type Feedback = { type: 'success' | 'error'; message: string }

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

/**
 * 서버 오류 코드를 사용자에게 안전하게 보여줄 수 있는 구체적인 문구로 바꾼다.
 * Google 원본 오류/토큰/Spreadsheet ID는 서버가 애초에 코드에 담아 보내지
 * 않으므로 여기서도 노출할 값 자체가 없다.
 */
function describeStudentError(error: unknown): string {
  if (error instanceof StudentApiError) {
    switch (error.code) {
      case 'student_sheet_missing_headers':
        return '학생정보 시트에 필요한 열이 없어 자동으로 보정을 시도했지만 실패했습니다. 잠시 후 다시 시도해 주세요.'
      case 'student_sheet_not_found':
        return '학생정보 시트를 찾을 수 없습니다. 설정 화면에서 설치 상태를 확인해 주세요.'
      case 'drive_access_required':
        return 'Google Drive 접근 권한이 만료되었거나 부족합니다. 다시 로그인해 주세요.'
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      case 'not_installed':
        return '설치가 아직 완료되지 않았습니다. 설치를 먼저 진행해 주세요.'
      case 'unauthenticated':
        return '로그인이 필요합니다.'
      case 'invalid_input':
        return '입력값을 확인해 주세요. 이름·학년·반은 필수입니다.'
      case 'not_found':
        return '해당 학생을 찾을 수 없습니다. 목록을 새로고침해 주세요.'
      case 'invalid_enrollment_status':
        return '재학상태 값이 올바르지 않습니다.'
      case 'student_uuid_immutable':
        return '학생 고유 ID는 변경할 수 없습니다.'
      default:
        return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export function StudentsPage() {
  return <AuthGuard requireInstallation>{(user) => <StudentsContent user={user} />}</AuthGuard>
}

interface StudentFormValues {
  name: string
  grade: string
  class: string
  studentNumber: string
}

const EMPTY_FORM: StudentFormValues = { name: '', grade: '', class: '', studentNumber: '' }

function StudentsContent({ user }: { user: SessionUser }) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const [filters, setFilters] = useState({ q: '', grade: '', class: '', status: 'active' })
  const [filterInputs, setFilterInputs] = useState(filters)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<StudentFormValues>(EMPTY_FORM)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState<{ existingStudentUuid: string } | null>(null)

  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<StudentFormValues>(EMPTY_FORM)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  const [actionInFlight, setActionInFlight] = useState<string | null>(null)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchStudents({
        q: filters.q || undefined,
        grade: filters.grade || undefined,
        class: filters.class || undefined,
        status: filters.status,
      })
      setStudents(result)
    } catch (error) {
      setLoadError(describeStudentError(error))
    } finally {
      setLoading(false)
    }
  }, [filters.q, filters.grade, filters.class, filters.status])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(filterInputs)
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement> | null, forceDuplicate = false) {
    event?.preventDefault()
    if (createSubmitting) return // 버튼이 disabled로 리렌더되기 전의 짧은 창을 통한 중복 클릭 방지
    const name = createForm.name.trim()
    const grade = createForm.grade.trim()
    const studentClass = createForm.class.trim()
    if (!name || !grade || !studentClass) {
      setCreateError('이름, 학년, 반은 필수입니다.')
      return
    }

    setCreateSubmitting(true)
    setCreateError('')
    try {
      const student = await createStudent({
        name,
        grade,
        class: studentClass,
        studentNumber: createForm.studentNumber.trim() || undefined,
        confirmDuplicate: forceDuplicate,
      })
      setDuplicateWarning(null)
      setCreateForm(EMPTY_FORM)
      setShowCreateForm(false)
      setFeedback({ type: 'success', message: `${student.name} 학생을 등록했습니다.` })
      await loadStudents()
    } catch (error) {
      if (error instanceof DuplicateStudentError) {
        setDuplicateWarning({ existingStudentUuid: error.existingStudentUuid })
      } else {
        const message = describeStudentError(error)
        setCreateError(message)
        setFeedback({ type: 'error', message: `학생 등록에 실패했습니다: ${message}` })
      }
    } finally {
      setCreateSubmitting(false)
    }
  }

  function startEdit(student: Student) {
    setEditingUuid(student.studentUuid)
    setEditForm({
      name: student.name,
      grade: student.grade,
      class: student.class,
      studentNumber: student.studentNumber,
    })
    setEditError('')
  }

  async function handleEditSubmit(studentUuid: string) {
    if (editSubmitting) return
    const name = editForm.name.trim()
    const grade = editForm.grade.trim()
    const studentClass = editForm.class.trim()
    if (!name || !grade || !studentClass) {
      setEditError('이름, 학년, 반은 필수입니다.')
      return
    }

    setEditSubmitting(true)
    setEditError('')
    try {
      await updateStudent(studentUuid, {
        name,
        grade,
        class: studentClass,
        studentNumber: editForm.studentNumber.trim(),
      })
      setEditingUuid(null)
      setFeedback({ type: 'success', message: '학생 정보를 수정했습니다.' })
      await loadStudents()
    } catch (error) {
      const message = describeStudentError(error)
      setEditError(message)
      setFeedback({ type: 'error', message: `학생 정보 수정에 실패했습니다: ${message}` })
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleDeactivate(student: Student) {
    const confirmed = window.confirm(
      `${student.name} 학생을 비활성 처리할까요?\n\n` +
        '- 학생정보와 기존 상담기록은 삭제되지 않고 그대로 보존됩니다.\n' +
        '- 기본 목록(재학생만 보기)에서만 제외되며, "전체 보기" 또는 "비활성만" 필터로 언제든 다시 확인할 수 있습니다.',
    )
    if (!confirmed) {
      return
    }
    setActionInFlight(student.studentUuid)
    try {
      await deactivateStudent(student.studentUuid)
      setFeedback({ type: 'success', message: `${student.name} 학생을 비활성 처리했습니다.` })
      await loadStudents()
    } catch (error) {
      setFeedback({ type: 'error', message: `비활성 처리에 실패했습니다: ${describeStudentError(error)}` })
    } finally {
      setActionInFlight(null)
    }
  }

  async function handleRestore(student: Student) {
    setActionInFlight(student.studentUuid)
    try {
      await restoreStudent(student.studentUuid)
      setFeedback({ type: 'success', message: `${student.name} 학생을 다시 재학 상태로 되돌렸습니다.` })
      await loadStudents()
    } catch (error) {
      setFeedback({ type: 'error', message: `복구에 실패했습니다: ${describeStudentError(error)}` })
    } finally {
      setActionInFlight(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">학생관리</h1>
        <p className="mt-1 text-sm text-gray-600">
          내 Google Spreadsheet의 &ldquo;학생정보&rdquo; 탭을 직접 읽고 씁니다.
        </p>
        <p className="mt-1 text-xs text-gray-500">로그인 계정: {user.email}</p>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
            feedback.type === 'success' ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline">
            닫기
          </button>
        </div>
      )}

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500">검색 및 필터</h2>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-5" onSubmit={applyFilters}>
          <div className="sm:col-span-2">
            <label htmlFor="q" className="block text-xs font-medium text-gray-500">
              이름 검색
            </label>
            <input
              id="q"
              type="text"
              value={filterInputs.q}
              onChange={(event) => setFilterInputs({ ...filterInputs, q: event.target.value })}
              placeholder="학생 이름"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="grade" className="block text-xs font-medium text-gray-500">
              학년
            </label>
            <input
              id="grade"
              type="text"
              value={filterInputs.grade}
              onChange={(event) => setFilterInputs({ ...filterInputs, grade: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="class" className="block text-xs font-medium text-gray-500">
              반
            </label>
            <input
              id="class"
              type="text"
              value={filterInputs.class}
              onChange={(event) => setFilterInputs({ ...filterInputs, class: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-gray-500">
              재학상태
            </label>
            <select
              id="status"
              value={filterInputs.status}
              onChange={(event) => setFilterInputs({ ...filterInputs, status: event.target.value })}
              className={inputClass}
            >
              <option value="active">재학생만</option>
              <option value="all">전체 보기</option>
              <option value="비활성">비활성만</option>
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-5">
            <button type="submit" className={secondaryButtonClass}>
              검색/필터 적용
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm((value) => !value)
                setDuplicateWarning(null)
                setCreateError('')
              }}
              className={primaryButtonClass}
            >
              {showCreateForm ? '등록 취소' : '학생 등록'}
            </button>
          </div>
        </form>
      </Card>

      {showCreateForm && (
        <Card className="space-y-3 border-l-4 border-l-brand-500 bg-brand-50/40">
          <h2 className="font-semibold text-brand-800">✏️ 새 학생 등록</h2>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={(event) => void handleCreateSubmit(event)}>
            <div>
              <label htmlFor="createName" className="block text-xs font-medium text-gray-500">
                이름 *
              </label>
              <input
                id="createName"
                type="text"
                value={createForm.name}
                onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="createGrade" className="block text-xs font-medium text-gray-500">
                학년 *
              </label>
              <input
                id="createGrade"
                type="text"
                value={createForm.grade}
                onChange={(event) => setCreateForm({ ...createForm, grade: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="createClass" className="block text-xs font-medium text-gray-500">
                반 *
              </label>
              <input
                id="createClass"
                type="text"
                value={createForm.class}
                onChange={(event) => setCreateForm({ ...createForm, class: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="createNumber" className="block text-xs font-medium text-gray-500">
                번호
              </label>
              <input
                id="createNumber"
                type="text"
                value={createForm.studentNumber}
                onChange={(event) => setCreateForm({ ...createForm, studentNumber: event.target.value })}
                className={inputClass}
              />
            </div>

            {createError && <p className="text-sm text-red-600 sm:col-span-4">{createError}</p>}

            {duplicateWarning && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-4">
                이름·학년·반·번호가 같은 재학생이 이미 있습니다. 그래도 새로 등록할까요?
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreateSubmit(null, true)}
                    disabled={createSubmitting}
                    className={secondaryButtonClass}
                  >
                    그래도 등록
                  </button>
                  <button type="button" onClick={() => setDuplicateWarning(null)} className="text-xs text-gray-500">
                    취소
                  </button>
                </div>
              </div>
            )}

            <div className="sm:col-span-4">
              <button type="submit" disabled={createSubmitting} className={`${primaryButtonClass} w-full`}>
                {createSubmitting ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="space-y-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">학생 목록을 불러오는 중입니다...</p>
        ) : loadError ? (
          <div className="space-y-2 py-8 text-center text-sm text-red-600">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadStudents()} className={secondaryButtonClass}>
              다시 시도
            </button>
          </div>
        ) : students.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">조건에 맞는 학생이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2">이름</th>
                  <th className="py-2 pr-2">학년</th>
                  <th className="py-2 pr-2">반</th>
                  <th className="py-2 pr-2">번호</th>
                  <th className="py-2 pr-2">재학상태</th>
                  <th className="py-2 pr-2">수정일</th>
                  <th className="py-2 pr-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) =>
                  editingUuid === student.studentUuid ? (
                    <tr key={student.studentUuid} className="border-b border-gray-100 bg-gray-50">
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={editForm.grade}
                          onChange={(event) => setEditForm({ ...editForm, grade: event.target.value })}
                          className="w-14 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={editForm.class}
                          onChange={(event) => setEditForm({ ...editForm, class: event.target.value })}
                          className="w-14 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={editForm.studentNumber}
                          onChange={(event) => setEditForm({ ...editForm, studentNumber: event.target.value })}
                          className="w-14 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2 text-gray-400">-</td>
                      <td className="py-2 pr-2 text-gray-400">-</td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-col gap-1">
                          {editError && <p className="text-xs text-red-600">{editError}</p>}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleEditSubmit(student.studentUuid)}
                              disabled={editSubmitting}
                              className="text-xs font-semibold text-brand-700"
                            >
                              {editSubmitting ? '저장 중...' : '저장'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUuid(null)}
                              className="text-xs text-gray-500"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={student.studentUuid} className="border-b border-gray-100">
                      <td className="py-2 pr-2 text-gray-900">{student.name}</td>
                      <td className="py-2 pr-2 text-gray-700">{student.grade}</td>
                      <td className="py-2 pr-2 text-gray-700">{student.class}</td>
                      <td className="py-2 pr-2 text-gray-700">{student.studentNumber || '-'}</td>
                      <td className="py-2 pr-2">
                        <Badge tone={student.enrollmentStatus === '비활성' ? 'neutral' : 'success'}>
                          {student.enrollmentStatus || '확인 필요'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-2 text-xs text-gray-500">
                        {student.updatedAt ? new Date(student.updatedAt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(student)}
                            className="text-xs font-semibold text-brand-700"
                          >
                            수정
                          </button>
                          {student.enrollmentStatus === '비활성' ? (
                            <button
                              type="button"
                              onClick={() => void handleRestore(student)}
                              disabled={actionInFlight === student.studentUuid}
                              className="text-xs font-semibold text-brand-700"
                            >
                              복원
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleDeactivate(student)}
                              disabled={actionInFlight === student.studentUuid}
                              className="text-xs text-red-600"
                            >
                              비활성 처리
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
