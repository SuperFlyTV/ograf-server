/* eslint-disable n/no-unsupported-features/node-builtins */
/**
 * Custom Controller GUI support for OGraf
 */

export interface UserInterfaceComponentInfo {
	id: string
	name: string
	description?: string
	supportedRenderTypes: string[]
	componentClass: CustomElementConstructor
}

export interface StartEventDetail {
	commandId: string
	arg: unknown
}

export interface EndEventDetail {
	commandId: string
	arg: unknown
	result: unknown
}

export function getStartEvent(eventType: string, commandId: string, arg: unknown): CustomEvent<StartEventDetail> {
	return new CustomEvent(eventType, {
		bubbles: true,
		cancelable: false,
		detail: {
			commandId,
			arg,
		},
	})
}

export function getEndEvent(
	eventType: string,
	commandId: string,
	arg: unknown,
	result: unknown
): CustomEvent<EndEventDetail> {
	return new CustomEvent(eventType, {
		bubbles: true,
		cancelable: false,
		detail: {
			commandId,
			arg,
			result,
		},
	})
}

/**
 * Filter module exports for Web Components that expose static type = 'user-interface'
 */
export function findUserInterfaceComponents(moduleExports: Record<string, unknown>): UserInterfaceComponentInfo[] {
	const components: UserInterfaceComponentInfo[] = []
	if (!moduleExports || typeof moduleExports !== 'object') return components

	for (const [key, exp] of Object.entries<any>(moduleExports)) {
		if (!exp || typeof exp !== 'function') continue
		if (exp.type !== 'user-interface') continue

		const rawSupported = exp.supportedRenderType ?? exp.supportedRenterType
		const supported = Array.isArray(rawSupported)
			? rawSupported
			: typeof rawSupported === 'string'
				? [rawSupported]
				: ['realtime']

		if (!supported.includes('realtime')) continue

		components.push({
			id: key,
			name: typeof exp.name === 'string' && exp.name ? exp.name : key,
			description: typeof exp.description === 'string' ? exp.description : undefined,
			supportedRenderTypes: supported,
			componentClass: exp,
		})
	}
	return components
}

export function getCustomGuiElementName(graphicId: string, componentId: string): string {
	const safeGraphicId = graphicId.toLowerCase().replace(/[^a-z0-9]/g, '_')
	const safeComponentId = componentId.toLowerCase().replace(/[^a-z0-9]/g, '_')
	return `ograf-gui-${safeGraphicId}-${safeComponentId}`
}

const componentClassRegistry = new Map<string, CustomElementConstructor>()

export function registerCustomGuiComponent(
	graphicId: string,
	componentId: string,
	componentClass: CustomElementConstructor
): string {
	const tagName = getCustomGuiElementName(graphicId, componentId)
	if (!componentClassRegistry.has(tagName)) {
		componentClassRegistry.set(tagName, componentClass)
	}
	const rawClass = componentClassRegistry.get(tagName) || componentClass

	if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
		try {
			customElements.define(tagName, rawClass)
		} catch (err) {
			console.error(`Failed to register custom element ${tagName}:`, err)
		}
	}
	return tagName
}

export function getCustomGuiComponentClass(tagName: string): CustomElementConstructor | undefined {
	return componentClassRegistry.get(tagName)
}

const customGuiCache = new Map<string, Promise<UserInterfaceComponentInfo[]>>()

export async function loadGraphicUserInterfaces(moduleUrl: string): Promise<UserInterfaceComponentInfo[]> {
	const existingPromise = customGuiCache.get(moduleUrl)
	if (existingPromise) return existingPromise

	const loadPromise = (async () => {
		try {
			const mod = await import(/* @vite-ignore */ moduleUrl)
			return findUserInterfaceComponents(mod)
		} catch (err) {
			console.error(`Failed to load custom GUI module from ${moduleUrl}:`, err)
			return []
		}
	})()

	customGuiCache.set(moduleUrl, loadPromise)
	return loadPromise
}

export interface OgrafBridgeCallbacks {
	executeAction: (action: string, arg: unknown) => Promise<unknown>
	onDataChanged?: (newData: unknown) => void
}

export interface OgrafControllerInterface {
	on(event: string, callback: (event: CustomEvent) => void): void
	off(event: string, callback: (event: CustomEvent) => void): void
	playAction(params?: unknown): Promise<unknown>
	stopAction(params?: unknown): Promise<unknown>
	updateAction(params: { data: unknown; skipAnimation?: boolean }): Promise<unknown>
	customAction(params: unknown, payload?: unknown): Promise<unknown>
	goToTime(params: unknown): Promise<unknown>
	setActionsSchedule(params: unknown): Promise<unknown>
}

