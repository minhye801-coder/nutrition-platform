export interface NavItem {
  label: string
  path: string
  /** true면 외부 URL로 취급해 <a target="_blank">로 렌더링한다. */
  external?: boolean
  /** true면 라우트/링크로 이동하지 않고 "준비 중" 안내만 보여준다. */
  comingSoon?: boolean
}
