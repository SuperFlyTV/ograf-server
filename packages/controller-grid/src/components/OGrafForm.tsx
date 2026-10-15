import * as React from 'react'
import { getDefaultDataFromSchema } from 'ograf-form'
import { applyHiddenPropertiesToSchema } from '../lib/schemaUtils.js'

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
	hiddenProperties?: string[]
	hideFieldLabels?: boolean
	compact?: boolean
	initialValue?: unknown
	value?: unknown
	onDataChangeCallback: (data: unknown) => void
}> = ({ schema, hiddenProperties, hideFieldLabels, compact, initialValue, value, onDataChangeCallback }) => {
	const formRef = React.useRef<HTMLElement>(null)
	const onDataChangeCallbackRef = React.useRef(onDataChangeCallback)
	onDataChangeCallbackRef.current = onDataChangeCallback

	const effectiveSchema = React.useMemo(() => {
		return applyHiddenPropertiesToSchema(schema, hiddenProperties)
	}, [schema, hiddenProperties])

	const [data, setData] = React.useState(() =>
		value !== undefined ? value : initialValue ? initialValue : schema ? getDefaultDataFromSchema(schema as any) : {}
	)

	React.useEffect(() => {
		if (value !== undefined) setData(value)
	}, [value])

	const applyDomVisibility = React.useCallback(() => {
		const el = formRef.current
		if (!el) return

		// Apply `hidden: true` from schema to gdd-object-property DOM elements
		const propEls = el.querySelectorAll('gdd-object-property')
		for (const rawEl of Array.from(propEls)) {
			const propEl = rawEl as HTMLElement & {
				schema?: { hidden?: boolean }
				content?: {
					label?: HTMLElement
					description?: HTMLElement
				}
			}
			if (propEl.schema && propEl.schema.hidden === true) {
				propEl.style.display = 'none'
			} else {
				propEl.style.display = 'block'
				if (compact) {
					propEl.style.margin = '0.2em 0'
				}
			}

			if (propEl.content?.label) {
				propEl.content.label.style.display = hideFieldLabels ? 'none' : 'inline-block'
			}
			if (propEl.content?.description) {
				propEl.content.description.style.display = compact || hideFieldLabels ? 'none' : 'block'
			}
		}
	}, [compact, hideFieldLabels])

	const onDataChange = React.useCallback((newData: unknown) => {
		setData(newData)
		onDataChangeCallbackRef.current(newData)
	}, [])

	React.useLayoutEffect(() => {
		const el = formRef.current as any
		if (!el) return

		el.postRender = () => {
			applyDomVisibility()
		}
		applyDomVisibility()

		const listener = (e: any) => {
			if (e.target !== formRef.current) return
			onDataChange(e.target.value)
		}
		el.addEventListener('change', listener)
		return () => {
			el.removeEventListener('change', listener)
		}
	}, [applyDomVisibility, onDataChange, effectiveSchema])

	if (!effectiveSchema) {
		return <div>No schema.</div>
	}

	return (
		<div
			style={{ overflow: 'auto', maxWidth: '100%' }}
			onPointerDown={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
		>
			<superflytv-ograf-form
				ref={formRef}
				schema={effectiveSchema}
				value={data}
				style={{ display: 'block', maxWidth: '100%' }}
			></superflytv-ograf-form>
		</div>
	)
}
