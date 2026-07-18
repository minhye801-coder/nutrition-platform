import { GoogleApiError, readErrorDetail } from './googleApiError'
import { moveFileToRootFolder, trashFile, uploadFile } from './googleDrive'

const DOCS_API = 'https://docs.googleapis.com/v1/documents'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'

async function docsFetch(accessToken: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${DOCS_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new GoogleApiError('drive', response.status, await readErrorDetail(response))
  }
  return response.json()
}

/**
 * legacy `createConsentPdf_`(intake-consent/code.gs.txt:183-217)와 동일한 절차를 REST로
 * 재현한다 — Apps Script는 `DocumentApp.create()`로 문서를 만들지만, 여기서는 Docs API로
 * 문서를 만들고 텍스트를 채운 뒤 Drive API의 export로 PDF를 뽑는다. 이미 갖고 있는
 * `drive.file` 스코프로 충분하다(이 앱이 직접 만든 파일이므로). 원본 Google Docs 파일은
 * PDF로 내보낸 뒤 휴지통으로 보낸다(legacy와 동일 — 영구 삭제 아님).
 */
export async function createTextPdf(
  accessToken: string,
  targetFolderId: string,
  title: string,
  bodyLines: string[],
): Promise<{ fileId: string; pdfUrl: string }> {
  const created = (await docsFetch(accessToken, '', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })) as { documentId: string }
  const documentId = created.documentId

  await docsFetch(accessToken, `/${documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: bodyLines.join('\n') } }],
    }),
  })

  // 새로 만든 문서는 기본적으로 "내 드라이브" 루트에 생성되므로, 케이스 폴더로 옮긴다
  // (setupOrchestrator.ts가 신규 Spreadsheet를 옮길 때 쓰는 것과 동일한 함수).
  await moveFileToRootFolder(accessToken, documentId, targetFolderId)

  const exportResponse = await fetch(`${DRIVE_API}/files/${documentId}/export?mimeType=application/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!exportResponse.ok) {
    throw new GoogleApiError('drive', exportResponse.status, await readErrorDetail(exportResponse))
  }
  const pdfBytes = await exportResponse.arrayBuffer()

  const pdfFile = await uploadFile(accessToken, `${title}.pdf`, targetFolderId, 'application/pdf', pdfBytes)

  // 원본 Docs 파일은 PDF로 내보낸 뒤엔 필요 없다 — legacy도 휴지통으로만 보낸다(영구 삭제 아님).
  await trashFile(accessToken, documentId)

  return { fileId: pdfFile.id, pdfUrl: pdfFile.webViewLink }
}
