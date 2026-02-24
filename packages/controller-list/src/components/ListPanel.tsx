import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'

import { graphicsListStore } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { ListItem } from './ListItem.js'
import { GraphicsListAPI } from '../lib/graphicsListApi.js'

export const ListPanel = observer(function ListPanel() {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
    const [draggedItemIndex, setDraggedItemIndex] = React.useState<number | null>(null)

    const handleAddClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    const handleAddGraphic = (graphicId: string) => {
        const rendererId = appSettingsStore.getSelectedRendererId() || ''
        graphicsListStore.addItem(rendererId, graphicId)
        handleClose()
    }

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return // Ignore typing in forms
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault()
                graphicsListStore.selectPrev()
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                graphicsListStore.selectNext()
            }

            const selectedItem = graphicsListStore.getSelectedItem()
            if (!selectedItem) return

            // F1: Stop, F2: Play, F3: Load, F4: Step back, F5: Step forward, F6: Update, F10: Clear
            const actions: Record<string, string> = {
                'F1': 'stop',
                'F2': 'play',
                'F3': 'load',
                'F4': 'stepBack',
                'F5': 'stepForward',
                'F6': 'update'
            }

            if (actions[e.key]) {
                e.preventDefault()
                console.log(`Shortcut ${e.key} triggered action ${actions[e.key]} for item ${selectedItem.id}`)
                GraphicsListAPI.performAction(selectedItem, actions[e.key]).catch(console.error)
            } else if (e.key === 'F10') {
                e.preventDefault()
                graphicsListStore.clearItems()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Drag and drop handlers
    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index)
        e.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const onDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault()
        if (draggedItemIndex !== null && draggedItemIndex !== dropIndex) {
            graphicsListStore.moveItem(draggedItemIndex, dropIndex)
        }
        setDraggedItemIndex(null)
    }

    return (
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDir: 'column' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5">Graphics List</Typography>

                <Button variant="contained" onClick={handleAddClick}>
                    Add Graphic
                </Button>

                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                >
                    {serverDataStore.graphicsList.length === 0 ? (
                        <MenuItem disabled>No graphics available</MenuItem>
                    ) : (
                        serverDataStore.graphicsList.map((g) => (
                            <MenuItem
                                key={g.id}
                                onClick={() => handleAddGraphic(g.id)}
                            >
                                {g.name || g.id}
                            </MenuItem>
                        ))
                    )}
                </Menu>
            </Stack>

            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {graphicsListStore.items.map((item, index) => (
                    <ListItem
                        key={item.id}
                        item={item}
                        index={index}
                        isSelected={graphicsListStore.selectedItemId === item.id}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                    />
                ))}
                {graphicsListStore.items.length === 0 && (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                        List is empty. Click "Add Graphic" to start.
                    </Typography>
                )}
            </Box>
        </Box>
    )
})
