import { clone } from './lib.js'

export interface SchemaPropertyEntry {
	path: string
	key: string
	title: string
	type: string
	description?: string
	depth: number
	isObject: boolean
}

interface JsonSchemaNode {
	type?: string | string[]
	title?: string
	description?: string
	rank?: number
	gddType?: string
	hidden?: boolean
	properties?: Record<string, JsonSchemaNode>
	[key: string]: unknown
}

/**
 * Recursively extracts all property paths from an OGraf / JSON Schema object
 * so users can toggle `hidden` on individual properties in the Inspector.
 */
export function extractSchemaProperties(schema: unknown, parentPath = '', depth = 0): SchemaPropertyEntry[] {
	if (!schema || typeof schema !== 'object') return []
	const schemaNode = schema as JsonSchemaNode
	if (!schemaNode.properties) return []

	const propertiesRecord = schemaNode.properties
	const entries = Object.entries<JsonSchemaNode>(propertiesRecord).sort((a, b) => {
		const rankA = a[1]?.rank ?? 0
		const rankB = b[1]?.rank ?? 0
		return rankA - rankB
	})

	const result: SchemaPropertyEntry[] = []
	for (const [key, propSchema] of entries) {
		if (!propSchema || typeof propSchema !== 'object') continue
		const prop = propSchema
		const rawType = Array.isArray(prop.type) ? prop.type[0] : prop.type || 'string'
		const fullPath = parentPath ? `${parentPath}.${key}` : key
		const isObject = rawType === 'object' && Boolean(prop.properties)

		result.push({
			path: fullPath,
			key,
			title: prop.title || key,
			type: prop.gddType ? `${rawType} (${prop.gddType})` : String(rawType),
			description: prop.description,
			depth,
			isObject,
		})

		if (isObject) {
			result.push(...extractSchemaProperties(prop, fullPath, depth + 1))
		}
	}

	return result
}

/**
 * Returns a deep-cloned JSON schema where any property path in `hiddenProperties`
 * has `hidden: true` set on its schema definition.
 */
export function applyHiddenPropertiesToSchema<T>(schema: T, hiddenProperties?: string[]): T {
	if (!schema || typeof schema !== 'object') return schema
	const cloned = clone(schema)
	if (!hiddenProperties || hiddenProperties.length === 0) return cloned

	const hiddenSet = new Set(hiddenProperties)

	const walk = (node: JsonSchemaNode, currentPath: string) => {
		if (!node || typeof node !== 'object' || !node.properties) return
		for (const [key, propVal] of Object.entries<JsonSchemaNode>(node.properties)) {
			if (!propVal || typeof propVal !== 'object') continue
			const prop = propVal
			const propPath = currentPath ? `${currentPath}.${key}` : key
			if (hiddenSet.has(propPath)) {
				prop.hidden = true
			}
			if (prop.properties) {
				walk(prop, propPath)
				// If all child properties of a nested object are hidden, mark parent hidden too
				const childValues = Object.values<JsonSchemaNode>(prop.properties)
				if (childValues.length > 0 && childValues.every((c) => c && typeof c === 'object' && c.hidden === true)) {
					prop.hidden = true
				}
			}
		}
	}

	walk(cloned as JsonSchemaNode, '')
	return cloned
}
