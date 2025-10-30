import * as React from "react";
import { observer } from "mobx-react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { OgrafApi } from "../lib/ografApi.js";
import Input from "@mui/material/Input";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import { serverDataStore } from "../stores/serverData.js";

export const UploadGraphic = observer(() => {
  const [displayUpload, setDisplayUpload] = React.useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = React.useState("");

  const ografApi = React.useMemo(() => OgrafApi.getSingleton(), []);

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useLayoutEffect(() => {
    if (!inputRef.current) return;

    const el = inputRef.current.querySelector("input");
    if (!el) return;
    el.accept = ".zip";
  });

  // If the server is not ours, we cannot upload anything, since that endpoint is specific to us..!
  if (!serverDataStore.severIsOurs) return;

  if (!displayUpload) {
    return (
      <Box sx={{ m: 1, p: 1 }}>
        <Button
          variant="outlined"
          onClick={() => {
            setDisplayUpload(true);
          }}
        >
          Upload Graphic
        </Button>
      </Box>
    );
  }

  return (
    <Card sx={{ m: 1, p: 1 }}>
      <Typography>
        To upload an OGraf graphic to the server, first zip the folder, then
        upload it below:
      </Typography>

      <Input ref={inputRef} type="file" id="graphic-upload" />
      <Button
        variant="contained"
        onClick={() => {
          const el = document.getElementById(
            "graphic-upload"
          ) as HTMLInputElement | null;
          if (!el) throw new Error("element not found");
          if (!el.files) throw new Error("element.files not set");
          let file = el.files[0];

          const formData = new FormData();
          formData.append("graphic", file);

          let baseUrl = ografApi.baseURL.replace("/ograf/v1", "");
          if (!baseUrl.endsWith("/")) baseUrl += "/";

          fetch(`${baseUrl}serverApi/internal/graphics/graphic`, {
            method: "POST",
            body: formData,
          })
            .then(async (response) => {
              if (response.ok) {
                const json = await response.json();

                let uploadedIds: string[] = [];
                if (Array.isArray(json.graphics)) {
                  for (const gfx of json.graphics) {
                    uploadedIds.push(gfx.id);
                  }
                }

                setUploadStatus(
                  "Successfully uploaded " + uploadedIds.join(", ")
                );
              } else {
                const text = await response.text();

                setUploadStatus("Upload failed! " + text);
              }
            })
            .catch(console.error);
        }}
      >
        Upload
      </Button>

      <Typography>{uploadStatus}</Typography>

      <Button
        variant="outlined"
        onClick={() => {
          setDisplayUpload(false);
        }}
      >
        Close upload
      </Button>
    </Card>

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
