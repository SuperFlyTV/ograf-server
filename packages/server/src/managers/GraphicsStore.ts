import fs from 'fs'
import mime from 'mime-types'
import path from 'path'
import decompress from 'decompress'
import { GraphicsManifest, ServerApi } from 'ograf'
import { CTX } from '../lib/lib.js'

export class GraphicsStore {
	/** File path where to store Graphics */
	private FILE_PATH = path.resolve('./localGraphicsStorage')
	/** How long to wait before removing Graphics, in ms */
	private REMOVAL_WAIT_TIME = 1000 * 3600 * 24 // 24 hours

	constructor() {
		// Ensure the directory exists
		fs.mkdirSync(this.FILE_PATH, { recursive: true })

		this.init().catch(console.error)
	}
	private async init() {
		await this.migrateOldFolders()

		setInterval(
			() => {
				this.removeExpiredGraphics().catch(console.error)
			},
			1000 * 3600 * 24
		) // Check every 24 hours
		// Also do a check now:
		await this.removeExpiredGraphics()
	}
	/** Find a manifest file in a folder */
	private async findManifestFile(graphicsFolder: string): Promise<string> {
		const files = await fs.promises.readdir(graphicsFolder, {
			withFileTypes: true,
		})
		for (const file of files) {
			if (
				file.isFile() &&
				(file.name.endsWith('.ograf.json') || // Current v1 requirement, as of 2025-07-13
					file.name.endsWith('.ograf') || // File name from 2025-06-13 to 2025-07-13
					file.name === 'manifest.json') // Legacy, initial manifest file name
			) {
				return path.join(graphicsFolder, file.name)
			}
		}

		throw new Error(`No OGraf manifest found in folder ${graphicsFolder}`)
	}
	async listGraphics(): Promise<ServerApi.components['schemas']['GraphicListInfo'][]> {
		const folderList = await fs.promises.readdir(this.FILE_PATH)

		const graphics: ServerApi.components['schemas']['GraphicListInfo'][] = []
		for (const folder of folderList) {
			let id: string
			try {
				const o = this.fromFileName(folder)
				id = o.id
			} catch (e) {
				console.error(e)
				continue
			}

			if (await this.isGraphicMarkedForRemoval(id)) continue

			const graphicInfo = await this.getGraphicInfo(id)
			if (!graphicInfo) continue

			graphics.push({
				id: graphicInfo.graphic.id,
				name: graphicInfo.graphic.name,
				description: graphicInfo.graphic.description,
			})
		}
		return graphics
	}
	async getGraphicInfo(id: string): Promise<
		| {
				graphic: ServerApi.components['schemas']['GraphicManifest']
				metadata: ServerApi.components['schemas']['GraphicMetadata']
		  }
		| undefined
	> {
		const folder = this.toFileName(id)

		// Don't list Graphics that are marked for removal:
		if (await this.isGraphicMarkedForRemoval(id)) return undefined

		const manifestFilePath = await this.findManifestFile(path.join(this.FILE_PATH, folder))

		const pStat = fs.promises.stat(manifestFilePath)

		const manifest = JSON.parse(await fs.promises.readFile(manifestFilePath, 'utf8')) as GraphicsManifest

		// Ensure the id match:
		if (id !== manifest.id) {
			console.error(`Folder name ${folder} does not match manifest id ${manifest.id}`)
			return undefined
		}

		const stat = await pStat

		return {
			graphic: manifest as any, // the types don't exactly match, due to differences in generation
			metadata: {
				createdBy: manifest.author,
				createdAt: new Date(stat.ctimeMs).toISOString(),
				updatedAt: new Date(stat.mtimeMs).toISOString(),
				// updatedBy: N/A
			} satisfies ServerApi.components['schemas']['GraphicMetadata'],
		}
	}

	async getGraphicManifest(id: string): Promise<ServerApi.components['schemas']['GraphicManifest'] | undefined> {
		const manifestPath = await this.findManifestFile(path.join(this.FILE_PATH, this.toFileName(id)))
		console.log('manifestPath', manifestPath)
		if (!(await this.fileExists(manifestPath))) return undefined

		const graphicManifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
		if (!graphicManifest) return undefined
		return graphicManifest
	}
	async deleteGraphic(id: string, force: boolean | undefined): Promise<boolean> {
		if (force) {
			return this.actuallyDeleteGraphic(id)
		} else {
			return this.markGraphicForRemoval(id)
		}
	}
	async getGraphicResource(id: string, localPath: string): Promise<ServeFile | undefined> {
		return this.serveFile(
			path.join(
				this.FILE_PATH,
				this.toFileName(id),

				localPath
			)
		)
	}

