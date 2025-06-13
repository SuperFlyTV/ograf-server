"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphicsStore = void 0;
const fs_1 = __importDefault(require("fs"));
const mime_types_1 = __importDefault(require("mime-types"));
const path_1 = __importDefault(require("path"));
const decompress_1 = __importDefault(require("decompress"));
class GraphicsStore {
    constructor() {
        /** File path where to store Graphics */
        this.FILE_PATH = path_1.default.resolve("./localGraphicsStorage");
        /** How long to wait before removing Graphics, in ms */
        this.REMOVAL_WAIT_TIME = 1000 * 3600 * 24; // 24 hours
        // Ensure the directory exists
        fs_1.default.mkdirSync(this.FILE_PATH, { recursive: true });
        setInterval(() => {
            this.removeExpiredGraphics().catch(console.error);
        }, 1000 * 3600 * 24); // Check every 24 hours
        // Also do a check now:
        this.removeExpiredGraphics().catch(console.error);
    }
    async listGraphics() {
        const folderList = await fs_1.default.promises.readdir(this.FILE_PATH);
        const graphics = [];
        for (const folder of folderList) {
            let id;
            try {
                const o = this.fromFileName(folder);
                id = o.id;
            }
            catch (e) {
                console.error(e);
                continue;
            }
            const graphicInfo = await this.getGraphicInfo(id);
            if (!graphicInfo)
                continue;
            graphics.push(graphicInfo.info);
        }
        return graphics;
    }
    async getGraphicInfo(id) {
        const folder = this.toFileName(id);
        // Don't list Graphics that are marked for removal:
        if (await this.isGraphicMarkedForRemoval(id))
            return undefined;
        const manifestFilePath = path_1.default.join(this.FILE_PATH, folder, this.manifestFilePath);
        const pStat = fs_1.default.promises.stat(manifestFilePath);
        const manifest = JSON.parse(await fs_1.default.promises.readFile(manifestFilePath, "utf8"));
        // Ensure the id match:
        if (id !== manifest.id) {
            console.error(`Folder name ${folder} does not match manifest id ${manifest.id}`);
            return undefined;
        }
        const stat = await pStat;
        return {
            info: {
                id: manifest.id,
                version: manifest.version,
                name: manifest.name,
                description: manifest.description,
                author: manifest.author,
                modified: Math.floor(stat.mtimeMs),
            },
            manifest: manifest, // the types don't exactly match, due to differences in generation
        };
    }
    async getGraphicManifest(id) {
        const manifestPath = path_1.default.join(this.FILE_PATH, this.toFileName(id), this.manifestFilePath);
        console.log("manifestPath", manifestPath);
        if (!(await this.fileExists(manifestPath)))
            return undefined;
        const graphicManifest = JSON.parse(await fs_1.default.promises.readFile(manifestPath, "utf8"));
        if (!graphicManifest)
            return undefined;
        return graphicManifest;
    }
    async deleteGraphic(id, force) {
        if (force) {
            return this.actuallyDeleteGraphic(id);
        }
        else {
            return this.markGraphicForRemoval(id);
        }
    }
    async getGraphicResource(id, localPath) {
        // console.log("getGraphicResource");
        // const params =
        //   ctx.params as ServerAPI.Endpoints["getGraphicResource"]["params"];
        // const id: string = params.graphicId;
        // const version: string = params.graphicVersion;
        // const localPath: string = params.localPath;
        return this.serveFile(path_1.default.join(this.FILE_PATH, this.toFileName(id), localPath));
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
    async uploadGraphic(ctx) {
        console.log("uploadGraphic");
        // ctx.status = 501
        // ctx.body = literal<ServerAPI.ErrorReturnValue>({code: 501, message: 'Not implemented yet'})
        // Expect a zipped file that contains the Graphic
        const file = ctx.request.file;
        // console.log('file', ctx.request.file)
        // console.log('files', ctx.request.files)
        // console.log('body', ctx.request.body)
        console.log("Uploaded file", file.originalname, file.size);
        if (!["application/x-zip-compressed", "application/zip"].includes(file.mimetype)) {
            ctx.status = 400;
            ctx.body = {
                code: 400,
                message: "Expected a zip file",
            };
            return;
        }
        const tempZipPath = file.path;
        const decompressPath = path_1.default.resolve("tmpGraphic");
        const cleanup = async () => {
            try {
                await fs_1.default.promises.rm(decompressPath, { recursive: true });
            }
            catch (err) {
                if (err.code !== "ENOENT")
                    throw err;
            }
        };
        try {
            await cleanup();
            const files = await (0, decompress_1.default)(tempZipPath, decompressPath);
            const uploadedGraphics = [];
            // const manifests = [];
            // for (const f of files) {
            //   if (await this.isManifestFile(f.path, f.data)) {
            //     manifests.push(f);
            //   }
            // }
            // if (!manifests.length)
            //   throw new Error("No manifest files found in zip file");
            let foundManifestCount = 0;
            for (const file of files) {
                const basePath = path_1.default.dirname(file.path);
                if (!(await this.isManifestFile(file.path, file.data))) {
                    continue;
                }
                foundManifestCount++;
                const manifestDataStr = file.data.toString("utf8");
                const manifestData = JSON.parse(manifestDataStr);
                const id = manifestData.id;
                const folderPath = path_1.default.join(this.FILE_PATH, this.toFileName(id));
                // Check if the Graphic already exists
                let alreadyExists = false;
                if (await this.fileExists(folderPath)) {
                    alreadyExists = true;
                    // Remove the graphic if it already exists:
                    await this.actuallyDeleteGraphic(id);
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
                await fs_1.default.promises.mkdir(folderPath, { recursive: true });
                const graphicFiles = files.filter((f) => f.path.startsWith(basePath));
                // Then, copy files:
                for (const innerFile of graphicFiles) {
                    if (innerFile.type !== "file")
                        continue;
                    const filePath = innerFile.path.slice(basePath.length); // Remove the base path
                    const outputFilePath = path_1.default.join(folderPath, filePath);
                    const outputFolderPath = path_1.default.dirname(outputFilePath);
                    // ensure dir:
                    try {
                        await fs_1.default.promises.mkdir(outputFolderPath, {
                            recursive: true,
                        });
                    }
                    catch (err) {
                        if (!`${err}`.includes("EEXIST"))
                            throw err; // Ignore "already exists" errors
                    }
                    // Copy data:
                    await fs_1.default.promises.writeFile(outputFilePath, innerFile.data);
                }
                // Also, copy manifest to special file:
                await fs_1.default.promises.writeFile(path_1.default.join(folderPath, this.manifestFilePath), manifestDataStr);
                uploadedGraphics.push({ id });
            }
            if (foundManifestCount === 0) {
                throw new Error("No manifest files found in zip file");
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
        }
        finally {
            // clean up after ourselves:
            await cleanup();
        }
    }
    async fileExists(filePath) {
        try {
            await fs_1.default.promises.access(filePath);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    toFileName(id) {
        return `graphic-${id}`;
    }
    fromFileName(filename) {
        const m = filename.match(/graphic-(.+)/);
        if (!m)
            throw new Error(`Invalid filename ${filename}`);
        return { id: m[1] };
    }
    isImmutable(version) {
        // If the version is "0", the graphic is considered mutable
        // ie, it is a non-production version, in development
        // Otherwise it is considered immutable.
        return `${version}` !== "0";
    }
    async getFileInfo(filePath) {
        if (!(await this.fileExists(filePath))) {
            return { found: false };
        }
        let mimeType = mime_types_1.default.lookup(filePath);
        if (!mimeType) {
            // Fallback to "unknown binary":
            mimeType = "application/octet-stream";
        }
        const stat = await fs_1.default.promises.stat(filePath);
        return {
            found: true,
            mimeType,
            length: stat.size,
            lastModified: stat.mtime,
        };
    }
    async serveFile(fullPath) {
        const info = await this.getFileInfo(fullPath);
        if (!info.found)
            return undefined;
        // ctx.type = info.mimeType;
        // ctx.length = info.length;
        // ctx.lastModified = info.lastModified;
        // if (immutable) {
        //   ctx.header["Cache-Control"] = "public, max-age=31536000, immutable";
        // } else {
        //   // Never cache:
        //   ctx.header["Cache-Control"] = "no-store";
        // }
        const readStream = fs_1.default.createReadStream(fullPath);
        // ctx.body = readStream as any;
        return {
            mimeType: info.mimeType,
            length: info.length,
            lastModified: info.lastModified,
            readStream: readStream,
        };
    }
    async actuallyDeleteGraphic(id) {
        const folderPath = path_1.default.join(this.FILE_PATH, this.toFileName(id));
        if (!(await this.fileExists(folderPath)))
            return false;
        await fs_1.default.promises.rm(folderPath, { recursive: true });
        return true;
    }
    async markGraphicForRemoval(id) {
        // Mark the Graphic for removal, but keep it for a while.
        // The reason for this is to not delete a Graphic that is currently on-air
        // (which might break due to missing resources)
        const folderPath = path_1.default.join(this.FILE_PATH, this.toFileName(id));
        const removalFilePath = path_1.default.join(folderPath, "__markedForRemoval");
        if (!(await this.fileExists(folderPath)))
            return false;
        await fs_1.default.promises.writeFile(removalFilePath, `${Date.now() + this.REMOVAL_WAIT_TIME}`, "utf-8");
        return true;
    }
    /** Find any graphics that are due to be removed */
    async removeExpiredGraphics() {
        const folderList = await fs_1.default.promises.readdir(this.FILE_PATH);
        for (const folder of folderList) {
            const { id } = this.fromFileName(folder);
            if (!(await this.isGraphicMarkedForRemoval(id)))
                continue;
            const removalFilePath = path_1.default.join(this.FILE_PATH, folder, "__markedForRemoval");
            const removalTimeStr = await fs_1.default.promises.readFile(removalFilePath, "utf-8");
            const removalTime = parseInt(removalTimeStr);
            if (Number.isNaN(removalTime)) {
                continue;
            }
            if (Date.now() > removalTime) {
                // Time to remove the Graphic
                await this.actuallyDeleteGraphic(id);
            }
        }
    }
    /** Returns true if a graphic exists (and is not marked for removal) */
    async isGraphicMarkedForRemoval(id) {
        const removalFilePath = path_1.default.join(this.FILE_PATH, this.toFileName(id), "__markedForRemoval");
        return await this.fileExists(removalFilePath);
    }
    async isManifestFile(filePath, fileContents) {
        if (filePath.endsWith(".ograf"))
            return false;
        // Use content to determine which files are manifest files:
        //{
        //  "$schema": "https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json"
        //}
        // console.log("---", filePath);
        let contentStr = undefined;
        if (fileContents instanceof Buffer) {
            try {
                contentStr = fileContents.toString("utf8");
            }
            catch (_err) {
                console.log(`isManifestFile "${filePath}" check failed`, _err);
                return false;
            }
        }
        else if (typeof fileContents === "string") {
            contentStr = fileContents;
        }
        // const contentStr = await fs.promises.readFile(filePath, "utf-8");
        const expectSchemaContent = `https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json`;
        if (!(typeof contentStr === "string" &&
            contentStr.includes(`"$schema"`) &&
            contentStr.includes(`"${expectSchemaContent}"`))) {
            console.log(`isManifestFile "${filePath}" check failed`, "initial content");
            return false;
        }
        // Check that it's valid JSON:
        try {
            const content = JSON.parse(contentStr);
            if (content.$schema !== expectSchemaContent) {
                console.log(`isManifestFile "${filePath}" check failed`, "bad $schema", content.$schema, expectSchemaContent);
                return false;
            }
            return true;
        }
        catch (err) {
            console.error(`isManifestFile "${filePath}" check failed`, "Invalid JSON in manifest file", filePath, err);
            return false;
        }
    }
    get manifestFilePath() {
        // internal manifest file name
        return "manifest.json";
    }
}
exports.GraphicsStore = GraphicsStore;
