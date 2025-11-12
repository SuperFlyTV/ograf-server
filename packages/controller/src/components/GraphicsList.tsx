import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import { appSettingsStore, QueuedGraphic } from '../stores/appSettings.js'
import Typography from '@mui/material/Typography'
import * as OGraf from 'ograf'
import Button from '@mui/material/Button'
import { OGrafForm } from './OGrafForm.js'
import { clone, isEqual } from '../lib/lib.js'
import { OgrafApi } from '../lib/ografApi.js'
import Card from '@mui/material/Card'
import { serverDataStore } from '../stores/serverData.js'
import Close from '@mui/icons-material/Close'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import { runInAction, toJS } from 'mobx'

export const GraphicsList: React.FC = observer(() => {
	const entries = Array.from(appSettingsStore.queuedGraphics.entries()).sort((a, b) => {
		return a[1].rank - b[1].rank
	})

	return (
		<Box sx={{ m: 1, p: 1 }}>
			<Typography variant="h5">Graphics</Typography>
			<>
				{appSettingsStore.queuedGraphics.size === 0 ? (
					<>
						<Typography>No queued graphics yet, select one in the dropdown below to add it.</Typography>
					</>
				) : (
					entries.map(([key]) => <QueuedGraphicItem key={key} graphicKey={key} />)
				)}
			</>
		</Box>
	)
})

