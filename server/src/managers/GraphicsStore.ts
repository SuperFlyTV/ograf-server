import fs from "fs";
import mime from "mime-types";
import path from "path";
import { GraphicsManifest } from "ograf";
// import * as ServerAPI from "../types/_serverAPI";
import { ServerApi } from "../types/ograf-ts-lib/main";
import { CTX, literal } from "../lib/lib";
import decompress from "decompress";
import { GraphicInfo } from "../types/_serverAPI";

export class GraphicsStore {
  /** File path where to store Graphics */
  private FILE_PATH = path.resolve("./localGraphicsStorage");
  /** How long to wait before removing Graphics, in ms */
  private REMOVAL_WAIT_TIME = 1000 * 3600 * 24; // 24 hours

  constructor() {
    // Ensure the directory exists
    fs.mkdirSync(this.FILE_PATH, { recursive: true });

    setInterval(() => {
      this.removeExpiredGraphics().catch(console.error);
    }, 1000 * 3600 * 24); // Check every 24 hours
    // Also do a check now:
    this.removeExpiredGraphics().catch(console.error);
  }

  async listGraphics(filter?: {
    graphicId?: string;
  }): Promise<ServerApi.components["schemas"]["GraphicInfo"][]> {
    const folderList = await fs.promises.readdir(this.FILE_PATH);

    const graphics: ServerApi.components["schemas"]["GraphicInfo"][] = [];
    for (const folder of folderList) {
      const { id, version } = this.fromFileName(folder);

      if (filter?.graphicId && filter.graphicId !== id) continue;

      const graphicInfo = await this.getGraphicInfo(id, version);
      if (!graphicInfo) continue;

      graphics.push(graphicInfo);
    }
    return graphics;
  }
  async getGraphicInfo(
    id: string,
    version: string
  ): Promise<ServerApi.components["schemas"]["GraphicInfo"] | undefined> {
    const folder = this.toFileName(id, version);

    // Don't list Graphics that are marked for removal:
    if (await this.isGraphicMarkedForRemoval(id, version)) return undefined;

    const manifestFilePath = path.join(this.FILE_PATH, folder, "manifest.json");

    const pStat = fs.promises.stat(manifestFilePath);

    const manifest = JSON.parse(
      await fs.promises.readFile(manifestFilePath, "utf8")
    ) as GraphicsManifest;

    // Ensure the id and version match:
    if (
      id !== manifest.id ||
      (manifest.version !== undefined && version !== manifest.version)
    ) {
      console.error(
        `Folder name ${folder} does not match manifest id ${manifest.id} or version ${manifest.version}`
      );
      return undefined;
    }

    const stat = await pStat;

    return {
      id: manifest.id,
      version: manifest.version,
      name: manifest.name,
      description: manifest.description,
      author: manifest.author,
      modified: Math.floor(stat.mtimeMs),
    };
  }

  async getGraphicManifest(
    id: string,
    version: string | undefined
  ): Promise<ServerApi.components["schemas"]["GraphicManifest"] | undefined> {
    const manifestPath = path.join(
      this.FILE_PATH,
      this.toFileName(id, version),
      "manifest.json"
    );
    console.log("manifestPath", manifestPath);
    if (!(await this.fileExists(manifestPath))) return undefined;

    const graphicManifest = JSON.parse(
      await fs.promises.readFile(manifestPath, "utf8")
    );
    if (!graphicManifest) return undefined;
    return graphicManifest;
  }
  async deleteGraphic(
    id: string,
    version: string | undefined,
    force: boolean | undefined
  ): Promise<boolean> {
    if (force) {
      return this.actuallyDeleteGraphic(id, version);
    } else {
      return this.markGraphicForRemoval(id, version);
    }
  }
  async getGraphicResource(
    id: string,
    version: string | undefined,
    localPath: string
  ): Promise<ServeFile | undefined> {
    console.log("getGraphicResource");
    // const params =
    //   ctx.params as ServerAPI.Endpoints["getGraphicResource"]["params"];
    // const id: string = params.graphicId;
    // const version: string = params.graphicVersion;
    // const localPath: string = params.localPath;

    console.log(
      "url aaaa",
      path.join(
        this.FILE_PATH,
        this.toFileName(id, version),

        localPath
      )
    );

    return this.serveFile(
      path.join(
        this.FILE_PATH,
        this.toFileName(id, version),

        localPath
      )
    );
  }

