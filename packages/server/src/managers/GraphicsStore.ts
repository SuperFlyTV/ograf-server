import fs from 'fs'
import mime from 'mime-types'
import path from 'path'
import decompress from 'decompress'
import { GraphicsManifest, ServerApi } from 'ograf'
import { CTX, getFullUrl, getRootUrl } from '../lib/lib.js'
import { ConfigOptions } from '../config.js'

export class GraphicsStoreNS {
	/** File path where to store Graphics */

	/** How long to wait before removing Graphics, in ms */
	private REMOVAL_WAIT_TIME = 1000 * 3600 * 24 // 24 hours

	private checkInterVal: NodeJS.Timeout | undefined = undefined
	private destroyed = false

	constructor(
		private namespaceId: string,
		private folderPath: string
	) {
		// Ensure the directory exists
	}
	public async init(): Promise<void> {
		await fs.promises.mkdir(this.folderPath, { recursive: true })

		await this.migrateOldFolders()

		this.checkInterVal = setInterval(
			() => {
				this.removeExpiredGraphics().catch(console.error)
			},
			1000 * 3600 * 24
		) // Check every 24 hours
		// Also do a check now:
		await this.removeExpiredGraphics()
	}
	destroy(): void {
		this.destroyed = true
		if (this.checkInterVal !== undefined) clearInterval(this.checkInterVal)
	}
	async listGraphics(config: ConfigOptions): Promise<ServerApi.components['schemas']['GraphicListInfo'][]> {
		const graphics: ServerApi.components['schemas']['GraphicListInfo'][] = []

		for (const folder of await this.listFolders()) {
			const { id, version } = this.fromFileName(folder)

			if (await this.isGraphicMarkedForRemoval(id, version)) continue

			const graphicInfo = await this.getGraphicInfo(config, id, version)
			if (!graphicInfo) continue

			graphics.push({
				id: graphicInfo.graphic.id,
				name: graphicInfo.graphic.name,
				description: graphicInfo.graphic.description,
				thumbnails: graphicInfo.graphic.thumbnails,
			})
		}
		return graphics
	}
	async getGraphicInfo(
		config: ConfigOptions,
		id: string,
		version: number | 'latest'
	): Promise<
		| {
				graphic: ServerApi.components['schemas']['GraphicManifest']
				metadata: ServerApi.components['schemas']['GraphicMetadata']
		  }
		| undefined
	> {
		if (version === 'latest') {
			const latestVersion = await this.getLatestVersion(id)
			if (latestVersion === undefined) return undefined
			version = latestVersion
		}
		const folderName = await this.toFileName(id, version)

		const o = this.fromFileName(folderName)

		// Don't list Graphics that are marked for removal:
		if (await this.isGraphicMarkedForRemoval(id, o.version)) return undefined

		const fullFolderPath = path.join(this.folderPath, folderName)

		if (!(await this.fileExists(fullFolderPath))) {
			return undefined
		}

		const manifestFilePath = path.join(fullFolderPath, this.manifestFilePath)

		if (!(await this.fileExists(manifestFilePath))) {
			// Before we bail on this one, we'll try to do a migration of the folder first:
			const migrated = await this.migrateFolder(fullFolderPath, id)
			if (migrated) {
				// Check again:
				if (!(await this.fileExists(manifestFilePath))) {
					console.error(`getGraphicInfo: Manifest file not found: "${manifestFilePath}", even after migration`)
					return undefined
				}
			} else {
				console.error(`getGraphicInfo: Manifest file not found: "${manifestFilePath}"`)
				return undefined
			}
		}

		const stat = await fs.promises.stat(manifestFilePath)

		const manifest = JSON.parse(await fs.promises.readFile(manifestFilePath, 'utf8')) as GraphicsManifest

		// Ensure the id match:
		if (id !== manifest.id) {
			console.error(`Folder name ${folderName} does not match manifest id ${manifest.id}`)
			return undefined
		}

		const url = getRootUrl() + getFullUrl(config, `/serverApi/internal/graphics/${o.id}/${o.version}/`)
		const files = await this.listAllFiles(fullFolderPath)

		return {
			graphic: manifest as any, // the types don't exactly match, due to differences in generation
			metadata: {
				createdBy: manifest.author,
				createdAt: new Date(stat.ctimeMs).toISOString(),
				updatedAt: new Date(stat.mtimeMs).toISOString(),
				// updatedBy: N/A

				// Not in specification (yet):
				content: {
					url: url,
					files: files,
				} satisfies {
					url: string
					files: {
						path: string
					}[]
				},
			} satisfies ServerApi.components['schemas']['GraphicMetadata'],
		}
	}

