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

/**
 * Default container resolution targeted by cards in the UI (standard 16:9 thumbnail preview)
 */
export const DEFAULT_TARGET_RESOLUTION: TargetResolution = {
	width: 480,
	height: 270,
}

/**
 * Select the most appropriate thumbnail from a list of thumbnails based on the target display resolution.
 *
 * It evaluates candidates based on:
 * 1. Aspect ratio match: Minimizes letterboxing/pillarboxing/distortion against the container's aspect ratio.
 * 2. Resolution fit: Prefers thumbnails that are sharp enough for the target display without being unnecessarily huge.
 */
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

			// 1. Aspect ratio penalty (scale 0..1+ where 0 means perfect aspect match)
			const aspectDiff = Math.abs(aspect - targetAspect) / Math.max(aspect, targetAspect)
			const aspectCost = aspectDiff * 10 // Weighted heavily to match container shape

			// 2. Resolution cost
			let resCost = 0
			if (w >= targetWidth && h >= targetHeight) {
				// Sufficient resolution - mild cost for unnecessarily huge images to save bandwidth
				const scaleOver = Math.max(w / targetWidth, h / targetHeight)
				resCost = 0.5 * Math.log2(scaleOver)
			} else {
				// Undersized image - penalty for blurriness/low quality
				const scaleUnder = Math.max(targetWidth / w, targetHeight / h)
				resCost = 2.0 * Math.log2(scaleUnder)
			}

			const totalCost = aspectCost + resCost

			if (totalCost < lowestCost) {
				lowestCost = totalCost
				bestThumbnail = thumbnail
			}
		} else {
			// Thumbnail without resolution specified: fallback cost
			const fallbackCost = 50
			if (fallbackCost < lowestCost) {
				lowestCost = fallbackCost
				bestThumbnail = thumbnail
			}
		}
	}

	return bestThumbnail
}

/**
 * Generate full URL to load a graphic resource/thumbnail from the OGraf server.
 */
export function getGraphicThumbnailUrl(serverApiUrl: string, graphicId: string, thumbnailFile: string): string {
	if (!thumbnailFile) return ''
	if (/^https?:\/\//i.test(thumbnailFile) || thumbnailFile.startsWith('data:')) {
		return thumbnailFile
	}

	let baseUrl = serverApiUrl.replace(/\/ograf\/v1\/?$/, '')
	if (!baseUrl.endsWith('/')) baseUrl += '/'

	const cleanLocalPath = thumbnailFile.replace(/^\/+/, '')
	return `${baseUrl}serverApi/internal/graphics/${encodeURIComponent(graphicId)}/${cleanLocalPath}`
}
