import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import { graphicsListStore, PlaybackItem } from '../stores/graphicsList.js'
import { GraphicsListAPI } from '../lib/graphicsListApi.js'

export const ListItem = observer(function ListItem({
    item,
    index,
    isSelected,
    onDragStart,
    onDragOver,
    onDrop
}: {
    item: PlaybackItem;
    index: number;
    isSelected: boolean;
    onDragStart: (e: React.DragEvent, index: number) => void;
    onDragOver: (e: React.DragEvent, index: number) => void;
    onDrop: (e: React.DragEvent, index: number) => void;
}) {
	// Check if loaded (stub logic, ideally based on graphic instances status)
	const handleAction = async (actionId: string, e: React.MouseEvent) => {
	    e.stopPropagation()
	    await GraphicsListAPI.performAction(item, actionId)
	}

	return (
		<Paper
		    draggable
		    onDragStart={(e: React.DragEvent) => onDragStart(e, index)}
		    onDragOver={(e: React.DragEvent) => onDragOver(e, index)}
		    onDrop={(e: React.DragEvent) => onDrop(e, index)}
			elevation={isSelected ? 6 : 1}
			sx={{
				p: 2,
				mb: 1,
				cursor: 'pointer',
				outline: isSelected ? '2px solid' : 'none',
				outlineColor: 'primary.main',
				userSelect: 'none',
				display: 'flex',
				alignItems: 'center',
				gap: 2
			}}
			onClick={() => graphicsListStore.selectItem(item.id)}
		>
		    <Box sx={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
		        <div style={{ padding: '8px', opacity: 0.5 }}>=</div>
		    </Box>

			<Box sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
				<Typography variant="h6" noWrap title={item.graphicId}>{item.graphicId}</Typography>
				<Typography variant="body2" color="text.secondary" noWrap>
					Renderer: {item.rendererId}
				</Typography>
			</Box>

			<Stack direction="column" spacing={1} onClick={(e) => e.stopPropagation()}>
				{/* Actions would be dynamically generated from graphicInfo?.graphic.actions. For now we hardcode common ones based on manifest structure */}
				<Button size="small" variant="outlined" onClick={(e) => handleAction('load', e)}>Load</Button>
				<Button size="small" variant="contained" color="primary" onClick={(e) => handleAction('play', e)}>Play</Button>
				<Button size="small" variant="outlined" color="secondary" onClick={(e) => handleAction('update', e)}>Update</Button>
				<Button size="small" variant="outlined" color="error" onClick={(e) => handleAction('stop', e)}>Stop</Button>

				<IconButton
				    size="small"
				    color="error"
				    onClick={(e: React.MouseEvent) => {
				        e.stopPropagation()
				        graphicsListStore.removeItem(item.id)
				    }}
				    title="Delete Item"
				>
				    Delete
				</IconButton>
			</Stack>
		</Paper>
	)
})
