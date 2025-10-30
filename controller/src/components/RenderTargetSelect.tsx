import * as React from "react";

import * as OGraf from "../lib/ograf/server-api.js";
import { OGrafForm } from "./OGrafForm.js";
import { toJS } from "mobx";

// export const RenderTargetSelect = (props: {
//   value: unknown;
//   renderer: OGraf.components["schemas"]["RendererInfo"];
//   onChange: (renderTarget: unknown) => void;
// }) => {
//   return (
//     <OGrafForm
//       schema={props.renderer.renderTargetSchema}
//       value={props.value}
//       onDataChangeCallback={(newData) => {
//         props.onChange(newData);
//       }}
//     />
//   );
// };
