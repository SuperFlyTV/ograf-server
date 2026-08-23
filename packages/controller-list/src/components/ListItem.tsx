import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { OGrafForm } from './OGrafForm.js'
import { graphicsListStore, PlaybackItem } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { clone } from '../lib/lib.js'

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
                <Box sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()}>
                    {serverDataStore.renderersInfo.get(item.rendererId)?.renderTargetSchema ? (
                        <OGrafForm
                            value={clone(item.renderTarget)}
                            schema={serverDataStore.renderersInfo.get(item.rendererId)!.renderTargetSchema}
                            onDataChangeCallback={(data: unknown) => {
                                graphicsListStore.updateItemData(item.id, { renderTarget: data })
                            }}
                        />
                    ) : null}
                </Box>
			</Box>

			<Stack direction="column" spacing={1} onClick={(e) => e.stopPropagation()}>
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