export const QueuedGraphicItem = observer((props: { graphicKey: string }) => {
	const queuedGraphic = appSettingsStore.queuedGraphics.get(props.graphicKey)
	if (!queuedGraphic) return null

	const graphic = serverDataStore.graphicsInfo.get(queuedGraphic.graphicId)
	const renderer = appSettingsStore.getSelectedRenderer()

	if (!graphic || !renderer) {
		return (
			<Card elevation={1} sx={{ m: 1, p: 1 }}>
				<Typography>Loading...</Typography>
			</Card>
		)
	}

	const graphicsInstances = Array.from(serverDataStore.graphicsInstanceMap.values())
		.filter(
			(gi) =>
				gi.graphicId === queuedGraphic.graphicId &&
				gi.rendererId === renderer?.id &&
				isEqual(gi.renderTarget, queuedGraphic.renderTarget)
		)
		.map((gi) => ({
			...gi,
			disabled: false,
		}))

	if (graphicsInstances.length === 0 && renderer) {
		// Add one, for visibility:
		graphicsInstances.push({
			rendererId: renderer.id,
			renderTarget: queuedGraphic.renderTarget,
			graphicId: queuedGraphic.graphicId,
			graphicInstanceId: 'N/A',
			disabled: true,
		})
	}

	const ografApi = OgrafApi.getSingleton()

	const descriptions: string[] = []

	if (graphic.graphic.description) descriptions.push(graphic.graphic.description)
	if (graphic.graphic.createdBy) descriptions.push(`by ${graphic.graphic.createdBy.name}`)

	return (
		<Card elevation={1} sx={{ m: 1, p: 1 }}>
			<CardHeader
				action={
					<IconButton
						aria-label="close"
						onClick={() => {
							appSettingsStore.removeGraphic(props.graphicKey)
						}}
					>
						<Close />
					</IconButton>
				}
				title={graphic.graphic.name}
				subheader={descriptions.join(', ')}
			/>

			<CardContent>
				<Box>
					<Typography>RenderTarget</Typography>

					<OGrafForm
						schema={renderer.renderTargetSchema}
						value={queuedGraphic.renderTarget}
						onDataChangeCallback={(newRenderTarget: unknown) => {
							runInAction(() => {
								const q = appSettingsStore.queuedGraphics.get(props.graphicKey)
								if (!q) return
								const newObj = {
									...q,
									renderTarget: newRenderTarget,
								}

								appSettingsStore.queuedGraphics.set(props.graphicKey, newObj)
							})
						}}
					/>
				</Box>
				<Box>{!queuedGraphic.renderTarget && <Typography color="error">No render target specified!</Typography>}</Box>
				{graphic.manifest.schema && (
					<Box>
						<Typography>Graphics Data</Typography>

						<OGrafForm
							schema={graphic.manifest.schema}
							value={clone(queuedGraphic.graphicData)}
							onDataChangeCallback={(newData: unknown) => {
								const q = appSettingsStore.queuedGraphics.get(props.graphicKey)
								if (!q) return

								runInAction(() => {
									appSettingsStore.queuedGraphics.set(props.graphicKey, {
										...q,
										graphicData: newData,
									})
								})
							}}
						/>
						{/* {JSON.stringify(queuedGraphic.graphicData)} */}
					</Box>
				)}
				<Button
					variant="contained"
					disabled={!queuedGraphic.renderTarget}
					onClick={() => {
						if (!renderer) return
						ografApi
							.renderTargetGraphicLoad(
								{ rendererId: renderer.id },
								{ renderTarget: queuedGraphic.renderTarget },
								{
									graphicId: queuedGraphic.graphicId,
									params: {
										data: toJS(queuedGraphic.graphicData),
									},
								}
							)
							.then((r) => {
								if (r.status === 200) {
									serverDataStore.addToGraphicsInstanceMap({
										rendererId: renderer.id,
										renderTarget: queuedGraphic.renderTarget,
										graphicId: queuedGraphic.graphicId,
										graphicInstanceId: r.content.graphicInstanceId,
									})

									serverDataStore.triggerReloadData(`renderTarget::${JSON.stringify(queuedGraphic.renderTarget)}`)
								}
							})
							.catch(console.error)
					}}
				>
					Load
				</Button>

				<Box>
					<Typography>Graphic Instances</Typography>
					{graphicsInstances.map((gi) => (
						<Box key={gi.graphicInstanceId}>
							<Box>
								<Typography>{gi.graphicInstanceId}</Typography>
								<Button
									variant="contained"
									disabled={gi.disabled || !queuedGraphic.renderTarget}
									onClick={() => {
										if (!renderer) return

										ografApi
											.renderTargetGraphicPlay(
												{ rendererId: renderer.id },
												{
													renderTarget: queuedGraphic.renderTarget,
													graphicInstanceId: gi.graphicInstanceId,
												},
												{
													params: {
														// delta
														// goto
														// skipAnimation
													},
												}
											)
											.catch(console.error)
									}}
								>
									Play
								</Button>
								<Button
									variant="contained"
									disabled={gi.disabled || !queuedGraphic.renderTarget}
									onClick={() => {
										if (!renderer) return
										ografApi
											.renderTargetGraphicUpdate(
												{ rendererId: renderer.id },
												{
													renderTarget: queuedGraphic.renderTarget,
													graphicInstanceId: gi.graphicInstanceId,
												},
												{
													params: {
														data: toJS(queuedGraphic.graphicData),
														// skipAnimation
													},
												}
											)
											.catch(console.error)
									}}
								>
									Update
								</Button>
								<Button
									variant="contained"
									disabled={gi.disabled || !queuedGraphic.renderTarget}
									onClick={() => {
										if (!renderer) return
										ografApi
											.renderTargetGraphicStop(
												{ rendererId: renderer.id },
												{
													renderTarget: queuedGraphic.renderTarget,
													graphicInstanceId: gi.graphicInstanceId,
												},
												{
													params: {
														// skipAnimation
													},
												}
											)
											.catch(console.error)
									}}
								>
									Stop
								</Button>
								<Button
									variant="contained"
									disabled={gi.disabled || !queuedGraphic.renderTarget}
									onClick={() => {
										if (!renderer) return
										ografApi
											.renderTargetGraphicClear(
												{ rendererId: renderer.id },
												{
													filters: {
														renderTarget: queuedGraphic.renderTarget,
														graphicInstanceId: gi.graphicInstanceId,
													},
												}
											)
											.then((r) => {
												if (r.status === 200) {
													for (const gi of r.content.graphicInstances) {
														serverDataStore.removeFromGraphicsInstanceMap({
															rendererId: renderer.id,
															renderTarget: queuedGraphic.renderTarget,
															graphicId: queuedGraphic.graphicId,
															graphicInstanceId: gi.graphicInstanceId,
														})
													}
												}
											})
											.catch(console.error)
									}}
								>
									Clear
								</Button>
							</Box>
							{graphic.manifest.customActions && (
								<Box>
									<Typography>Custom Actions</Typography>
									{graphic.manifest.customActions?.map((action) => (
										<GraphicCustomAction
											key={action.id}
											rendererId={renderer.id}
											renderTarget={queuedGraphic.renderTarget}
											graphicInstanceId={gi.graphicInstanceId}
											graphic={graphic.graphic}
											graphicKey={props.graphicKey}
											queuedGraphic={queuedGraphic}
											action={action}
											disabled={gi.disabled || !queuedGraphic.renderTarget}
										/>
									))}
								</Box>
							)}
						</Box>
					))}
				</Box>
			</CardContent>
		</Card>
	)
})
const GraphicCustomAction = (props: {
	rendererId: string
	renderTarget: unknown
	graphicInstanceId: string
	graphic: OGraf.ServerApi.components['schemas']['GraphicInfo']
	graphicKey: string
	queuedGraphic: QueuedGraphic
	action: OGraf.ServerApi.components['schemas']['action']
	disabled: boolean
}) => {
	const { rendererId, renderTarget, graphicInstanceId, action, queuedGraphic, disabled } = props
	return (
		<Card>
			{action.schema && (
				<OGrafForm
					schema={action.schema}
					value={clone(queuedGraphic.customActionData[action.id])}
					onDataChangeCallback={(newData: unknown) => {
						const q = appSettingsStore.queuedGraphics.get(props.graphicKey)
						if (!q) return

						runInAction(() => {
							appSettingsStore.queuedGraphics.set(props.graphicKey, {
								...q,
								customActionData: {
									...q.customActionData,
									[action.id]: newData,
								},
							})
						})
					}}
				/>
			)}

			<Button
				variant="contained"
				disabled={disabled}
				onClick={() => {
					const ografApi = OgrafApi.getSingleton()
					ografApi
						.renderTargetGraphicInvokeCustomAction(
							{ rendererId: rendererId },
							{
								renderTarget: renderTarget,
								graphicInstanceId: graphicInstanceId,
							},
							{
								actionName: action.name,
								params: {
									id: action.id,
									payload: toJS(queuedGraphic.customActionData[action.id] || {}),
									// skipAnimation
									// Custom action params can be added here
								},
							}
						)
						.catch(console.error)
				}}
			>
				{action.name}
			</Button>
		</Card>
	)
}
