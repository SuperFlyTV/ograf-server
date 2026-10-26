import { OgrafApi } from './ografApi.js'
import { serverDataStore } from '../stores/serverData.js'

export async function uploadGraphicZip(file: File): Promise<string[]> {
	if (!file.name.toLowerCase().endsWith('.zip')) {
		throw new Error('Please select or drop a valid .zip archive.')
	}

	const formData = new FormData()
	formData.append('graphic', file)

	const ografApi = OgrafApi.getSingleton()
	let baseUrl = ografApi.baseURL.replace('/ograf/v1', '')
	if (!baseUrl.endsWith('/')) baseUrl += '/'

	const response = await fetch(`${baseUrl}serverApi/internal/graphics/graphic`, {
		method: 'POST',
		body: formData,
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(text || response.statusText)
	}

	const json = (await response.json()) as { graphics?: Array<{ name?: string; id?: string }> }
	const uploadedIds: string[] = []
	if (Array.isArray(json.graphics)) {
		for (const gfx of json.graphics) {
			const id = gfx.name || gfx.id
			if (id) uploadedIds.push(id)
		}
	}

	serverDataStore.triggerReloadData(true)

	return uploadedIds
}
