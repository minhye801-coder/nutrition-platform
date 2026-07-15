/**
 * Google Drive/Sheets REST 호출 실패를 감싸는 에러. 원본 응답 본문은 `detail`에
 * 담아 서버 로그(console.error)에서만 사용하고, 라우트 핸들러가 클라이언트로
 * 내려보내는 메시지에는 절대 포함하지 않는다(토큰/요청 세부정보 노출 방지).
 */
export class GoogleApiError extends Error {
  readonly api: 'drive' | 'sheets'
  readonly status: number
  readonly detail: string

  constructor(api: 'drive' | 'sheets', status: number, detail: string) {
    super(`Google ${api} API error: ${status}`)
    this.name = 'GoogleApiError'
    this.api = api
    this.status = status
    this.detail = detail
  }
}

export async function readErrorDetail(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