let commandCounter = 0

export class OgrafBridge implements OgrafControllerInterface {
	private listeners: Map<string, Set<(event: CustomEvent) => void>> = new Map()

	constructor(private callbacks: OgrafBridgeCallbacks) {}

	public on(event: string, callback: (event: CustomEvent) => void): void {
		let set = this.listeners.get(event)
		if (!set) {
			set = new Set()
			this.listeners.set(event, set)
		}
		set.add(callback)
	}

	public off(event: string, callback: (event: CustomEvent) => void): void {
		this.listeners.get(event)?.delete(callback)
	}

	public emit(eventType: string, event: CustomEvent): void {
		const cbs = this.listeners.get(eventType)
		if (cbs) {
			for (const cb of cbs) {
				try {
					cb(event)
				} catch (err) {
					console.error(`Error in event listener for ${eventType}:`, err)
				}
			}
		}
	}

	public notifyActionStart(actionName: string, arg: unknown): string {
		const commandId = `cmd_${Date.now()}_${++commandCounter}`
		const startEvent = getStartEvent(`${actionName}Start`, commandId, arg)
		this.emit(`${actionName}Start`, startEvent)
		return commandId
	}

	public notifyActionEnd(actionName: string, commandId: string, arg: unknown, result: unknown): void {
		const endEvent = getEndEvent(`${actionName}End`, commandId, arg, result)
		this.emit(`${actionName}End`, endEvent)

		// Alias to actionName (e.g. 'playAction')
		const aliasEvent = getEndEvent(actionName, commandId, arg, result)
		this.emit(actionName, aliasEvent)
	}

	public async playAction(params?: unknown): Promise<unknown> {
		const commandId = this.notifyActionStart('playAction', params)
		try {
			const result = await this.callbacks.executeAction('playAction', params)
			this.notifyActionEnd('playAction', commandId, params, result)
			return result
		} catch (err) {
			this.notifyActionEnd('playAction', commandId, params, {
				error: err instanceof Error ? err.message : String(err),
			})
			throw err
		}
	}

	public async stopAction(params?: unknown): Promise<unknown> {
		const commandId = this.notifyActionStart('stopAction', params)
		try {
			const result = await this.callbacks.executeAction('stopAction', params)
			this.notifyActionEnd('stopAction', commandId, params, result)
			return result
		} catch (err) {
			this.notifyActionEnd('stopAction', commandId, params, {
				error: err instanceof Error ? err.message : String(err),
			})
			throw err
		}
	}

	public async updateAction(params: { data: unknown; skipAnimation?: boolean }): Promise<unknown> {
		if (this.callbacks.onDataChanged && params?.data !== undefined) {
			this.callbacks.onDataChanged(params.data)
		}

		const commandId = this.notifyActionStart('updateAction', params)
		try {
			const result = await this.callbacks.executeAction('updateAction', params)
			this.notifyActionEnd('updateAction', commandId, params, result)
			return result
		} catch (err) {
			this.notifyActionEnd('updateAction', commandId, params, {
				error: err instanceof Error ? err.message : String(err),
			})
			throw err
		}
	}

	public async customAction(params: unknown, payload?: unknown): Promise<unknown> {
		let actionId: string
		let customPayload: unknown
		if (typeof params === 'string') {
			actionId = params
			customPayload = payload
		} else if (params && typeof params === 'object') {
			const p = params as Record<string, unknown>
			actionId = (p.id || p.customActionId || p.name) as string
			customPayload = p.payload !== undefined ? p.payload : p.params
		} else {
			throw new Error('customAction requires an action id or action object')
		}

		const actionArg = { id: actionId, payload: customPayload }
		const commandId = this.notifyActionStart('customAction', actionArg)
		try {
			const result = await this.callbacks.executeAction('customAction', actionArg)
			this.notifyActionEnd('customAction', commandId, actionArg, result)
			return result
		} catch (err) {
			this.notifyActionEnd('customAction', commandId, actionArg, {
				error: err instanceof Error ? err.message : String(err),
			})
			throw err
		}
	}

	public async goToTime(_params: unknown): Promise<unknown> {
		throw new Error('goToTime is only supported for non-realtime rendering')
	}

	public async setActionsSchedule(_params: unknown): Promise<unknown> {
		throw new Error('setActionsSchedule is only supported for non-realtime rendering')
	}
}
