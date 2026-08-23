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
	/** Ref to the form component */
	const formRef = React.useRef<HTMLElement>(null)
	/** State to hold the data */
	const [data, setData] = React.useState(() =>
		// Use default data from schema as initial data:
		initialValue ? initialValue : schema ? getDefaultDataFromSchema(schema) : {}
	)

	React.useEffect(() => {
		// Initial callback with data

		onDataChangeCallback(data)
	}, [])

	React.useEffect(() => {
		if (value !== undefined) setData(value)
	}, [value])

	/** Callback when the data changes */
	const onDataChange = React.useCallback((newData: unknown) => {
		setData(newData)
		onDataChangeCallback(newData)
	}, [])

	// Set up listener for when the data has changed in the form:
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
	// (Optional) Set up listener for whenever user is editing (ie every key)
	// React.useLayoutEffect(() => {
	//   if (formRef.current) {
	//     const listener = (e) => onDataChange(e.target.value);
	//     formRef.current.addEventListener("keyup", listener);
	//     return () => formRef.current.removeEventListener("keyup", listener);
	//   }
	// });

	if (!schema) {
		return <div>No schema.</div>
	}

	return (
		<div>
			<superflytv-ograf-form ref={formRef} schema={schema} value={data}></superflytv-ograf-form>
		</div>
	)
}
