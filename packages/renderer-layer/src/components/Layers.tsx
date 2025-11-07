import * as React from 'react'
import { LayersManager } from '../lib/LayersManager.js'
import { Layer } from './Layer.js'

// Create 10 layers

export const Layers: React.FC<{ layersManager: LayersManager }> = ({ layersManager }) => {
	return (
		<>
			{layersManager.getAllLayers().map((layerHandler, index) => (
				<Layer key={index} layerHandler={layerHandler} />
			))}
		</>
	)
}
