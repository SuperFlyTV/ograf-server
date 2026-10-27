import fs from 'fs'
import { Readable } from 'stream'
import mime from 'mime-types'
import path from 'path'
import decompress from 'decompress'
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	ListObjectsV2CommandOutput,
	PutObjectCommand,
	S3Client,
	S3ClientConfig,
} from '@aws-sdk/client-s3'
import { GraphicsManifest, ServerApi } from 'ograf'
import { CTX, getFullUrl, getRootUrl } from '../lib/lib.js'
import { ConfigOptions } from '../config.js'
import { FileAccountStore, IAccountStore } from './AccountStore.js'

export interface ServeFile {
	mimeType: string
	length: number
	lastModified: Date
	readStream: Readable
}

export interface IGraphicsStoreNS {
	init(): Promise<void>
	destroy(): void
	listGraphics(config: ConfigOptions): Promise<ServerApi.components['schemas']['GraphicListInfo'][]>
	getGraphicInfo(
		config: ConfigOptions,
		id: string,
		version: number | 'latest'
	): Promise<
		| {
				graphic: ServerApi.components['schemas']['GraphicManifest']
				metadata: ServerApi.components['schemas']['GraphicMetadata']
		  }
		| undefined
	>
	deleteGraphic(id: string, force: boolean | undefined): Promise<boolean>
	deleteAllGraphics(): Promise<void>
	getGraphicResource(id: string, version: number, localPath: string): Promise<ServeFile | undefined>
	getThumbnail(id: string, version: number | 'latest', file: string): Promise<ServeFile | undefined>
	uploadGraphic(ctx: CTX): Promise<void>
	getLatestVersion(id: string): Promise<number | undefined>
}

export abstract class BaseGraphicsStoreNS implements IGraphicsStoreNS {
	/** How long to wait before removing Graphics, in ms */
	protected REMOVAL_WAIT_TIME = 1000 * 3600 * 24 // 24 hours

	private checkInterVal: NodeJS.Timeout | undefined = undefined
	protected destroyed = false

	static PREFIX_FILE_NAME = 'graphic-'

	constructor(protected namespaceId: string) {}

	public async init(): Promise<void> {
		await this.ensureStoreReady()

		const baseInterval = 1000 * 3600 * 24 // Check every 24 hours
		const jitteredInterval = baseInterval + Math.floor(Math.random() * 1000 * 60 * 15) // +0-15m jitter across processes

		this.checkInterVal = setInterval(() => {
			this.removeExpiredGraphics().catch(console.error)
		}, jitteredInterval)
		// Also do a check now:
		await this.removeExpiredGraphics()
	}

	public destroy(): void {
		this.destroyed = true
		if (this.checkInterVal !== undefined) clearInterval(this.checkInterVal)
	}

