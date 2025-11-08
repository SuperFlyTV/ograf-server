import * as React from 'react'
import { LayerHandler } from '../lib/LayerHandler.js'

export const Layer: React.FC<{ layerHandler: LayerHandler }> = ({ layerHandler }) => {
	const refElement = React.useRef<HTMLDivElement>(null)

	React.useLayoutEffect(() => {
		layerHandler.setRef(refElement.current)
	})

	return (
		<div
			ref={refElement}
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: layerHandler.zIndex,
			}}
		></div>
	)
}
