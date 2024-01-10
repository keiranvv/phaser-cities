export function calculateCoordinateDimensions(
  points: { x: number; y: number }[]
) {
  if (!points || points.length === 0) {
    return { width: 0, height: 0 }
  }

  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y

  points.forEach((point) => {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
  })

  const width = maxX - minX + 1
  const height = maxY - minY + 1

  return { width, height }
}
