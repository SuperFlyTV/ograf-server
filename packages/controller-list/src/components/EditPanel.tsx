import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { OGrafForm } from './OGrafForm.js'

import { graphicsListStore } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { clone } from '../lib/lib.js'

export const EditPanel = observer(function EditPanel() {
    const selectedItem = graphicsListStore.getSelectedItem()
    const rendererSelected = appSettingsStore.getSelectedRendererId()

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
            <Typography variant="h5" gutterBottom>Edit Graphic</Typography>

            <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Data Payload</Typography>
                <OGrafForm
                    value={clone(selectedItem.graphicData)}
                    schema={graphicInfo.graphic.schema}
                    onDataChangeCallback={(data: unknown) => {
                        graphicsListStore.updateItemData(selectedItem.id, { graphicData: data })
                    }}
                />
            </Box>

            <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Custom Action Data</Typography>
                {/* Normally we'd render a form for each action schema here if needed */}
                <Typography variant="body2" color="text.secondary">
                    Parameters for play/update actions can go here (based on graphic.actions manifest).
                </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Render Target</Typography>
                {serverDataStore.renderersInfo.get(rendererSelected || '')?.renderTargetSchema ? (
                    <OGrafForm
                        value={clone(selectedItem.renderTarget)}
                        schema={serverDataStore.renderersInfo.get(rendererSelected || '')!.renderTargetSchema}
                        onDataChangeCallback={(data: unknown) => {
                            graphicsListStore.updateItemData(selectedItem.id, { renderTarget: data })
                        }}
                    />
                ) : (
                    <Typography variant="body2" color="text.secondary">Default / No render target options available.</Typography>
                )}
            </Box>
        </Box>
    )
})
