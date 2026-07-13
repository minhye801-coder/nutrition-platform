export const onRequestGet: PagesFunction = async () => {
  return Response.json({
    status: 'ok',
    service: 'nutrition-counseling-ai-plus',
  })
}