	// async getGraphicManifest(
	// 	id: string,
	// 	version: number | 'latest'
	// ): Promise<ServerApi.components['schemas']['GraphicManifest'] | undefined> {
	// 	if (version === 'latest') {
	// 		const latestVersion = await this.getLatestVersion(id)
	// 		if (latestVersion === undefined) return undefined
	// 		version = latestVersion
	// 	}

	// 	const folderName = await this.toFileName(id, version)
	// 	if (!folderName) return undefined

	// 	const manifestPath = await this.findManifestFile(path.join(this.folderPath, folderName))

	// 	if (!(await this.fileExists(manifestPath))) return undefined

	// 	const graphicManifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
	// 	if (!graphicManifest) return undefined

	// 	return graphicManifest
	// }
	async deleteGraphic(id: string, force: boolean | undefined): Promise<boolean> {
		const graphicsToDelete = (await this.listFolders())
			.map((folderName) => this.fromFileName(folderName))
			.filter((o) => {
				return o.id === id
			})

		for (const graphicToDelete of graphicsToDelete) {
			if (force) {
				await this.actuallyDeleteGraphic(graphicToDelete.id, graphicToDelete.version)
			} else {
				await this.markGraphicForRemoval(graphicToDelete.id, graphicToDelete.version)
			}
		}
		return graphicsToDelete.length > 0
	}
	async getGraphicResource(id: string, version: number, localPath: string): Promise<ServeFile | undefined> {
		const folderName = await this.toFileName(id, version)
		if (!folderName) return undefined

		return this.serveFile(
			path.join(
				this.folderPath,
				folderName,

				localPath
			)
		)
	}
	async getThumbnail(id: string, version: number | 'latest', file: string): Promise<ServeFile | undefined> {
		if (version === 'latest') {
			const latestVersion = await this.getLatestVersion(id)

			if (latestVersion === undefined) return undefined
			version = latestVersion
		}

		const folderName = await this.toFileName(id, version)

		if (!folderName) return undefined

		return this.serveFile(
			path.join(
				this.folderPath,
				folderName,

				file
			)
		)
	}

	async uploadGraphic(ctx: CTX): Promise<void> {
		// Expect a zipped file that contains the Graphic
		const file = (ctx.request as any).file

		console.debug('Uploaded file', file.originalname, file.size)

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

		const decompressPath = path.resolve(`tmpGraphic-${this.namespaceId}`)

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
				let basePath = path.dirname(file.path)

				if (!(await this.isManifestFile(file.path, file.data))) {
					continue
				}
				foundManifestCount++

				const manifestDataStr = file.data.toString('utf8')
				const manifestData = JSON.parse(manifestDataStr) as GraphicsManifest

				const id = manifestData.id
				let newVersion: number

				// if (version === 'latest') {
				// 	const latestVersion = await this.getLatestVersion(id)
				// 	if (latestVersion === undefined) return undefined
				// 	version = latestVersion
				// }
				const oldVersion = await this.getLatestVersion(id)
				if (oldVersion !== undefined) {
					newVersion = oldVersion + 1
					// Mark the old one for removal:
					await this.markGraphicForRemoval(id, oldVersion)
				} else {
					newVersion = 0
				}

				const folderName = await this.toFileName(id, newVersion)

				const folderPath = path.join(this.folderPath, folderName)

				// Check if the Graphic already exists
				let alreadyExists = false
				if (await this.fileExists(folderPath)) {
					alreadyExists = true

					// That's weird, a graphic with the same ID and version already exists.
					console.error(`Graphic with ID ${id} and version ${newVersion} already exists.`)

					// Remove the graphic if it already exists:
					// await this.actuallyDeleteGraphic(id)
					// alreadyExists = false

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

				if (basePath === '.') basePath = '' // If the files are at the root of the zip, the basePath is '.'

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
			await fs.promises.access(filePath, fs.constants.F_OK)
			return true
		} catch {
			return false
		}
	}

