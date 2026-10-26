import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

import { aiAudioStore, SLOT_HEIGHT_PX } from '../stores/aiAudioStore.js'
import { ActionCard } from './ActionCard.js'

export const BookmarksListPanel: React.FC = observer(() => {
	const slots = aiAudioStore.bookmarkSlots
	const activeCount = aiAudioStore.activeBookmarks.length

	return (
		<Paper
			variant="outlined"
			sx={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
				borderRadius: 1.5,
			}}
		>
			{/* Header */}
			<Box
				sx={{
					p: 1.25,
					px: 1.5,
					borderBottom: '1px solid',
					borderColor: 'divider',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					bgcolor: 'background.paper',
				}}
			>
				<Stack direction="row" spacing={1} alignItems="center">
					<BookmarkIcon color="secondary" fontSize="small" />
					<Typography variant="subtitle1" fontWeight={700}>
						Bookmarks
					</Typography>
					<Chip label={activeCount} size="small" color="secondary" variant="outlined" sx={{ height: 20 }} />
				</Stack>

				{activeCount > 0 && (
					<Button
						size="small"
						color="inherit"
						startIcon={<DeleteOutlineIcon />}
						onClick={() => aiAudioStore.clearAllBookmarks()}
						sx={{ textTransform: 'none', fontSize: '0.75rem' }}
					>
						Clear All
					</Button>
				)}
			</Box>

			{/* Fixed-height slots list */}
			<Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1.25 }}>
				{slots.length === 0 ? (
					<Box
						sx={{
							height: '100%',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							textAlign: 'center',
							p: 3,
							color: 'text.secondary',
						}}
					>
						<BookmarkIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
						<Typography variant="body2" color="text.disabled">
							No bookmarks
						</Typography>
					</Box>
				) : (
					<Stack spacing={1}>
						{slots.map((slotItem, slotIndex) => (
							<Box
								key={slotItem ? slotItem.id : `empty_${slotIndex}`}
								sx={{
									height: SLOT_HEIGHT_PX,
									minHeight: SLOT_HEIGHT_PX,
									maxHeight: SLOT_HEIGHT_PX,
									boxSizing: 'border-box',
								}}
							>
								{slotItem ? (
									<ActionCard item={slotItem} mode="bookmark" />
								) : (
									<Box
										sx={{
											height: SLOT_HEIGHT_PX,
											borderRadius: 1.5,
											border: '1px dashed',
											borderColor: 'divider',
											bgcolor: (theme) =>
												theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
										}}
									/>
								)}
							</Box>
						))}
					</Stack>
				)}
			</Box>
		</Paper>
	)
})
