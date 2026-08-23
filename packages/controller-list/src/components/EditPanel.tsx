import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import { OGrafForm } from './OGrafForm.js'
import { GraphicsListAPI } from '../lib/graphicsListApi.js'

import { graphicsListStore } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { clone } from '../lib/lib.js'

export const EditPanel = observer(function EditPanel() {
    const selectedItem = graphicsListStore.getSelectedItem()

	const handleAction = async (actionId: string, e: React.MouseEvent) => {
	    e.stopPropagation()
	    if (selectedItem) {
	        await GraphicsListAPI.performAction(selectedItem, actionId)
	    }
	}

    if (!selectedItem) {
        return (
            <Box sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">Select an item to edit</Typography>
            </Box>
        )
    }

    const graphicInfo = serverDataStore.graphicsInfo.get(selectedItem.graphicId)

    if (!graphicInfo) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>Loading graphic schema...</Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h5" gutterBottom>Edit Graphic</Typography>
            </Box>

            <Card sx={{ mb: 2 }} variant="outlined">
                <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Actions</Typography>
                    <Stack direction="row" spacing={1} justifyContent="flex-start">
                        <Tooltip title="F3">
                            <Button size="small" variant="outlined" onClick={(e) => handleAction('load', e)}>Load</Button>
                        </Tooltip>
                        <Tooltip title="F2">
                            <Button size="small" variant="contained" color="primary" onClick={(e) => handleAction('play', e)}>Play</Button>
                        </Tooltip>
                        <Tooltip title="F6">
                            <Button size="small" variant="outlined" color="secondary" onClick={(e) => handleAction('update', e)}>Update</Button>
                        </Tooltip>
                        <Tooltip title="F1">
                            <Button size="small" variant="outlined" color="error" onClick={(e) => handleAction('stop', e)}>Stop</Button>
                        </Tooltip>
                    </Stack>
                </CardContent>
            </Card>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Data Payload</Typography>
                    <OGrafForm
                        value={clone(selectedItem.graphicData)}
                        schema={graphicInfo.graphic.schema}
                        onDataChangeCallback={(data: unknown) => {
                            graphicsListStore.updateItemData(selectedItem.id, { graphicData: data })
                        }}
                    />

                    <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" gutterBottom>Custom Action Data</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Parameters for play/update actions can go here (based on graphic.actions manifest).
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    )
})
