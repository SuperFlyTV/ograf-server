import React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import { SentCommand, sentCommandsStore } from '../stores/sentCommands.js'

import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Switch from '@mui/material/Switch'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import { useStoredState } from '../lib/lib.js'
import CardContent from '@mui/material/CardContent'
import { Button } from '@mui/material'

export const CommandsLog: React.FC = observer(() => {
	const [displayAll, setDisplayAll] = useStoredState<boolean>('commands-log-filter-all', false)
	const cardRef = React.useRef<HTMLDivElement>(null)
	const displayCount = React.useRef<number>(0)
	let sentCommands = sentCommandsStore.sentCommands

	const hasCommands = sentCommands.length > 0

	if (!displayAll) {
		sentCommands = sentCommands.filter((c) => !c.recurring)
	}

	React.useLayoutEffect(() => {
		if (!cardRef.current) return
		const el = cardRef.current

		const addedCount = el.childElementCount - displayCount.current
		displayCount.current = el.childElementCount

		const childHeight = (el.lastChild as HTMLElement)?.clientHeight ?? 0

		const bottomFlex = (el.scrollTop === 0 ? 200 : 100) + Math.max(100, childHeight) * Math.max(1, addedCount)

		// Scroll to bottom, if already scrolled to bottom:
		if (Math.abs(el.scrollTop - (el.scrollHeight - el.clientHeight)) < bottomFlex) {
			// Scroll to bottom
			el.scrollTop = el.scrollHeight
		}
	})

	return (
		<Card
			sx={{
				m: 1,
				p: 0,
				position: 'sticky',
				top: '100px',
				maxHeight: '90vh',
			}}
		>
			<Typography variant="h6"> </Typography>

			<CardHeader
				action={
					<FormGroup>
						<FormControlLabel
							control={<Switch checked={displayAll} onChange={(e) => setDisplayAll(e.target.checked)} />}
							label="Show All"
						/>
					</FormGroup>
				}
				title={'Commands Log'}
			/>
			<CardContent
				ref={cardRef}
				sx={{
					maxHeight: '80vh',
					overflowY: 'auto',
				}}
			>
				{sentCommands.length === 0 && (
					<Typography>
						{!displayAll && hasCommands
							? `No commands to display, click "Show All" to view. `
							: `No commands sent yet.`}{' '}
					</Typography>
				)}
				{sentCommands.map((c) => (
					<CommandEntry key={c.key} command={c} />
				))}

				<Button
					onClick={() => {
						sentCommandsStore.clear()
					}}
					disabled={sentCommands.length === 0}
				>
					Clear log
				</Button>
			</CardContent>
		</Card>
	)
})
const CommandEntry = (props: { command: SentCommand }) => {
	const c = props.command

	let color = undefined
	if (c.responseStatus !== undefined) {
		if (c.responseStatus >= 200 && c.responseStatus < 300) {
			color = 'green'
		} else {
			color = 'red'
		}
	}
	return (
		<Card key={c.key} elevation={1} sx={{ my: 1 }}>
			<Grid container spacing={0}>
				<Grid size={2}>
					<Box
						sx={{
							display: 'inline-block',
							// m: 0.5,
							px: 0.5,
							// py: 0,
							border: '1px solid #ccc',
							color: '#fff',
							borderRadius: '4px',
							backgroundColor:
								c.method === 'GET'
									? '#61affe'
									: c.method === 'POST'
										? '#49cc90'
										: c.method === 'PUT'
											? '#fca130'
											: c.method === 'DELETE'
												? '#f93e3e'
												: '#999999',
						}}
					>
						<Typography>{c.method}</Typography>
					</Box>
				</Grid>
				<Grid size={10}>
					<Typography
						sx={{
							fontSize: '0.8em',
						}}
					>
						{c.url}
					</Typography>
				</Grid>
				{c.body && (
					<Grid size={12}>
						<Typography
							sx={{
								fontSize: '0.8em',
							}}
						>
							{c.body}
						</Typography>
					</Grid>
				)}

				{c.responseStatus === undefined ? (
					<Grid size={12}>
						<Typography
							sx={{
								fontStyle: 'italic',
								fontSize: '0.8em',
							}}
						>
							Waiting for response....
						</Typography>
					</Grid>
				) : (
					<>
						<Grid size={2}>
							<Typography
								sx={{
									color: color,
								}}
							>
								{c.responseStatus}
							</Typography>
						</Grid>
						<Grid size={10}>
							<Typography
								sx={{
									fontSize: '0.8em',
								}}
							>
								<ExpandText text={c.responseBody} />
							</Typography>
						</Grid>
					</>
				)}
			</Grid>
		</Card>
	)
}

const ExpandText = (props: { text: string | undefined }) => {
	const [expand, setExpand] = React.useState(false)

	if (props.text === undefined) return null

	if (props.text.length < 100) {
		return <span>{props.text}</span>
	}

	return <span onClick={() => setExpand(!expand)}>{expand ? props.text : props.text.slice(0, 100) + '...'}</span>
}
