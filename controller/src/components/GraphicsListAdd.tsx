import * as React from "react";
import { observer } from "mobx-react";
import Box from "@mui/material/Box";
import { appSettingsStore } from "../stores/appSettings.js";
import Typography from "@mui/material/Typography";
import * as OGraf from "../lib/ograf/server-api.js";
import Button from "@mui/material/Button";
import { OGrafForm } from "./OGrafForm.js";
import { useStoredState } from "../lib/lib.js";
import { OgrafApi } from "../lib/ografApi.js";
import Card from "@mui/material/Card";
import { serverDataStore } from "../stores/serverData.js";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

export const GraphicsListAdd = observer((props: { rendererId: string }) => {
  const onChange = React.useCallback((e) => {
    const graphicId = e.target.value;
    appSettingsStore.addGraphic(props.rendererId, graphicId);
    // console.log(e.target.value);
  }, []);

  if (serverDataStore.graphicsList.length === 0) {
    return (
      <Box sx={{ m: 1, p: 1 }}>
        <Typography>
          There are no Graphics on the Server.
          <br />
          {serverDataStore.severIsOurs &&
            `(You can upload an OGraf graphic to the server using the "Upload Graphic" button!)`}
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ m: 1, p: 1 }}>
      <FormControl fullWidth>
        <InputLabel id="pick-graphic">Add Graphic</InputLabel>
        <Select
          labelId="pick-graphic"
          id="pick-graphic-select"
          value={""}
          label="Add Graphic"
          onChange={onChange}
        >
          {serverDataStore.graphicsList.map((gfx) => (
            <MenuItem key={gfx.id} value={gfx.id}>
              {gfx.name} (id: {gfx.id})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
});
