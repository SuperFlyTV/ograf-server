import * as React from 'react'
import { observer } from 'mobx-react'
import { serverDataStore } from '../stores/serverData.js'
import { Box, Typography } from '@mui/material'

export const ServerInfo: React.FC = observer(() => {
	const info = serverDataStore.serverInfo

	if (!info) return null

	return (
		<Box>
			<Box>
				<Typography>Server name: {info.name}</Typography>
			</Box>
			{info.description ? (
				<Box>
					<Typography>Description: {info.description}</Typography>
				</Box>
			) : null}
			{info.version ? (
				<Box>
					<Typography>Version: {info.version}</Typography>
				</Box>
			) : null}
			{info.author ? (
				<Box>
					<Typography>
						Author: {info.author.name}
						{info.author.email ? ` (${info.author.email})` : null}
						{info.author.url ? <a href={info.author.url}> {info.author.url}</a> : null}
					</Typography>
				</Box>
			) : null}
		</Box>
	)
})
