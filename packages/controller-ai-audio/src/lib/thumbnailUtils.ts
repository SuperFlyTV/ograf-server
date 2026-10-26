export interface GraphicThumbnail {
	file: string
	resolution?: {
		width: number
		height: number
		[key: string]: unknown
	}
	[key: string]: unknown
}

export interface TargetResolution {
	width: number
	height: number
}

export const DEFAULT_TARGET_RESOLUTION: TargetResolution = {
	width: 160,
	height: 90,
}

export function pickAppropriateThumbnail(
	thumbnails?: GraphicThumbnail[] | null,
	targetResolution: TargetResolution = DEFAULT_TARGET_RESOLUTION
): GraphicThumbnail | undefined {
	if (!thumbnails || thumbnails.length === 0) {
		return undefined
	}

	if (thumbnails.length === 1) {
		return thumbnails[0]
	}

	const targetWidth = Math.max(1, targetResolution.width)
	const targetHeight = Math.max(1, targetResolution.height)
	const targetAspect = targetWidth / targetHeight

	let bestThumbnail: GraphicThumbnail = thumbnails[0]
	let lowestCost = Number.POSITIVE_INFINITY

	for (const thumbnail of thumbnails) {
		if (!thumbnail || !thumbnail.file) continue

		if (
			thumbnail.resolution &&
			typeof thumbnail.resolution.width === 'number' &&
			typeof thumbnail.resolution.height === 'number' &&
			thumbnail.resolution.width > 0 &&
			thumbnail.resolution.height > 0
		) {
			const w = thumbnail.resolution.width
			const h = thumbnail.resolution.height
			const aspect = w / h

			const aspectDiff = Math.abs(aspect - targetAspect) / Math.max(aspect, targetAspect)
			const aspectCost = aspectDiff * 10

			let resCost = 0
			if (w >= targetWidth && h >= targetHeight) {
				const scaleOver = Math.max(w / targetWidth, h / targetHeight)
				resCost = 0.5 * Math.log2(scaleOver)
			} else {
				const scaleUnder = Math.max(targetWidth / w, targetHeight / h)
				resCost = 2.0 * Math.log2(scaleUnder)
			}

			const totalCost = aspectCost + resCost

			if (totalCost < lowestCost) {
				lowestCost = totalCost
				bestThumbnail = thumbnail
			}
		} else {
			const fallbackCost = 50
			if (fallbackCost < lowestCost) {
				lowestCost = fallbackCost
				bestThumbnail = thumbnail
			}
		}
	}

	return bestThumbnail
}

export function getGraphicThumbnailUrl(serverApiUrl: string, graphicId: string, thumbnailFile: string): string {
	if (!thumbnailFile) return ''
	if (/^https?:\/\//i.test(thumbnailFile) || thumbnailFile.startsWith('data:')) {
		return thumbnailFile
	}

	return `${serverApiUrl}graphics/${encodeURIComponent(graphicId)}/thumbnail?file=${encodeURIComponent(thumbnailFile)}`
}
