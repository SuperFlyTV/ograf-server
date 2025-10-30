import * as React from "react";
import * as ReactDOM from "react-dom/client";

// import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

// import Button from "@mui/material/Button";
// import './index.css'
// import { App } from './App.jsx'

// Import our custom CSS
// import "./scss/styles.scss";
// Import all of Bootstrap's JS
// import * as bootstrap from 'bootstrap'

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { App } from "./App.js";

// console.log('main')
ReactDOM.createRoot(document.getRootNode()).render(
  // ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* <InitColorSchemeScript attribute="data" /> */}

    <App />
  </React.StrictMode>
);
