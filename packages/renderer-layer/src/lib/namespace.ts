export function getDefaultServerUrl(baseName = 'api'): string {
	{
		// Using namespace mode
		const namespaceId = getNameSpaceId()
		if (namespaceId) return `${window.location.origin}/${baseName}/${namespaceId}`
	}
	{
		// Using non-namespace mode
		const m = window.location.pathname.match(/^\/renderer\/default/)
		if (m && m.groups) {
			return `${window.location.origin}/${baseName}`
		}
	}

	// In development-mode
	return `http://localhost:8080/${baseName}`
}

export function getNameSpaceId(): string {
	{
		// Using namespace mode
		// window.location.pathname = "/controller/large-wasteful-starfish/default/"
		const m = window.location.pathname.match(/^\/renderer\/(?<namespaceId>[^/]*)\/default/)
		if (m && m.groups) {
			return m.groups.namespaceId
		}
	}
	return ''
}
