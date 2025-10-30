import * as React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import { AppSettings } from "./components/AppSettings";
import { ServerInfo } from "./components/ServerInfo";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import { Header } from "./components/Header";
import { SettingsPage } from "./pages/SettingsPage";
import { ControllerPage } from "./pages/ControllerPage";

const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "data",
  },
  colorSchemes: {
    dark: true,
    light: true,
  },
  spacing: 8,
  //   palette: {
  //     mode: "dark",
  //   },
});
// const darkTheme = createTheme({
//   palette: {
//     mode: "dark",
//   },
// });

export function App() {
  const [page, setPage] = React.useState<"controller" | "settings">(
    "controller"
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <AppBar position="sticky">
        <Toolbar>
          <Header page={page} />

          <Button
            color="inherit"
            onClick={() => {
              setPage("settings");
            }}
          >
            Settings
          </Button>
          <Button
            color="inherit"
            onClick={() => {
              setPage("controller");
            }}
          >
            Controller
          </Button>
        </Toolbar>
      </AppBar>

      {page === "settings" ? <SettingsPage /> : <ControllerPage />}
    </ThemeProvider>
  );
}
