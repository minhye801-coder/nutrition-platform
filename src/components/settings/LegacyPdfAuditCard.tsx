import { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import {
  fetchLegacyAssessmentPdfs,
  trashLegacyAssessmentPdfs,
  type LegacyPdfAuditItem,
} from '@/services/legacyPdfAuditService'

const DRIVE_STATUS_LABEL: Record<LegacyPdfAuditItem['driveStatus'], string> = {
  found: 'Drive에 있음',
  trashed: '이미 휴지통에 있음',
  not_found: '찾을 수 없음(이미 삭제되었거나 접근 권한 없음)',
  error: '조회 오류',
}

/**
 * 요구사항 1절 — 개인정보 보호 구조 확정 이전에 만들어진 원본 진단검사 PDF가
 * Drive에 남아 있을 수 있다. 이 화면은 목록만 보여주고 절대 자동으로 삭제하지
 * 않는다: [목록 확인] → [필요하면 Drive에서 열어 백업/다운로드] → [관리자가 선택한
 * 파일만 휴지통으로 이동]. 휴지통 이동은 Drive 자체 휴지통 보관 기간 동안 복구할 수
 * 있다(영구 삭제 아님).
 */
export function LegacyPdfAuditCard() {
  const [items, setItems] = useState<LegacyPdfAuditItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [trashing, setTrashing] = useState(false)
  const [resultMessage, setResultMessage] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchLegacyAssessmentPdfs()
      setItems(result)
    } catch {
      setLoadError('점검 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function toggle(fileId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  async function handleTrashSelected() {
    if (selected.size === 0 || trashing) return
    const confirmed = window.confirm(
      `선택한 ${selected.size}개 파일을 Drive 휴지통으로 이동합니다. 계속하기 전에 필요한 파일은 미리 열어서 백업/다운로드했는지 확인해 주세요. 계속할까요?`,
    )
    if (!confirmed) return

    setTrashing(true)
    setResultMessage('')
    try {
      const results = await trashLegacyAssessmentPdfs([...selected])
      const okCount = results.filter((r) => r.ok).length
      const failCount = results.length - okCount
      setResultMessage(
        failCount === 0
          ? `${okCount}개 파일을 휴지통으로 이동했습니다.`
          : `${okCount}개는 휴지통으로 이동했고, ${failCount}개는 실패했습니다. 잠시 후 다시 시도해 주세요.`,
      )
      setSelected(new Set())
      await load()
    } catch {
      setResultMessage('휴지통 이동 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setTrashing(false)
    }
  }

  if (!loading && items && items.length === 0 && !loadError) return null

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">기존 원본 진단검사 PDF 점검</h2>
        <Badge tone="warning">개인정보 점검</Badge>
      </div>
      <p className="text-sm text-gray-600">
        개인정보 보호 구조를 적용하기 전에 Drive에 저장된 원본 진단검사 PDF 목록입니다. 새로운 검사결과는 더 이상
        원본 PDF를 Drive에 저장하지 않지만, 기존 파일은 자동으로 삭제되지 않습니다. 필요한 파일은 먼저 Drive에서
        열어 백업하거나 내려받은 뒤, 삭제할 파일만 직접 선택해 휴지통으로 옮겨 주세요(영구 삭제가 아니라 Drive
        휴지통 보관 기간 동안 복구할 수 있습니다).
      </p>

      {loading ? (
        <p className="py-4 text-center text-sm text-gray-500">불러오는 중...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : items && items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2" />
                  <th className="py-2 pr-2">파일명</th>
                  <th className="py-2 pr-2">생성일</th>
                  <th className="py-2 pr-2">StudentID</th>
                  <th className="py-2 pr-2">Drive 폴더 위치</th>
                  <th className="py-2 pr-2">비식별 분석 결과</th>
                  <th className="py-2 pr-2">Drive 상태</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.fileId} className="border-b border-gray-100">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(item.fileId)}
                        onChange={() => toggle(item.fileId)}
                        disabled={item.driveStatus === 'not_found' || item.driveStatus === 'trashed'}
                      />
                    </td>
                    <td className="py-2 pr-2 text-gray-900">{item.fileName || '(파일명 확인 불가)'}</td>
                    <td className="py-2 pr-2 text-gray-600">{item.createdAt.slice(0, 10) || '-'}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-gray-600">{item.studentIdMasked}</td>
                    <td className="py-2 pr-2 text-gray-600">{item.driveLocation}</td>
                    <td className="py-2 pr-2 text-gray-600">{item.hasStructuredResult ? '있음' : '없음'}</td>
                    <td className="py-2 pr-2 text-gray-600">{DRIVE_STATUS_LABEL[item.driveStatus]}</td>
                    <td className="py-2 pr-2 text-right">
                      {item.webViewLink && (
                        <a
                          href={item.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Drive에서 열기
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => void handleTrashSelected()}
              disabled={selected.size === 0 || trashing}
              className={primaryButtonClass}
            >
              {trashing ? '휴지통으로 이동 중...' : `선택한 ${selected.size}개 파일 휴지통으로 이동`}
            </button>
            <button type="button" onClick={() => void load()} className={secondaryButtonClass}>
              새로고침
            </button>
          </div>
          {resultMessage && <p className="text-xs text-gray-600">{resultMessage}</p>}

          <p className="text-xs text-gray-400">
            수동으로 정리하려면 Google Drive에서 학교 작업공간 폴더 &gt; 각 상담연도 폴더 &gt; 케이스 폴더 &gt;
            "03_공식진단" 폴더를 직접 열어 파일을 확인한 뒤 휴지통으로 이동할 수도 있습니다.
          </p>
        </>
      ) : null}
    </Card>
  )
}
