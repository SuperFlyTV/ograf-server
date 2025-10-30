import React from "react";
import { observer } from "mobx-react";
import Box from "@mui/material/Box";
import { appSettingsStore } from "../stores/appSettings.js";
import { RendererCustomActions } from "./RendererCustomActions.js";
import { GraphicsListAdd } from "./GraphicsListAdd.js";
import { GraphicsList } from "./GraphicsList.js";

export const RendererController = observer(() => {
  const selectedRenderer = appSettingsStore.getSelectedRenderer();

  if (!selectedRenderer) {
    return <Box sx={{ m: 1, p: 1 }}>No Renderer selected.</Box>;
  }
  return (
    <Box sx={{ m: 1, p: 1 }}>
      <RendererCustomActions />
      <GraphicsList />
      <GraphicsListAdd rendererId={selectedRenderer.id} />
    </Box>
  );
});
