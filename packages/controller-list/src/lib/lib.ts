import React from 'react'
import { getNameSpaceId } from './namespace.js'

/**
 * Helper function to simply assert that the value is of the type never.
 * Usage: at the end of if/else or switch, to ensure that there is no fallthrough.
 */
export function assertNever(_value: never): void {
	// does nothing
}

export function useStoredState<T extends string | number | object | undefined | boolean>(
	localStorageId: string,
	initialState?: T | (() => T)
): [T, (newValue: T) => void] {
	localStorageId = getNameSpaceId() + localStorageId // Ensure we have a unique localStorageId per namespace

	const [value, setValue] = React.useState(() => {
		const storedValueStr = window.localStorage.getItem(localStorageId)
		if (storedValueStr) {
			try {
				const storedValue = JSON.parse(storedValueStr)
				if (storedValue !== undefined) return storedValue
			} catch (e) {
				console.error('error parsing stored value from localStorage for key', localStorageId, e)
			}
		}
		return typeof initialState === 'function' ? initialState() : initialState
	})

	return [
		value,
		(newValue) => {
			if (newValue === undefined) window.localStorage.removeItem(localStorageId)
			else window.localStorage.setItem(localStorageId, JSON.stringify(newValue))

			setValue(newValue)
		},
	]
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function isEqual(a: any, b: any): boolean {
	if (typeof a !== typeof b) return false

	if (typeof a === 'object') {
		if (Array.isArray(a)) {
			if (!Array.isArray(b)) return false
			// Compare arrays
			if (a.length !== b.length) return false
			for (let i = 0; i < a.length; i++) {
				if (!isEqual(a[i], b[i])) return false
			}
			return true
		} else {
			// Compare objects
			if (Object.keys(a).length !== Object.keys(b).length) return false

			for (const key of Object.keys(a)) {
				if (!isEqual(a[key], b[key])) return false
			}
			return true
		}
	} else {
		return a === b
	}
}
export function clone<T>(obj: T): T {
	if (!obj) return obj
	return JSON.parse(JSON.stringify(obj))
}
