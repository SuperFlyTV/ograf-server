import * as React from 'react'
import { getDefaultDataFromSchema } from 'ograf-form'

interface OgrafFormAttributes<T> extends React.HTMLAttributes<T> {
	schema?: unknown
	value?: unknown
	formStyle?: string
	dictionary?: any
	getGDDElement?: () => any
	postRender?: () => any
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
	namespace JSX {
		interface IntrinsicElements {
			'superflytv-ograf-form': React.DetailedHTMLProps<OgrafFormAttributes<HTMLElement>, HTMLElement>
		}
	}

	namespace React {
		namespace JSX {
			interface IntrinsicElements {
				['superflytv-ograf-form']: React.DetailedHTMLProps<OgrafFormAttributes<HTMLElement>, HTMLElement>
			}
		}
	}
}

export const OGrafForm: React.FC<{
	schema: unknown
	initialValue?: unknown
	value?: unknown
	onDataChangeCallback: (data: unknown) => void
}> = ({ schema, initialValue, value, onDataChangeCallback }) => {
	const formRef = React.useRef<HTMLElement>(null)
	const onDataChangeCallbackRef = React.useRef(onDataChangeCallback)
	onDataChangeCallbackRef.current = onDataChangeCallback

	const [data, setData] = React.useState(() =>
		value !== undefined ? value : initialValue ? initialValue : schema ? getDefaultDataFromSchema(schema) : {}
	)

	React.useEffect(() => {
		if (value !== undefined) setData(value)
	}, [value])

	const onDataChange = React.useCallback((newData: unknown) => {
		setData(newData)
		onDataChangeCallbackRef.current(newData)
	}, [])

	React.useLayoutEffect(() => {
		if (formRef.current) {
			const listener = (e: any) => {
				if (e.target !== formRef.current) return
				onDataChange(e.target.value)
			}
			const el = formRef.current
			el.addEventListener('change', listener)
			return () => {
				el.removeEventListener('change', listener)
			}
		}
		return
	})

	if (!schema) {
		return <div>No schema.</div>
	}

	return (
		<div style={{ overflow: 'auto', minWidth: 340, width: '100%', maxWidth: '100%' }}>
			<superflytv-ograf-form
				ref={formRef}
				schema={schema}
				value={data}
				style={{ display: 'block', width: '100%', maxWidth: '100%' }}
			></superflytv-ograf-form>
		</div>
	)
}
