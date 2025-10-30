import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import { appSettingsStore } from '../stores/appSettings.js'
import Typography from '@mui/material/Typography'
import * as OGraf from '../lib/ograf/server-api.js'
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
		renderer: OGraf.components['schemas']['RendererInfo']

		action: OGraf.components['schemas']['action']
	}) => {
		const [data, setData] = useStoredState<string>(
			`renderer-${props.renderer.id}-custom-action-${props.action.id}-data`
		)

		const invokeAction = () => {
			const ografApi = OgrafApi.getSingleton()
			ografApi
				.rendererInvokeCustomAction(
					{
						rendererId: props.renderer.id,
						customActionId: props.action.id,
					},
					{
						payload: data,
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
						initialValue={data === undefined ? undefined : JSON.parse(data)}
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