  // async getGraphicModule(ctx: CTX): Promise<void> {
  //   const params =
  //     ctx.params as ServerAPI.Endpoints["getGraphicModule"]["params"];
  //   const id: string = params.graphicId;
  //   const version: string = params.graphicVersion;

  //   // Don't return graphic if the Graphic is marked for removal:
  //   if (await this.isGraphicMarkedForRemoval(id, version)) {
  //     ctx.status = 404;
  //     ctx.body = literal<ServerAPI.ErrorReturnValue>({
  //       code: 404,
  //       message: "File not found",
  //     });
  //     return;
  //   }

  //   await this.serveFile(
  //     ctx,
  //     path.join(this.FILE_PATH, this.toFileName(id, version), "graphic.mjs"),
  //     this.isImmutable(version)
  //   );
  // }

  async uploadGraphic(ctx: CTX): Promise<void> {
    console.log("uploadGraphic");
    // ctx.status = 501
    // ctx.body = literal<ServerAPI.ErrorReturnValue>({code: 501, message: 'Not implemented yet'})

    // Expect a zipped file that contains the Graphic
    const file = ctx.request.file;
    // console.log('file', ctx.request.file)
    // console.log('files', ctx.request.files)
    // console.log('body', ctx.request.body)

    console.log("Uploaded file", file.originalname, file.size);

    if (
      !["application/x-zip-compressed", "application/zip"].includes(
        file.mimetype
      )
    ) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "Expected a zip file",
      };
      return;
    }

    const tempZipPath = file.path;

    const decompressPath = path.resolve("tmpGraphic");

    const cleanup = async () => {
      try {
        await fs.promises.rm(decompressPath, { recursive: true });
      } catch (err: any) {
        if (err.code !== "ENOENT") throw err;
      }
    };
    try {
      await cleanup();

      const files = await decompress(tempZipPath, decompressPath);

      console.log("files", files);

      const uploadedGraphics: { id: string; version?: string }[] = [];

      const manifests = files.filter((f) => f.path.endsWith("manifest.json"));
      if (!manifests.length)
        throw new Error("No manifest.json found in zip file");

      // Use content to determine which files are manifest files:
      //{
      //  "$schema": "https://ograf.ebu.io/v1-draft-0/specification/json-schemas/graphics/schema.json"
      //}
      // const manifests = []
      // for (const f of files) {
      //   if (!f.path.endsWith(".json")) continue
      //   // Check if the file is a manifest file:
      //   const content = await fs.promises.readFile(f.path, "utf-8");
      //   if (
      //     content.includes(`"$schema"`) &&
      //     // content.includes(`"https://ograf.ebu.io/v1-draft-0/specification/json-schemas/graphics/schema.json"`) &&
      //     content.includes(`"https://ograf.ebu.io/
      //   ) {
      //     manifests.push(f)
      //   }
      // }

      for (const manifest of manifests) {
        const basePath = path.dirname(manifest.path);
        console.log("basePath", basePath);

        const manifestData = JSON.parse(
          manifest.data.toString("utf8")
        ) as GraphicsManifest;

        const id = manifestData.id;
        const version = manifestData.version;

        const folderPath = path.join(
          this.FILE_PATH,
          this.toFileName(id, version)
        );

        // Check if the Graphic already exists
        let alreadyExists = false;
        if (await this.fileExists(folderPath)) {
          alreadyExists = true;

          // Remove the graphic if it already exists:
          await this.actuallyDeleteGraphic(id, version);
          alreadyExists = false;

          // if (await this.isGraphicMarkedForRemoval(id, version)) {
          //   // If a pre-existing graphic is marked for removal, we can overwrite it.
          //   await this.actuallyDeleteGraphic(id, version);
          //   alreadyExists = false;
          // } else if (version === "0" || version === 'unversioned') {
          //   // If the version is 0, it is considered mutable, so we can overwrite it.
          //   await this.actuallyDeleteGraphic(id, version);
          //   alreadyExists = false;
          // }
        }
        if (alreadyExists) {
          await cleanup();

          ctx.status = 409; // conflict
          ctx.body = {
            code: 409,
            message: "Graphic already exists",
          };
          return;
        }

        // Copy the files to the right folder:
        await fs.promises.mkdir(folderPath, { recursive: true });

        const graphicFiles = files.filter((f) => f.path.startsWith(basePath));

        // Then, copy files:
        for (const innerFile of graphicFiles) {
          if (innerFile.type !== "file") continue;

          const filePath = innerFile.path.slice(basePath.length); // Remove the base path

          const outputFilePath = path.join(folderPath, filePath);
          const outputFolderPath = path.dirname(outputFilePath);
          // ensure dir:
          try {
            await fs.promises.mkdir(outputFolderPath, {
              recursive: true,
            });
          } catch (err) {
            if (!`${err}`.includes("EEXIST")) throw err; // Ignore "already exists" errors
          }

          // Copy data:
          await fs.promises.writeFile(outputFilePath, innerFile.data);
        }
        uploadedGraphics.push({ id, version });
      }

      ctx.status = 200;
      ctx.body = {
        graphics: uploadedGraphics,
      };

      // const graphicModule = files.find((f) => f.path.endsWith("graphic.mjs"));
      // if (!graphicModule) throw new Error("No graphic.mjs found in zip file");

      // let basePath = "";
      // if (graphicModule.path.includes("/graphic.mjs")) {
      //   // basepath/graphic.mjs
      //   basePath = graphicModule.path.slice(0, -"/graphic.mjs".length);
      // }

      // const manifestData = JSON.parse(
      //   manifest.data.toString("utf8")
      // ) as GraphicsManifest;

      // const id = manifestData.id;
      // const version = `${manifestData.version}`;
      // const folderPath = path.join(
      //   this.FILE_PATH,
      //   this.toFileName(id, version)
      // );

      // // Check if the Graphic already exists
      // let alreadyExists = false;
      // if (await this.fileExists(folderPath)) {
      //   alreadyExists = true;

      //   if (await this.isGraphicMarkedForRemoval(id, version)) {
      //     // If a pre-existing graphic is marked for removal, we can overwrite it.
      //     await this.actuallyDeleteGraphic(id, version);
      //     alreadyExists = false;
      //   } else if (version === "0") {
      //     // If the version is 0, it is considered mutable, so we can overwrite it.
      //     await this.actuallyDeleteGraphic(id, version);
      //     alreadyExists = false;
      //   }
      // }

      // if (alreadyExists) {
      //   await cleanup();

      //   ctx.status = 409; // conflict
      //   ctx.body = literal<ServerAPI.ErrorReturnValue>({
      //     code: 409,
      //     message: "Graphic already exists",
      //   });
      //   return;
      // }

      // // Copy the files to the right folder:
      // await fs.promises.mkdir(folderPath, { recursive: true });

      // // Then, copy files:
      // for (const innerFile of files) {
      //   if (innerFile.type !== "file") continue;

      //   const filePath = innerFile.path.slice(basePath.length); // Remove the base path

      //   const outputFilePath = path.join(folderPath, filePath);
      //   const outputFolderPath = path.dirname(outputFilePath);
      //   // ensure dir:
      //   try {
      //     await fs.promises.mkdir(outputFolderPath, {
      //       recursive: true,
      //     });
      //   } catch (err) {
      //     if (!`${err}`.includes("EEXIST")) throw err; // Ignore "already exists" errors
      //   }

      //   // Copy data:
      //   await fs.promises.writeFile(outputFilePath, innerFile.data);
      // }

      // ctx.status = 200;
      // ctx.body = literal<ServerAPI.Endpoints["uploadGraphic"]["returnValue"]>(
      //   {}
      // );
    } finally {
      // clean up after ourselves:
      await cleanup();
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private toFileName(id: string, version: string | undefined) {
    return `${id}-${version ?? "undefined"}`;
  }
  private fromFileName(filename: string): { id: string; version: string } {
    const m = filename.match(/(.+)-([^-]+)/);
    if (!m) throw new Error(`Invalid filename ${filename}`);
    return { id: m[1], version: m[2] };
  }
  isImmutable(version: string | undefined) {
    // If the version is "0", the graphic is considered mutable
    // ie, it is a non-production version, in development
    // Otherwise it is considered immutable.
    return `${version}` !== "0";
  }

  private async getFileInfo(filePath: string): Promise<
    | {
        found: false;
      }
    | {
        found: true;
        mimeType: string;
        length: number;
        lastModified: Date;
      }
  > {
    if (!(await this.fileExists(filePath))) {
      return { found: false };
    }
    let mimeType = mime.lookup(filePath);
    if (!mimeType) {
      // Fallback to "unknown binary":
      mimeType = "application/octet-stream";
    }

    const stat = await fs.promises.stat(filePath);

    return {
      found: true,
      mimeType,
      length: stat.size,
      lastModified: stat.mtime,
    };
  }
  private async serveFile(fullPath: string): Promise<ServeFile | undefined> {
    const info = await this.getFileInfo(fullPath);

    if (!info.found) return undefined;

    // ctx.type = info.mimeType;
    // ctx.length = info.length;
    // ctx.lastModified = info.lastModified;

    // if (immutable) {
    //   ctx.header["Cache-Control"] = "public, max-age=31536000, immutable";
    // } else {
    //   // Never cache:
    //   ctx.header["Cache-Control"] = "no-store";
    // }

    const readStream = fs.createReadStream(fullPath);
    // ctx.body = readStream as any;

    return {
      mimeType: info.mimeType,
      length: info.length,
      lastModified: info.lastModified,
      readStream: readStream,
    };
  }

  private async actuallyDeleteGraphic(
    id: string,
    version: string | undefined
  ): Promise<boolean> {
    const folderPath = path.join(this.FILE_PATH, this.toFileName(id, version));

    if (!(await this.fileExists(folderPath))) return false;
    await fs.promises.rm(folderPath, { recursive: true });

    return true;
  }
  private async markGraphicForRemoval(
    id: string,
    version: string | undefined
  ): Promise<boolean> {
    // Mark the Graphic for removal, but keep it for a while.
    // The reason for this is to not delete a Graphic that is currently on-air
    // (which might break due to missing resources)

    const folderPath = path.join(this.FILE_PATH, this.toFileName(id, version));

    const removalFilePath = path.join(folderPath, "__markedForRemoval");

    if (!(await this.fileExists(folderPath))) return false;
    await fs.promises.writeFile(
      removalFilePath,
      `${Date.now() + this.REMOVAL_WAIT_TIME}`,
      "utf-8"
    );
    return true;
  }
  /** Find any graphics that are due to be removed */
  private async removeExpiredGraphics() {
    const folderList = await fs.promises.readdir(this.FILE_PATH);
    for (const folder of folderList) {
      const { id, version } = this.fromFileName(folder);

      if (!(await this.isGraphicMarkedForRemoval(id, version))) continue;

      const removalFilePath = path.join(
        this.FILE_PATH,
        folder,
        "__markedForRemoval"
      );

      const removalTimeStr = await fs.promises.readFile(
        removalFilePath,
        "utf-8"
      );
      const removalTime = parseInt(removalTimeStr);
      if (Number.isNaN(removalTime)) {
        continue;
      }

      if (Date.now() > removalTime) {
        // Time to remove the Graphic
        await this.actuallyDeleteGraphic(id, version);
      }
    }
  }

  /** Returns true if a graphic exists (and is not marked for removal) */
  private async isGraphicMarkedForRemoval(
    id: string,
    version: string
  ): Promise<boolean> {
    const removalFilePath = path.join(
      this.FILE_PATH,
      this.toFileName(id, version),
      "__markedForRemoval"
    );
    return await this.fileExists(removalFilePath);
  }
}

export interface ServeFile {
  mimeType: string;
  length: number;
  lastModified: Date;
  readStream: fs.ReadStream;
}
