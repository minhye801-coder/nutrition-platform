/** POST /api/account/confirm-school-use — 서버가 accountMode를 다시 검증한 뒤에만 반영한다. */
export async function confirmSchoolUse(): Promise<boolean> {
  const response = await fetch('/api/account/confirm-school-use', {
    method: 'POST',
    credentials: 'include',
  })
  return response.ok
}
