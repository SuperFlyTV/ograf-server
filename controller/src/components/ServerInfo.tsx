import * as React from "react";
import { observer } from "mobx-react";
import { serverDataStore } from "../stores/serverData.js";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";

export const ServerInfo = observer(() => {
  return (
    <>Server name: {serverDataStore.serverInfo?.name}</>
    // <Box
    //   component="form"
    //   sx={{ "& > :not(style)": { m: 1, width: "25ch" } }}
    //   noValidate
    //   autoComplete="off"
    // >
    //   <TextField
    //     id="asdf"
    //     label="Server URL"
    //     value={appSettingsStore.serverApiUrl}
    //     onChange={(event) => {
    //       appSettingsStore.serverApiUrl = event.target.value;
    //     }}
    //   />
    // </Box>
  );
});
