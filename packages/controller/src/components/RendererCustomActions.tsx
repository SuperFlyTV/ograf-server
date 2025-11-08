import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import { appSettingsStore } from '../stores/appSettings.js'
import Typography from '@mui/material/Typography'
import * as OGraf from 'ograf'
import Button from '@mui/material/Button'
import { OGrafForm } from './OGrafForm.js'
import { useStoredState } from '../lib/lib.js'
import { OgrafApi } from '../lib/ografApi.js'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'

export const RendererCustomActions: React.FC = observer(() => {
	const selectedRenderer = appSettingsStore.getSelectedRenderer()

	if (!selectedRenderer) return

	if (!selectedRenderer.customActions) return
	if (selectedRenderer.customActions.length === 0) return

	return (
		<Box sx={{ m: 1, p: 1 }}>
			<Typography variant="h5">Renderer Actions</Typography>
			<>
				{selectedRenderer.customActions.map((action) => (
					<RendererCustomAction key={action.id} action={action} renderer={selectedRenderer} />
				))}
			</>
		</Box>
	)
})

export const RendererCustomAction = observer(
	(props: {
		renderer: OGraf.ServerApi.components['schemas']['RendererInfo']

		action: OGraf.ServerApi.components['schemas']['action']
	}) => {
		const [data0, setData] = useStoredState<string>(
			`renderer-${props.renderer.id}-custom-action-${props.action.id}-data`
		)
		const dataStr = typeof data0 !== 'string' ? JSON.stringify(data0) : data0

		const invokeAction = () => {
			const ografApi = OgrafApi.getSingleton()

			ografApi
				.rendererInvokeCustomAction(
					{
						rendererId: props.renderer.id,
						customActionId: props.action.id,
					},
					{
						payload: JSON.parse(dataStr),
						// skipAnimation:
					}
				)
				.catch(console.error)
		}

		return (
			<Card elevation={1} sx={{ m: 1, p: 1 }}>
				<CardHeader title={props.action.name} subheader={props.action.description} />
				<CardContent>
					<OGrafForm
						schema={props.action.schema}
						value={dataStr === undefined ? undefined : JSON.parse(dataStr)}
						onDataChangeCallback={(newData: unknown) => {
							setData(JSON.stringify(newData))
						}}
					/>
					<Button variant="contained" onClick={invokeAction}>
						{props.action.name}
					</Button>
				</CardContent>
			</Card>
		)
	}
)