	async uploadGraphic(ctx: CTX): Promise<void> {
		console.log('uploadGraphic')

		// Expect a zipped file that contains the Graphic
		const file = (ctx.request as any).file

		console.log('Uploaded file', file.originalname, file.size)

		if (!['application/x-zip-compressed', 'application/zip'].includes(file.mimetype)) {
			ctx.status = 400
			ctx.body = {
				code: 400,
				message: 'Expected a zip file',
				data: { errorType: 'Error' },
			}
			return
		}

		const tempZipPath = file.path

		const decompressPath = path.resolve('tmpGraphic')

		const cleanup = async () => {
			try {
				await fs.promises.rm(decompressPath, { recursive: true })
			} catch (err: any) {
				if (err.code !== 'ENOENT') throw err
			}
		}
		try {
			await cleanup()

			const files = await decompress(tempZipPath, decompressPath)

			const uploadedGraphics: { id: string; version?: string }[] = []

			// const manifests = [];
			// const manifests = files.filter(
			//   (f) =>
			//     f.path.endsWith(".ograf.json") || f.path.endsWith("manifest.json")
			// );
			// if (!manifests.length)
			//   throw new Error("No OGraf manifests found in zip file");

			// Use content to determine which files are manifest files:
			//{
			//  "$schema": "https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json"
			//}
			// const manifests = []
			// for (const f of files) {
			//   if (await this.isManifestFile(f.path, f.data)) {
			//     manifests.push(f);
			//   }
			// }
			// if (!manifests.length)
			//   throw new Error("No manifest files found in zip file");
			let foundManifestCount = 0
			for (const file of files) {
				const basePath = path.dirname(file.path)

				if (!(await this.isManifestFile(file.path, file.data))) {
					continue
				}
				foundManifestCount++

				const manifestDataStr = file.data.toString('utf8')
				const manifestData = JSON.parse(manifestDataStr) as GraphicsManifest

				const id = manifestData.id

				const folderPath = path.join(this.FILE_PATH, this.toFileName(id))

				// Check if the Graphic already exists
				let alreadyExists = false
				if (await this.fileExists(folderPath)) {
					alreadyExists = true

					// Remove the graphic if it already exists:
					await this.actuallyDeleteGraphic(id)
					alreadyExists = false

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
					await cleanup()

					ctx.status = 409 // conflict
					ctx.body = {
						code: 409,
						message: 'Graphic already exists',
						data: { errorType: 'Error' },
					}
					return
				}

				// Copy the files to the right folder:
				await fs.promises.mkdir(folderPath, { recursive: true })

				const graphicFiles = files.filter((f) => f.path.startsWith(basePath))

				// Then, copy files:
				for (const innerFile of graphicFiles) {
					if (innerFile.type !== 'file') continue

					const filePath = innerFile.path.slice(basePath.length) // Remove the base path

					const outputFilePath = path.join(folderPath, filePath)
					const outputFolderPath = path.dirname(outputFilePath)
					// ensure dir:
					try {
						await fs.promises.mkdir(outputFolderPath, {
							recursive: true,
						})
					} catch (err) {
						if (!`${err}`.includes('EEXIST')) throw err // Ignore "already exists" errors
					}

					// Copy data:
					await fs.promises.writeFile(outputFilePath, innerFile.data)
				}
				// Also, copy manifest to special file:

				await fs.promises.writeFile(path.join(folderPath, this.manifestFilePath), manifestDataStr)

				uploadedGraphics.push({ id })
			}

			if (foundManifestCount === 0) {
				throw new Error('No manifest files found in zip file')
			}

			ctx.status = 200
			ctx.body = {
				graphics: uploadedGraphics,
			}

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
			await cleanup()
		}
	}

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.promises.access(filePath)
			return true
		} catch {
			return false
		}
	}

	private toFileName(id: string) {
		return `graphic-${id}`
	}
	private fromFileName(filename: string): { id: string } {
		const m = filename.match(/graphic-(.+)/)
		if (!m) throw new Error(`Invalid filename ${filename}`)
		return { id: m[1] }
	}
	isImmutable(version: string | undefined): boolean {
		// If the version is "0", the graphic is considered mutable
		// ie, it is a non-production version, in development
		// Otherwise it is considered immutable.
		return `${version}` !== '0'
	}

	private async getFileInfo(filePath: string): Promise<
		| {
				found: false
		  }
		| {
				found: true
				mimeType: string
				length: number
				lastModified: Date
		  }
	> {
		if (!(await this.fileExists(filePath))) {
			return { found: false }
		}
		let mimeType = mime.lookup(filePath)
		if (!mimeType) {
			// Fallback to "unknown binary":
			mimeType = 'application/octet-stream'
		}

		const stat = await fs.promises.stat(filePath)

		return {
			found: true,
			mimeType,
			length: stat.size,
			lastModified: stat.mtime,
		}
	}
	private async serveFile(fullPath: string): Promise<ServeFile | undefined> {
		const info = await this.getFileInfo(fullPath)

		if (!info.found) return undefined

		// ctx.type = info.mimeType;
		// ctx.length = info.length;
		// ctx.lastModified = info.lastModified;

		// if (immutable) {
		//   ctx.header["Cache-Control"] = "public, max-age=31536000, immutable";
		// } else {
		//   // Never cache:
		//   ctx.header["Cache-Control"] = "no-store";
		// }

		const readStream = fs.createReadStream(fullPath)
		// ctx.body = readStream as any;

		return {
			mimeType: info.mimeType,
			length: info.length,
			lastModified: info.lastModified,
			readStream: readStream,
		}
	}

	private async actuallyDeleteGraphic(id: string): Promise<boolean> {
		const folderPath = path.join(this.FILE_PATH, this.toFileName(id))

		if (!(await this.fileExists(folderPath))) return false
		await fs.promises.rm(folderPath, { recursive: true })

		return true
	}
	private async markGraphicForRemoval(id: string): Promise<boolean> {
		// Mark the Graphic for removal, but keep it for a while.
		// The reason for this is to not delete a Graphic that is currently on-air
		// (which might break due to missing resources)

		const folderPath = path.join(this.FILE_PATH, this.toFileName(id))

		const removalFilePath = path.join(folderPath, '__markedForRemoval')

		if (!(await this.fileExists(folderPath))) return false
		await fs.promises.writeFile(removalFilePath, `${Date.now() + this.REMOVAL_WAIT_TIME}`, 'utf-8')
		return true
	}
	/** Find any graphics that are due to be removed */
	private async removeExpiredGraphics() {
		const folderList = await fs.promises.readdir(this.FILE_PATH)
		for (const folder of folderList) {
			const { id } = this.fromFileName(folder)

			if (!(await this.isGraphicMarkedForRemoval(id))) continue

			const removalFilePath = path.join(this.FILE_PATH, folder, '__markedForRemoval')

			const removalTimeStr = await fs.promises.readFile(removalFilePath, 'utf-8')
			const removalTime = parseInt(removalTimeStr)
			if (Number.isNaN(removalTime)) {
				continue
			}

			if (Date.now() > removalTime) {
				// Time to remove the Graphic
				await this.actuallyDeleteGraphic(id)
			}
		}
	}

	/** Find any folders that are of from the old version, and migrate them */
	private async migrateOldFolders() {
		const folderList = await fs.promises.readdir(this.FILE_PATH)
		for (const folder of folderList) {
			let fileNameIsOk = false
			try {
				this.fromFileName(folder)
				fileNameIsOk = true
			} catch (e) {
				if (`${e}`.match(/Invalid filename/)) {
					fileNameIsOk = false
				} else throw e
			}
			if (fileNameIsOk) continue

			try {
				// Find manifest in folder:
				const manifestFilePath = await this.findManifestFile(path.join(this.FILE_PATH, folder))

				const manifest = JSON.parse(await fs.promises.readFile(manifestFilePath, 'utf8')) as GraphicsManifest

				// Rename the folder using the manifest id:
				const newFolderName = this.toFileName(manifest.id)
				await fs.promises.rename(path.join(this.FILE_PATH, folder), path.join(this.FILE_PATH, newFolderName))
			} catch (err) {
				if (`${err}`.match(/No OGraf manifest found/)) continue
				else throw err
			}
			console.error(`Unknown folder "${folder}"`)
		}
	}

	/** Returns true if a graphic exists (and is not marked for removal) */
	private async isGraphicMarkedForRemoval(id: string): Promise<boolean> {
		const removalFilePath = path.join(this.FILE_PATH, this.toFileName(id), '__markedForRemoval')
		return await this.fileExists(removalFilePath)
	}
	private async isManifestFile(filePath: string, fileContents: Buffer | string): Promise<boolean> {
		if (filePath.endsWith('.ograf')) return true

		// Use content to determine which files are manifest files:
		//{
		//  "$schema": "https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json"
		//}

		// console.log("---", filePath);
		let contentStr = undefined
		if (fileContents instanceof Buffer) {
			try {
				contentStr = fileContents.toString('utf8')
			} catch (_err) {
				console.log(`isManifestFile "${filePath}" check failed`, _err)
				return false
			}
		} else if (typeof fileContents === 'string') {
			contentStr = fileContents
		}
		// const contentStr = await fs.promises.readFile(filePath, "utf-8");
		const expectSchemaContent = `https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json`
		if (
			!(
				typeof contentStr === 'string' &&
				contentStr.includes(`"$schema"`) &&
				contentStr.includes(`"${expectSchemaContent}"`)
			)
		) {
			console.log(`isManifestFile "${filePath}" check failed`, 'initial content')
			return false
		}

		// Check that it's valid JSON:
		try {
			const content = JSON.parse(contentStr)

			if (content.$schema !== expectSchemaContent) {
				console.log(`isManifestFile "${filePath}" check failed`, 'bad $schema', content.$schema, expectSchemaContent)
				return false
			}

			return true
		} catch (err) {
			console.error(`isManifestFile "${filePath}" check failed`, 'Invalid JSON in manifest file', filePath, err)
			return false
		}
	}
	private get manifestFilePath(): string {
		// internal manifest file name
		return 'manifest.json'
	}
}

export interface ServeFile {
	mimeType: string
	length: number
	lastModified: Date
	readStream: fs.ReadStream
}
