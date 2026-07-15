import { GoogleApiError, readErrorDetail } from './googleApiError'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

async function sheetsFetch(accessToken: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new GoogleApiError('sheets', response.status, await readErrorDetail(response))
  }
  return response.json()
}

/** 지정한 탭 제목들을 가진 새 Spreadsheet를 한 번의 호출로 생성한다. */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
  sheetTitles: string[],
): Promise<string> {
  const data = (await sheetsFetch(accessToken, '', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: sheetTitles.map((sheetTitle) => ({ properties: { title: sheetTitle } })),
    }),
  })) as { spreadsheetId: string }
  return data.spreadsheetId
}

export interface ValueRange {
  range: string
  values: (string | number)[][]
}

/** 여러 탭의 값을 batchUpdate 한 번으로 기록한다(18.3절 "batchGet/batchUpdate 우선"). */
export async function batchWriteValues(
  accessToken: string,
  spreadsheetId: string,
  data: ValueRange[],
): Promise<void> {
  await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  })
}

/** Spreadsheet가 여전히 존재하는지 최소 필드로만 확인한다(재시도 시 저장된 ID 검증용). */
export async function spreadsheetExists(accessToken: string, spreadsheetId: string): Promise<boolean> {
  try {
    await sheetsFetch(accessToken, `/${spreadsheetId}?fields=spreadsheetId`)
    return true
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 404) return false
    throw error
  }
}
