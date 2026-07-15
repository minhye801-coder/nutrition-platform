import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { logout } from '@/services/authService'
import { updateManagerName } from '@/services/installationService'
import { useInstallation } from '@/hooks/useInstallation'
import type { SessionUser } from '@/types/session'

export function SettingsPage() {
  return <AuthGuard>{(user) => <SettingsContent user={user} />}</AuthGuard>
}

function ResourceLinkRow({
  label,
  description,
  href,
}: {
  label: string
  description: string
  href: string | null
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
          {label}
        </a>
      ) : (
        <button type="button" disabled className={secondaryButtonClass}>
          {label}
        </button>
      )}
      <span className="text-xs text-gray-500">{href ? description : '설치를 완료하면 열 수 있습니다.'}</span>
    </div>
  )
}

function SettingsContent({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const { installation, loading, refresh } = useInstallation()
  const [geminiKey, setGeminiKey] = useState('')
  const [saveClicked, setSaveClicked] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [editingManagerName, setEditingManagerName] = useState(false)
  const [managerNameInput, setManagerNameInput] = useState('')
  const [managerNameError, setManagerNameError] = useState('')
  const [savingManagerName, setSavingManagerName] = useState(false)

  // 설치 시 입력한 담당자명이 있으면 그 값을, 없으면 Google 프로필 이름을 fallback으로 표시한다.
  const displayManagerName = installation?.managerName || user.name

  function startEditingManagerName() {
    setManagerNameInput(displayManagerName)
    setManagerNameError('')
    setEditingManagerName(true)
  }

  async function handleSaveManagerName() {
    if (!managerNameInput.trim()) {
      setManagerNameError('담당자명을 입력해 주세요.')
      return
    }
    setSavingManagerName(true)
    setManagerNameError('')
    try {
      await updateManagerName(managerNameInput.trim())
      await refresh()
      setEditingManagerName(false)
    } catch {
      setManagerNameError('저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSavingManagerName(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
        <p className="mt-1 text-sm text-gray-600">
          학교 정보, Google 계정 연결, Gemini API Key를 관리합니다.
        </p>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-900">학교 정보</h2>
        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중입니다...</p>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">학교명</dt>
              <dd className="text-gray-800">
                {installation?.schoolName ?? '설치 후 표시됩니다'}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-gray-500">담당자명</dt>
              {editingManagerName ? (
                <dd className="flex items-center gap-2">
                  <input
                    type="text"
                    value={managerNameInput}
                    onChange={(event) => setManagerNameInput(event.target.value)}
                    className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveManagerName}
                    disabled={savingManagerName}
                    className="text-xs font-semibold text-brand-700"
                  >
                    {savingManagerName ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingManagerName(false)}
                    className="text-xs text-gray-500"
                  >
                    취소
                  </button>
                </dd>
              ) : (
                <dd className="flex items-center gap-2 text-gray-800">
                  {displayManagerName}
                  {installation && (
                    <button
                      type="button"
                      onClick={startEditingManagerName}
                      className="text-xs font-semibold text-brand-700"
                    >
                      수정
                    </button>
                  )}
                </dd>
              )}
            </div>
            {managerNameError && <p className="text-xs text-red-600">{managerNameError}</p>}

            <div className="flex items-center justify-between">
              <dt className="text-gray-500">schoolPublicId</dt>
              <dd className="font-mono text-xs text-gray-500">
                {installation?.schoolPublicId ?? '설치 후 표시됩니다'}
              </dd>
            </div>
          </dl>
        )}

        {!loading && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <ResourceLinkRow
              label="내 Google Drive 작업공간 열기"
              description="Google Drive에서 열기"
              href={installation?.driveFolderUrl ?? null}
            />
            <ResourceLinkRow
              label="데이터 Spreadsheet 열기"
              description="Google Sheets에서 열기"
              href={installation?.spreadsheetUrl ?? null}
            />
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Google 연결 상태</h2>
          <Badge tone="success">연결됨</Badge>
        </div>
        <p className="text-sm text-gray-600">{user.email} 계정으로 로그인되어 있습니다.</p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={secondaryButtonClass}
        >
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-900">Gemini API 설정</h2>
        <p className="text-sm text-gray-600">
          선생님 본인의 Gemini API Key를 등록하면 AI 상담 보조 기능을 사용할 수
          있습니다.
        </p>
        <div>
          <label
            htmlFor="geminiKey"
            className="block text-sm font-medium text-gray-700"
          >
            Gemini API Key
          </label>
          <input
            id="geminiKey"
            type="password"
            value={geminiKey}
            onChange={(event) => setGeminiKey(event.target.value)}
            placeholder="아직 저장되지 않습니다"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setSaveClicked(true)}
          className={primaryButtonClass}
        >
          저장
        </button>
        {saveClicked && (
          <PlaceholderNotice>
            Gemini API Key 저장 기능은 아직 연결되지 않았습니다. 입력한 값은
            어디에도 저장되지 않습니다.
          </PlaceholderNotice>
        )}
      </Card>
    </div>
  )
}
