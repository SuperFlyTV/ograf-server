import * as React from 'react'
import { observer } from 'mobx-react'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

import { appSettingsStore } from '../stores/appSettings.js'
import { aiAudioStore } from '../stores/aiAudioStore.js'
import { AiControllerAPI } from '../lib/aiControllerApi.js'
import { AudioControlBar } from '../components/AudioControlBar.js'
import { SuggestionsListPanel } from '../components/SuggestionsListPanel.js'
import { BookmarksListPanel } from '../components/BookmarksListPanel.js'
import { SelectGraphicsDialog } from '../components/SelectGraphicsDialog.js'
import {
	WelcomeOnboardingDialog,
	SystemAudioInfoDialog,
	ElksCredentialsInfoDialog,
} from '../components/WelcomeOnboardingDialog.js'

export const ControllerPage: React.FC<{ onOpenSettings: () => void }> = observer(({ onOpenSettings }) => {
	const rendererSelected = appSettingsStore.getSelectedRendererId()

	React.useEffect(() => {
		AiControllerAPI.init()
	}, [])

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable ||
				target?.tagName?.toLowerCase() === 'superflytv-ograf-form'
			) {
				return
			}

			if (e.key === 'Escape') {
				aiAudioStore.selectItem(null)
				return
			}

			if (e.key === 'ArrowUp') {
				e.preventDefault()
				aiAudioStore.selectPrev()
				return
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault()
				aiAudioStore.selectNext()
				return
			}

			if (e.key === 'Delete' || e.key === 'Backspace') {
				const targetItem = aiAudioStore.allActiveItems.find((i) => i.isHovered) || aiAudioStore.selectedItem
				if (!targetItem) return
				e.preventDefault()
				if (aiAudioStore.suggestionSlots.some((s) => s?.id === targetItem.id)) {
					aiAudioStore.dismissSuggestionImmediate(targetItem.id)
				} else {
					aiAudioStore.removeBookmark(targetItem.id)
				}
				return
			}

			const actions: Record<string, string> = {
				F1: 'stop',
				F2: 'play',
				F3: 'load',
				F4: 'stepBack',
				F5: 'stepForward',
				F6: 'update',
			}

			if (actions[e.key]) {
				const targetItem = aiAudioStore.targetedItem
				if (!targetItem) return
				e.preventDefault()

				if (e.key === 'F2' && e.shiftKey) {
					AiControllerAPI.performQuickPlay(targetItem).catch(console.error)
					return
				}

				AiControllerAPI.performAction(targetItem, actions[e.key]).catch(console.error)
			} else if (e.key === 'F10') {
				e.preventDefault()
				const targetItem = aiAudioStore.targetedItem
				if (targetItem && !e.shiftKey) {
					AiControllerAPI.performAction(targetItem, 'clear').catch(console.error)
				} else {
					AiControllerAPI.clearAllRenderers().catch(console.error)
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	if (!rendererSelected) {
		return null
	}

	const activeNotification = aiAudioStore.notifications[aiAudioStore.notifications.length - 1]

	return (
		<Container
			disableGutters
			maxWidth={false}
			sx={{
				height: 'calc(100vh - 48px)',
				p: 1,
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
			}}
		>
			<AudioControlBar onOpenSettings={onOpenSettings} />

			<Box sx={{ flexGrow: 1, minHeight: 0 }}>
				<Grid container spacing={1.25} sx={{ height: '100%' }}>
					<Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%' }}>
						<SuggestionsListPanel />
					</Grid>
					<Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%' }}>
						<BookmarksListPanel />
					</Grid>
				</Grid>
			</Box>

			<SelectGraphicsDialog />
			<WelcomeOnboardingDialog />
			<SystemAudioInfoDialog />
			<ElksCredentialsInfoDialog />

			{activeNotification && (
				<Snackbar
					open={true}
					autoHideDuration={5000}
					onClose={() => aiAudioStore.dismissNotification(activeNotification.id)}
					anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				>
					<Alert
						severity={activeNotification.severity}
						variant="filled"
						onClose={() => aiAudioStore.dismissNotification(activeNotification.id)}
					>
						{activeNotification.message}
					</Alert>
				</Snackbar>
			)}
		</Container>
	)
})
