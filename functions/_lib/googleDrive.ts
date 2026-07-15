import { GoogleApiError, readErrorDetail } from './googleApiError'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

async function driveFetch(accessToken: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${DRIVE_API}${path}`, {
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
  if (response.status === 204) return null
  return response.json()
}

/**
 * 지정한 부모 폴더 바로 아래에서 이름이 정확히 일치하는 폴더를 찾는다. drive.file
 * 스코프에서는 이 앱이 생성한(또는 사용자가 명시적으로 공유한) 파일만 조회되므로,
 * 이 질의는 "전체 Drive 검색"이 아니라 이 앱이 이전에 만든 리소스를 재확인하는
 * 용도로만 쓰인다(18.3절 "Drive 파일 목록 전체 조회 금지"와 상충하지 않음).
 */
export async function findFolderByName(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string | null> {
  const q = `name = '${name}' and mimeType = '${FOLDER_MIME_TYPE}' and '${parentId}' in parents and trashed = false`
  const data = (await driveFetch(
    accessToken,
    `/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&pageSize=1`,
  )) as { files?: { id: string }[] }
  return data.files?.[0]?.id ?? null
}

export async function createFolder(accessToken: string, name: string, parentId: string): Promise<string> {
  const data = (await driveFetch(accessToken, '/files?fields=id', {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, parents: [parentId] }),
  })) as { id: string }
  return data.id
}

export async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string> {
  const existing = await findFolderByName(accessToken, name, parentId)
  if (existing) return existing
  return createFolder(accessToken, name, parentId)
}

/** 폴더/파일이 여전히 존재하고 휴지통에 있지 않은지 확인한다(재시도 시 저장된 ID 검증용). */
export async function fileExists(accessToken: string, fileId: string): Promise<boolean> {
  try {
    const data = (await driveFetch(accessToken, `/files/${fileId}?fields=id,trashed`)) as {
      trashed?: boolean
    }
    return data.trashed !== true
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 404) return false
    throw error
  }
}

export async function moveFileToRootFolder(
  accessToken: string,
  fileId: string,
  newParentId: string,
): Promise<void> {
  await driveFetch(
    accessToken,
    `/files/${fileId}?addParents=${newParentId}&removeParents=root&fields=id`,
    { method: 'PATCH', body: JSON.stringify({}) },
  )
}

/**
 * 동시 요청 경쟁에서 진 쪽이 방금 만든 중복 파일을 정리할 때 쓴다(휴지통 이동,
 * 영구 삭제 아님) — 사용자가 원하면 휴지통에서 직접 복구할 수 있게 남겨 둔다.
 */
export async function trashFile(accessToken: string, fileId: string): Promise<void> {
  await driveFetch(accessToken, `/files/${fileId}?fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({ trashed: true }),
  })
}
