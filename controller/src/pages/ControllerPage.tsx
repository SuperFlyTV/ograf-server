import * as React from "react";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import { UploadGraphic } from "../components/UploadGraphic";
import { RendererPicker } from "../components/RendererPicker";
import { RendererController } from "../components/RendererController";
import { serverDataStore } from "../stores/serverData";
import { CommandsLog } from "../components/CommandsLog";

export const ControllerPage = () => {
  return (
    <Container>
      <Container>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <UploadGraphic />

            <RendererPicker />

            <RendererController />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <CommandsLog />
          </Grid>
        </Grid>
      </Container>
    </Container>
  );
};
