import { EmptyPayload, VendorSpecific } from "ograf";
import { GraphicInfo } from "./_serverAPI";
import { ServerApi } from "./ograf-ts-lib/main";

export type Action = {
  label: string;
  description?: string;

  schema: Record<string, any>; // TBD, JSON Schema
};

export type RendererInfo = ServerApi.components["schemas"]["RendererInfo"];

export interface RendererManifest {
  // Forwarded from the Renderer: -------------------------------------------------------
  actions: { [method: string]: Action };

  renderTargets: {
    [id: string]: {
      name: string;
      description?: string;
    };
  };

  // Calculated by the Server: --------------------------------------------------------

  [vendorSpecific: VendorSpecific]: unknown;
}
export interface GraphicInstance {
  id: string;
  graphic: GraphicInfo;

  // status: any // TBD?
  [vendorSpecific: VendorSpecific]: unknown;
}
export type RenderTargetInfo =
  ServerApi.components["schemas"]["RenderTargetInfo"];

export interface RendererLoadGraphicPayload {
  graphicId: string;
  params: { data: unknown };
  [vendorSpecific: VendorSpecific]: unknown;
}
export interface RendererClearGraphicPayload {
  /**
   * (Optional) If set, apply filters to which instances to clear. If no filters are defined, ALL graphics will be cleared.
   *
   * If multiple filters are defined, only instances that match all filters will be cleared.
   */
  filters?: ServerApi.components["schemas"]["GraphicFilter"];

  [vendorSpecific: VendorSpecific]: unknown;
}

/** Identifies a GraphicInstance on a RenderTarget */
export interface GraphicInstanceOnTarget {
  graphicInstanceId: string;
  renderTarget: unknown;
  graphicId: string;
  graphicVersion: string;
}