	public async listGraphics(config: ConfigOptions): Promise<ServerApi.components['schemas']['GraphicListInfo'][]> {
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

	public async getGraphicInfo(
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

		if (!(await this.folderExists(folderName))) {
			return undefined
		}

		let manifestFile = await this.readTextFileInFolder(folderName, this.manifestFilePath)

		if (!manifestFile) {
			// Before we bail on this one, we'll try to do a migration of the folder first:
			const migrated = await this.tryMigrateFolder(folderName, id)
			if (migrated) {
				manifestFile = await this.readTextFileInFolder(folderName, this.manifestFilePath)
				if (!manifestFile) {
					console.error(`getGraphicInfo: Manifest file not found in "${folderName}", even after migration`)
					return undefined
				}
			} else {
				console.error(`getGraphicInfo: Manifest file not found in "${folderName}"`)
				return undefined
			}
		}

		const manifest = JSON.parse(manifestFile.content) as GraphicsManifest

		// Ensure the id match:
		if (id !== manifest.id) {
			console.error(`Folder name ${folderName} does not match manifest id ${manifest.id}`)
			return undefined
		}

		const url =
			getRootUrl(config) +
			getFullUrl(config, `/serverApi/internal/graphics/${o.id}/${o.version}/`).replace(':namespaceId', this.namespaceId)
		const files = await this.listAllFilesInFolder(folderName)

		return {
			graphic: manifest as any, // the types don't exactly match, due to differences in generation
			metadata: {
				createdBy: manifest.author,
				createdAt: manifestFile.createdAt.toISOString(),
				updatedAt: manifestFile.updatedAt.toISOString(),
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

	public async deleteGraphic(id: string, force: boolean | undefined): Promise<boolean> {
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

	public async getGraphicResource(id: string, version: number, localPath: string): Promise<ServeFile | undefined> {
		const folderName = await this.toFileName(id, version)
		if (!folderName) return undefined

		return this.serveFileInFolder(folderName, localPath)
	}

	public async getThumbnail(id: string, version: number | 'latest', file: string): Promise<ServeFile | undefined> {
		if (version === 'latest') {
			const latestVersion = await this.getLatestVersion(id)

			if (latestVersion === undefined) return undefined
			version = latestVersion
		}

		const folderName = await this.toFileName(id, version)

		if (!folderName) return undefined

		return this.serveFileInFolder(folderName, file)
	}

	public async uploadGraphic(ctx: CTX): Promise<void> {
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

		const cleanup = async () => {
			if (!tempZipPath) return
			try {
				await fs.promises.rm(tempZipPath, { force: true })
			} catch (err: any) {
				if (err.code !== 'ENOENT') console.error(`Failed to remove temp zip file "${tempZipPath}":`, err)
			}
		}
		try {
			// Decompress in-memory to avoid disk path collisions across concurrent uploads:
			const files = await decompress(tempZipPath)

			const uploadedGraphics: { id: string; version?: string }[] = []

			let foundManifestCount = 0
			for (const manifestEntry of files) {
				let basePath = path.dirname(manifestEntry.path)

				if (!(await this.isManifestFile(manifestEntry.path, manifestEntry.data))) {
					continue
				}
				foundManifestCount++

				const manifestDataStr = manifestEntry.data.toString('utf8')
				const manifestData = JSON.parse(manifestDataStr) as GraphicsManifest

				const id = manifestData.id
				const existingVersions = await this.getAllVersions(id)
				const highestVersion = existingVersions.length > 0 ? Math.max(...existingVersions) : undefined
				const newVersion = highestVersion !== undefined ? highestVersion + 1 : 0

				const folderName = await this.toFileName(id, newVersion)

				// Check if the Graphic already exists
				if (await this.folderExists(folderName)) {
					console.error(`Graphic with ID ${id} and version ${newVersion} already exists.`)
					ctx.status = 409 // conflict
					ctx.body = {
						code: 409,
						message: 'Graphic already exists',
						data: { errorType: 'Error' },
					}
					return
				}

				if (basePath === '.') basePath = '' // If the files are at the root of the zip, the basePath is '.'

				const graphicFiles = files.filter((f) => f.path.startsWith(basePath) && f.type === 'file')

				// 1. Write all graphic files into the store first:
				await Promise.all(
					graphicFiles.map(async (innerFile) => {
						const filePath = innerFile.path.slice(basePath.length).replace(/^[/\\]+/, '')
						await this.writeFileInFolder(folderName, filePath, innerFile.data)
					})
				)

				// 2. Write internal manifest file last as commit marker:
				await this.writeFileInFolder(folderName, this.manifestFilePath, manifestDataStr)

				// 3. Mark any previous versions for removal only AFTER the new version is ready:
				for (const oldVersion of existingVersions) {
					if (oldVersion < newVersion) {
						await this.markGraphicForRemoval(id, oldVersion)
					}
				}

				uploadedGraphics.push({ id })
			}

			if (foundManifestCount === 0) {
				throw new Error('No manifest files found in zip file')
			}

			ctx.status = 200
			ctx.body = {
				graphics: uploadedGraphics,
			}
		} finally {
			// clean up after ourselves:
			await cleanup()
		}
	}

	public async getLatestVersion(id: string): Promise<number | undefined> {
		const versions: number[] = []
		for (const folder of await this.listFolders()) {
			const { id: folderId, version } = this.fromFileName(folder)

			if (folderId === id) {
				if (await this.isGraphicMarkedForRemoval(id, version)) continue
				versions.push(version)
			}
		}
		if (versions.length > 0) {
			return Math.max(...versions)
		}

		return undefined
	}

	protected async getAllVersions(id: string): Promise<number[]> {
		const versions: number[] = []
		for (const folder of await this.listFolders()) {
			const { id: folderId, version } = this.fromFileName(folder)
			if (folderId === id) {
				versions.push(version)
			}
		}
		return versions
	}

	protected async toFileName(id: string, version: number): Promise<string> {
		return BaseGraphicsStoreNS.PREFIX_FILE_NAME + id + '__' + version
	}

	protected isFileNameValid(filename: string): boolean {
		if (!filename.startsWith(BaseGraphicsStoreNS.PREFIX_FILE_NAME)) return false

		const m = filename.match(new RegExp(`${BaseGraphicsStoreNS.PREFIX_FILE_NAME}(.+)__(\\d+)`))

		if (!m) return false
		const version = parseInt(m[2], 10)
		if (Number.isNaN(version)) return false

		return true
	}

	protected fromFileName(filename: string): { id: string; version: number } {
		if (!this.isFileNameValid(filename)) throw new Error(`Invalid filename ${filename}`)

		const m = filename.match(new RegExp(`${BaseGraphicsStoreNS.PREFIX_FILE_NAME}(.+)__(\\d+)`))

		if (!m) throw new Error(`Invalid filename after regex match: ${filename}`)

		const id = m[1]
		const version = parseInt(m[2], 10)

		if (Number.isNaN(version)) throw new Error(`Invalid version in filename: ${filename}`)

		return { id, version }
	}

	protected async actuallyDeleteGraphic(id: string, version: number): Promise<boolean> {
		const folderName = await this.toFileName(id, version)
		if (!folderName) return false

		return this.deleteFolder(folderName)
	}

	protected async markGraphicForRemoval(id: string, version: number): Promise<boolean> {
		// Mark the Graphic for removal, but keep it for a while.
		// The reason for this is to not delete a Graphic that is currently on-air
		// (which might break due to missing resources)
		const folderName = await this.toFileName(id, version)
		if (!folderName) return false

		if (!(await this.folderExists(folderName))) return false

		await this.writeFileInFolder(folderName, '__markedForRemoval', `${Date.now() + this.REMOVAL_WAIT_TIME}`)
		return true
	}

	/** Find any graphics that are due to be removed */
	protected async removeExpiredGraphics(): Promise<void> {
		if (this.destroyed) return

		for (const folder of await this.listFolders()) {
			const { id, version } = this.fromFileName(folder)

			const removalFile = await this.readTextFileInFolder(folder, '__markedForRemoval')
			if (!removalFile) continue

			const removalTime = parseInt(removalFile.content, 10)
			if (Number.isNaN(removalTime)) {
				continue
			}

			if (Date.now() > removalTime) {
				// Time to remove the Graphic
				await this.actuallyDeleteGraphic(id, version)
			}
		}
	}

	/** Returns true if a graphic is marked for removal */
	protected async isGraphicMarkedForRemoval(id: string, version: number): Promise<boolean> {
		const folderName = await this.toFileName(id, version)
		return this.fileExistsInFolder(folderName, '__markedForRemoval')
	}

	protected async isManifestFile(filePath: string, fileContents: Buffer | string): Promise<boolean> {
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

	protected get manifestFilePath(): string {
		// internal manifest file name
		return 'manifest.json'
	}

	protected async tryMigrateFolder(_folderName: string, _id: string): Promise<boolean> {
		return false
	}

	protected abstract ensureStoreReady(): Promise<void>
	protected abstract listFolders(onlyValid?: boolean): Promise<string[]>
	protected abstract folderExists(folderName: string): Promise<boolean>
	protected abstract fileExistsInFolder(folderName: string, relativePath: string): Promise<boolean>
	protected abstract readTextFileInFolder(
		folderName: string,
		relativePath: string
	): Promise<{ content: string; createdAt: Date; updatedAt: Date } | undefined>
	protected abstract writeFileInFolder(folderName: string, relativePath: string, data: Buffer | string): Promise<void>
	protected abstract serveFileInFolder(folderName: string, relativePath: string): Promise<ServeFile | undefined>
	protected abstract listAllFilesInFolder(folderName: string): Promise<{ path: string }[]>
	protected abstract deleteFolder(folderName: string): Promise<boolean>
	public abstract deleteAllGraphics(): Promise<void>
}

export class FileGraphicsStoreNS extends BaseGraphicsStoreNS {
	constructor(
		namespaceId: string,
		private folderPath: string
	) {
		super(namespaceId)
	}

	protected async ensureStoreReady(): Promise<void> {
		await fs.promises.mkdir(this.folderPath, { recursive: true })
		await this.migrateOldFolders()
	}

	protected async listFolders(onlyValid = true): Promise<string[]> {
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

	protected async folderExists(folderName: string): Promise<boolean> {
		return this.fileExists(path.join(this.folderPath, folderName))
	}

	protected async fileExistsInFolder(folderName: string, relativePath: string): Promise<boolean> {
		return this.fileExists(path.join(this.folderPath, folderName, relativePath))
	}

	protected async readTextFileInFolder(
		folderName: string,
		relativePath: string
	): Promise<{ content: string; createdAt: Date; updatedAt: Date } | undefined> {
		const filePath = path.join(this.folderPath, folderName, relativePath)
		if (!(await this.fileExists(filePath))) return undefined

		const stat = await fs.promises.stat(filePath)
		const content = await fs.promises.readFile(filePath, 'utf8')
		return {
			content,
			createdAt: new Date(stat.ctimeMs),
			updatedAt: new Date(stat.mtimeMs),
		}
	}

	protected async writeFileInFolder(folderName: string, relativePath: string, data: Buffer | string): Promise<void> {
		const outputFilePath = path.join(this.folderPath, folderName, relativePath)
		const outputFolderPath = path.dirname(outputFilePath)
		try {
			await fs.promises.mkdir(outputFolderPath, { recursive: true })
		} catch (err) {
			if (!`${err}`.includes('EEXIST')) throw err
		}
		if (typeof data === 'string') {
			await fs.promises.writeFile(outputFilePath, data, 'utf-8')
		} else {
			await fs.promises.writeFile(outputFilePath, data)
		}
	}

	protected async serveFileInFolder(folderName: string, relativePath: string): Promise<ServeFile | undefined> {
		const fullPath = path.join(this.folderPath, folderName, relativePath)
		const info = await this.getFileInfo(fullPath)
		if (!info.found) return undefined

		const readStream = fs.createReadStream(fullPath)
		return {
			mimeType: info.mimeType,
			length: info.length,
			lastModified: info.lastModified,
			readStream,
		}
	}

	protected async listAllFilesInFolder(folderName: string): Promise<{ path: string }[]> {
		return this.listAllFiles(path.join(this.folderPath, folderName))
	}

	protected async deleteFolder(folderName: string): Promise<boolean> {
		const folderPath = path.join(this.folderPath, folderName)
		if (!(await this.fileExists(folderPath))) return false

		await fs.promises.rm(folderPath, { recursive: true, force: true })
		return true
	}

	public async deleteAllGraphics(): Promise<void> {
		if (!(await this.fileExists(this.folderPath))) return
		const entries = await fs.promises.readdir(this.folderPath)
		for (const entry of entries) {
			await fs.promises.rm(path.join(this.folderPath, entry), {
				recursive: true,
				force: true,
			})
		}
	}

	protected override async tryMigrateFolder(folderName: string, id: string): Promise<boolean> {
		return this.migrateFolder(path.join(this.folderPath, folderName), id)
	}

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.promises.access(filePath, fs.constants.F_OK)
			return true
		} catch {
			return false
		}
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

export class S3GraphicsStoreNS extends BaseGraphicsStoreNS {
	private s3Client: S3Client
	private bucket: string
	private namespacePrefix: string

	constructor(namespaceId: string, config: ConfigOptions, s3Client?: S3Client) {
		super(namespaceId)
		if (typeof config.s3Bucket !== 'string' || !config.s3Bucket) {
			throw new Error('Internal Error: S3GraphicsStoreNS requires s3Bucket (S3_BUCKET) to be configured.')
		}
		this.bucket = config.s3Bucket
		this.s3Client = s3Client ?? createS3Client(config)

		const rawPrefix = config.s3Prefix ? config.s3Prefix.replace(/^\/+|\/+$/g, '') + '/' : ''
		this.namespacePrefix = `${rawPrefix}${this.namespaceId}/graphics/`
	}

	private getFolderKeyPrefix(folderName: string): string {
		return `${this.namespacePrefix}${folderName}/`
	}

	private getFileKey(folderName: string, relativePath: string): string {
		const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
		const parts = normalized.split('/')
		if (parts.includes('..')) {
			throw new Error(`Invalid file path "${relativePath}"`)
		}
		return `${this.getFolderKeyPrefix(folderName)}${normalized}`
	}

	protected async ensureStoreReady(): Promise<void> {
		// S3 bucket is assumed to exist
	}

	protected async listFolders(onlyValid = true): Promise<string[]> {
		const folders: string[] = []
		let continuationToken: string | undefined = undefined

		do {
			const res: ListObjectsV2CommandOutput = await this.s3Client.send(
				new ListObjectsV2Command({
					Bucket: this.bucket,
					Prefix: this.namespacePrefix,
					Delimiter: '/',
					ContinuationToken: continuationToken,
				})
			)
			for (const cp of res.CommonPrefixes ?? []) {
				if (!cp.Prefix) continue
				const folderName = cp.Prefix.slice(this.namespacePrefix.length).replace(/\/+$/, '')
				if (!folderName) continue
				if (!onlyValid || this.isFileNameValid(folderName)) {
					folders.push(folderName)
				}
			}
			continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
		} while (continuationToken)

		return folders
	}

	protected async folderExists(folderName: string): Promise<boolean> {
		const res = await this.s3Client.send(
			new ListObjectsV2Command({
				Bucket: this.bucket,
				Prefix: this.getFolderKeyPrefix(folderName),
				MaxKeys: 1,
			})
		)
		return (res.Contents?.length ?? 0) > 0
	}

	protected async fileExistsInFolder(folderName: string, relativePath: string): Promise<boolean> {
		try {
			await this.s3Client.send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: this.getFileKey(folderName, relativePath),
				})
			)
			return true
		} catch (err: any) {
			if (isS3NotFoundError(err)) return false
			throw err
		}
	}

	protected async readTextFileInFolder(
		folderName: string,
		relativePath: string
	): Promise<{ content: string; createdAt: Date; updatedAt: Date } | undefined> {
		try {
			const res = await this.s3Client.send(
				new GetObjectCommand({
					Bucket: this.bucket,
					Key: this.getFileKey(folderName, relativePath),
				})
			)
			if (!res.Body) return undefined
			const content = await res.Body.transformToString('utf-8')
			const lastModified = res.LastModified ?? new Date()
			return {
				content,
				createdAt: lastModified,
				updatedAt: lastModified,
			}
		} catch (err: any) {
			if (isS3NotFoundError(err)) return undefined
			throw err
		}
	}

	protected async writeFileInFolder(folderName: string, relativePath: string, data: Buffer | string): Promise<void> {
		const key = this.getFileKey(folderName, relativePath)
		const contentType = mime.lookup(relativePath) || 'application/octet-stream'
		const body = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data

		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: body,
				ContentType: contentType,
			})
		)
	}

	protected async serveFileInFolder(folderName: string, relativePath: string): Promise<ServeFile | undefined> {
		try {
			const res = await this.s3Client.send(
				new GetObjectCommand({
					Bucket: this.bucket,
					Key: this.getFileKey(folderName, relativePath),
				})
			)
			if (!res.Body) return undefined

			const mimeType = mime.lookup(relativePath) || res.ContentType || 'application/octet-stream'
			const length = res.ContentLength ?? 0
			const lastModified = res.LastModified ?? new Date()
			const readStream = res.Body as Readable

			return {
				mimeType,
				length,
				lastModified,
				readStream,
			}
		} catch (err: any) {
			if (isS3NotFoundError(err)) return undefined
			throw err
		}
	}

	protected async listAllFilesInFolder(folderName: string): Promise<{ path: string }[]> {
		const prefix = this.getFolderKeyPrefix(folderName)
		const files: { path: string }[] = []
		let continuationToken: string | undefined = undefined

		do {
			const res: ListObjectsV2CommandOutput = await this.s3Client.send(
				new ListObjectsV2Command({
					Bucket: this.bucket,
					Prefix: prefix,
					ContinuationToken: continuationToken,
				})
			)
			for (const obj of res.Contents ?? []) {
				if (!obj.Key) continue
				const relPath = obj.Key.slice(prefix.length)
				if (!relPath) continue
				files.push({ path: relPath })
			}
			continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
		} while (continuationToken)

		return files
	}

	protected async deleteFolder(folderName: string): Promise<boolean> {
		return this.deleteObjectsByPrefix(this.getFolderKeyPrefix(folderName))
	}

	public async deleteAllGraphics(): Promise<void> {
		await this.deleteObjectsByPrefix(this.namespacePrefix)
	}

	private async deleteObjectsByPrefix(prefix: string): Promise<boolean> {
		let deletedAny = false
		let continuationToken: string | undefined = undefined

		do {
			const listRes: ListObjectsV2CommandOutput = await this.s3Client.send(
				new ListObjectsV2Command({
					Bucket: this.bucket,
					Prefix: prefix,
					ContinuationToken: continuationToken,
				})
			)
			const objects = (listRes.Contents ?? [])
				.map((o) => o.Key)
				.filter((k): k is string => typeof k === 'string')
				.map((Key) => ({ Key }))

			if (objects.length > 0) {
				deletedAny = true
				await this.s3Client.send(
					new DeleteObjectsCommand({
						Bucket: this.bucket,
						Delete: {
							Objects: objects,
							Quiet: true,
						},
					})
				)
			}

			continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined
		} while (continuationToken)

		return deletedAny
	}
}

function isS3NotFoundError(err: any): boolean {
	if (!err) return false
	if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') return true
	if (err.$metadata?.httpStatusCode === 404) return true
	return false
}

export function createS3Client(config: ConfigOptions): S3Client {
	const clientConfig: S3ClientConfig = {
		region: config.s3Region || 'us-east-1',
	}
	if (config.s3Endpoint) {
		clientConfig.endpoint = config.s3Endpoint
	}
	if (config.s3ForcePathStyle !== undefined) {
		clientConfig.forcePathStyle = config.s3ForcePathStyle
	} else if (config.s3Endpoint) {
		// Default to path-style when a custom S3-compatible endpoint is provided
		clientConfig.forcePathStyle = true
	}
	if (config.s3AccessKeyId && config.s3SecretAccessKey) {
		clientConfig.credentials = {
			accessKeyId: config.s3AccessKeyId,
			secretAccessKey: config.s3SecretAccessKey,
		}
	}
	return new S3Client(clientConfig)
}

export function createGraphicsStoreNS(
	config: ConfigOptions,
	accountStore: IAccountStore,
	namespaceId: string,
	s3Client?: S3Client
): BaseGraphicsStoreNS {
	if (typeof config.s3Bucket === 'string' && config.s3Bucket) {
		return new S3GraphicsStoreNS(namespaceId, config, s3Client)
	}

	let folderPath: string
	if (accountStore.enable) {
		if (accountStore instanceof FileAccountStore) {
			folderPath = accountStore.graphicsFolderPath(namespaceId)
		} else {
			folderPath = path.resolve(config.namespacePath || './localGraphicsStorage', namespaceId, 'graphics')
		}
	} else {
		folderPath = path.resolve('./localGraphicsStorage')
	}

	return new FileGraphicsStoreNS(namespaceId, folderPath)
}

/** Backwards-compatible alias for FileGraphicsStoreNS */
export class GraphicsStoreNS extends FileGraphicsStoreNS {}
