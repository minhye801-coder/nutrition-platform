import { useState } from 'react'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { PlaceholderNotice } from '@/components/common/PlaceholderNotice'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'

export function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState('')
  const [connectClicked, setConnectClicked] = useState(false)
  const [saveClicked, setSaveClicked] = useState(false)

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
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">학교명</dt>
            <dd className="text-gray-800">구미봉곡초등학교 (샘플)</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">담당자명</dt>
            <dd className="text-gray-800">김영양 선생님 (샘플)</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">schoolPublicId</dt>
            <dd className="font-mono text-xs text-gray-500">SAMPLE-9F2K1A</dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Google 연결 상태</h2>
          <Badge tone="warning">연결되지 않음</Badge>
        </div>
        <p className="text-sm text-gray-600">
          Google 계정을 연결하면 본인의 Sheets/Drive에 데이터를 저장할 수
          있습니다.
        </p>
        <button
          type="button"
          onClick={() => setConnectClicked(true)}
          className={secondaryButtonClass}
        >
          Google 계정 연결
        </button>
        {connectClicked && (
          <PlaceholderNotice>
            Google 계정 연결 기능은 아직 준비 중입니다.
          </PlaceholderNotice>
        )}
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
