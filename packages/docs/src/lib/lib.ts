import * as React from 'react'
import { ServerSettings } from '@ograf-server/shared'

export function getServerUrl(): string {
	if (window.location.host.includes(':8084')) {
		return `http://localhost:8080`
	} else {
		return window.location.origin
	}
}

export async function getServerSettings(): Promise<ServerSettings> {
	const response = await fetch(`${getServerUrl()}/serverApi/server-settings`)

	const json = await response.json()

	if (!json.settings) throw new Error('Invalid server settings response, missing settings field')
	return json.settings
}

export function usePromise<T>(cb: () => Promise<T>): { data: T | null; error: Error | null } {
	const [data, setData] = React.useState<T | null>(null)
	const [error, setError] = React.useState<Error | null>(null)
	React.useEffect(() => {
		let isMounted = true
		cb().then(
			(result) => {
				if (isMounted) setData(result)
			},
			(err) => {
				if (isMounted) setError(err instanceof Error ? err : new Error(`${err}`))
			}
		)
		return () => {
			isMounted = false
		}
	}, [])
	return { data, error }
}