	static PREFIX_FILE_NAME = 'graphic-'
	private async toFileName(id: string, version: number): Promise<string> {
		return GraphicsStoreNS.PREFIX_FILE_NAME + id + '__' + version
	}
	private isFileNameValid(filename: string): boolean {
		if (!filename.startsWith(GraphicsStoreNS.PREFIX_FILE_NAME)) return false

		const m = filename.match(new RegExp(`${GraphicsStoreNS.PREFIX_FILE_NAME}(.+)__(\\d+)`))

		if (!m) return false
		const version = parseInt(m[2], 10)
		if (Number.isNaN(version)) return false

		return true
	}
	private fromFileName(filename: string): { id: string; version: number } {
		if (!this.isFileNameValid(filename)) throw new Error(`Invalid filename ${filename}`)

		const m = filename.match(new RegExp(`${GraphicsStoreNS.PREFIX_FILE_NAME}(.+)__(\\d+)`))

		if (!m) throw new Error(`Invalid filename after regex match: ${filename}`)

		const id = m[1]
		const version = parseInt(m[2], 10)

		if (Number.isNaN(version)) throw new Error(`Invalid version in filename: ${filename}`)

		return { id, version }
	}
	async getLatestVersion(id: string): Promise<number | undefined> {
		const versions: number[] = []
		for (const folder of await this.listFolders()) {
			const { id: folderId, version } = this.fromFileName(folder)

			if (folderId === id) {
				versions.push(version)
			}
		}
		if (versions.length > 0) {
			return Math.max(...versions)
		}

		return undefined
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

	private async actuallyDeleteGraphic(id: string, version: number): Promise<boolean> {
		const folderName = await this.toFileName(id, version)
		if (!folderName) return false

		const folderPath = path.join(this.folderPath, folderName)
		if (!(await this.fileExists(folderPath))) return false

		await fs.promises.rm(folderPath, { recursive: true })
		return true
	}
	private async markGraphicForRemoval(id: string, version: number): Promise<boolean> {
		// Mark the Graphic for removal, but keep it for a while.
		// The reason for this is to not delete a Graphic that is currently on-air
		// (which might break due to missing resources)

		const folderName = await this.toFileName(id, version)
		if (!folderName) return false

		const folderPath = path.join(this.folderPath, folderName)
		if (!(await this.fileExists(folderPath))) return false

		const removalFilePath = path.join(folderPath, '__markedForRemoval')
		await fs.promises.writeFile(removalFilePath, `${Date.now() + this.REMOVAL_WAIT_TIME}`, 'utf-8')
		return true
	}
	/** Find any graphics that are due to be removed */
	private async removeExpiredGraphics() {
		if (this.destroyed) return

		for (const folder of await this.listFolders()) {
			const { id, version } = this.fromFileName(folder)

			if (!(await this.isGraphicMarkedForRemoval(id, version))) continue

			const removalFilePath = path.join(this.folderPath, folder, '__markedForRemoval')

			const removalTimeStr = await fs.promises.readFile(removalFilePath, 'utf-8')
			const removalTime = parseInt(removalTimeStr)
			if (Number.isNaN(removalTime)) {
				continue
			}

			if (Date.now() > removalTime) {
				// Time to remove the Graphic
				await this.actuallyDeleteGraphic(id, version)
			}
		}
	}

	/**
	 * @returns List of folders in the graphics store
	 */
	private async listFolders(onlyValid = true): Promise<string[]> {
		let folderList = await fs.promises.readdir(this.folderPath, { withFileTypes: true })

		// Ensure only directories are considered.
		// (for example, macOS Finder drops a .DS_Store in any folder it has displayed. readdir() on one throws ENOTDIR.)
		folderList = folderList.filter((entry) => entry.isDirectory())

		if (onlyValid) {
			folderList = folderList.filter((entry) =>
				// Ensure only valid graphic folder names are considered.
				this.isFileNameValid(entry.name)
			)
		}

		return folderList.map((entry) => entry.name)
	}

	/** Find any folders that are of from the old version, and migrate them */
	private async migrateOldFolders() {
		// Migrate folders
		for (const folder of await this.listFolders(false)) {
			if (this.isFileNameValid(folder)) continue // No need to migrate this folder

			try {
				const oldFullFolderPath = path.join(this.folderPath, folder)

				// Find manifest in folder:

				// First, check if our manifest.json-file is there:
				const manifests: GraphicsManifest[] = []
				{
					const manifestFilePath = path.join(oldFullFolderPath, this.manifestFilePath)
					if (await this.fileExists(manifestFilePath)) {
						manifests.push(JSON.parse(await fs.promises.readFile(manifestFilePath, 'utf8')) as GraphicsManifest)
					}
				}
				// If out manifest.json file is not there, we can use the other manifest files:
				if (manifests.length === 0) {
					// Look for manifest files in the folder:
					const results = await this.findManifestFilesInFolder(oldFullFolderPath)

					for (const result of results) {
						manifests.push(result.manifest)
					}
				}
				if (manifests.length === 0) {
					throw new Error(`No OGraf manifest found in folder "${oldFullFolderPath}"`)
				}

				// Rename the folder using the manifest id:

				let dontRemoveOldFolder = false

				// If there are multiple manifest files, we'll copy it to multiple folders:
				for (const manifest of manifests) {
					const newFolderName = await this.toFileName(manifest.id, 0) // Just pick version 0
					const newFullFolderPath = path.join(this.folderPath, newFolderName)

					if (newFullFolderPath !== oldFullFolderPath) {
						if (await this.fileExists(newFullFolderPath)) {
							// If there already is a new one, we won't copy the old one.

							console.debug(
								`There already exists a folder at "${newFullFolderPath}", skipping copy of old folder "${oldFullFolderPath}"`
							)
						} else {
							// Copy to new folder:
							await fs.promises.cp(oldFullFolderPath, newFullFolderPath, { recursive: true })

							console.debug(`Copy old folder to new folder: "${oldFullFolderPath}" -> "${newFullFolderPath}"`)
						}
					} else {
						dontRemoveOldFolder = true
					}
				}

				if (!dontRemoveOldFolder) {
					await fs.promises.rm(oldFullFolderPath, { recursive: true })

					console.debug(`Removed invalid folder "${oldFullFolderPath}"`)
				}
			} catch (err) {
				if (`${err}`.match(/No OGraf manifest found/)) continue
				else throw err
			}
		}

		// Ensure that we have our internal manifest file for all graphics folders:
		for (const folder of await this.listFolders(false)) {
			try {
				if (!this.isFileNameValid(folder)) continue // At this point, the folder name should be valid

				const { id } = this.fromFileName(folder)

				const fullFolderPath = path.join(this.folderPath, folder)

				await this.migrateFolder(fullFolderPath, id)
			} catch (err) {
				if (`${err}`.match(/No OGraf manifest found/)) continue
				else throw err
			}
		}
	}

	/**
	 * Migrates a graphics folder to ensure it contains the correct internal manifest file.
	 * @returns true if any files changed
	 */
	private async migrateFolder(fullFolderPath: string, id: string): Promise<boolean> {
		try {
			const manifestFilePath = path.join(fullFolderPath, this.manifestFilePath)

			// Find manifest in folder:

			let manifest: GraphicsManifest | undefined = undefined
			// First, check if our manifest.json-file is there?
			{
				if (await this.fileExists(manifestFilePath)) {
					manifest = JSON.parse(await fs.promises.readFile(manifestFilePath, 'utf8')) as GraphicsManifest

					if (manifest.id == id)
						return false // All good, no need to do anything else
					else manifest = undefined
				}
			}

			if (!manifest) {
				// Look for a manifest file in the folder that matches the expected id:
				const results = await this.findManifestFilesInFolder(fullFolderPath)
				for (const result of results) {
					if (result.manifest.id === id) {
						manifest = result.manifest
						break
					}
				}
			}
			if (!manifest) {
				console.error(`No OGraf manifest found in folder "${fullFolderPath}" matching the id "${id}"`)

				throw new Error(`No OGraf manifest found in folder "${fullFolderPath}"`)
			}

			// Write the internal manifest file:
			await fs.promises.writeFile(manifestFilePath, JSON.stringify(manifest, null, 2))
			console.debug(`Written internal manifest file: "${manifestFilePath}"`)
			return true
		} catch (err) {
			if (`${err}`.match(/No OGraf manifest found/)) return false
			else throw err
		}
	}
	private async findManifestFilesInFolder(
		folderPath: string
	): Promise<{ manifestFilePath: string; manifest: GraphicsManifest }[]> {
		const results: { manifestFilePath: string; manifest: GraphicsManifest }[] = []

		const files = await fs.promises.readdir(folderPath, {
			withFileTypes: true,
		})
		for (const file of files) {
			if (
				file.isFile() &&
				(file.name.endsWith('.ograf.json') || // Current v1 requirement, as of 2025-07-13
					file.name.endsWith('.ograf') || // File name from 2025-06-13 to 2025-07-13
					file.name === 'manifest.json') // Legacy, initial manifest file name
			) {
				const manifestFilePath = path.join(folderPath, file.name)

				const manifest = JSON.parse(await fs.promises.readFile(manifestFilePath, 'utf8')) as GraphicsManifest

				results.push({
					manifestFilePath,
					manifest,
				})
			}
		}
		return results
	}

	/** Returns true if a graphic exists (and is not marked for removal) */
	private async isGraphicMarkedForRemoval(id: string, version: number): Promise<boolean> {
		const folderPath = await this.toFileName(id, version)

		const removalFilePath = path.join(this.folderPath, folderPath, '__markedForRemoval')
		return await this.fileExists(removalFilePath)
	}
	private async isManifestFile(filePath: string, fileContents: Buffer | string): Promise<boolean> {
		if (!filePath.endsWith('.ograf.json')) return false

		// Use content to determine which files are manifest files:
		//{
		//  "$schema": "https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json"
		//}

		let contentStr = undefined
		if (fileContents instanceof Buffer) {
			try {
				contentStr = fileContents.toString('utf8')
			} catch (_err) {
				console.error(`isManifestFile "${filePath}" check failed`, _err)
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
			console.error(`isManifestFile "${filePath}" check failed`, 'initial content')
			return false
		}

		// Check that it's valid JSON:
		try {
			const content = JSON.parse(contentStr)

			if (content.$schema !== expectSchemaContent) {
				console.error(`isManifestFile "${filePath}" check failed`, 'bad $schema', content.$schema, expectSchemaContent)
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
	/**
	 * List all files in the given folder.
	 * Includes files in all subdirectories recursively.
	 * Returned path is relative to the base folder.
	 */
	private async listAllFiles(baseFolderPath: string): Promise<{ path: string }[]> {
		const returnFiles: { path: string }[] = []
		const readFiles = async (baseFolder: string, currentFolder: string) => {
			const files = await fs.promises.readdir(path.join(baseFolder, currentFolder), { withFileTypes: true })

			await Promise.all(
				files.map(async (file) => {
					const filerRelativePath = path.join(currentFolder, file.name)

					if (file.isDirectory()) {
						await readFiles(baseFolder, filerRelativePath)
					} else {
						returnFiles.push({ path: filerRelativePath })
					}
				})
			)
		}
		await readFiles(baseFolderPath, '')
		return returnFiles
	}
}

export interface ServeFile {
	mimeType: string
	length: number
	lastModified: Date
	readStream: fs.ReadStream
}
