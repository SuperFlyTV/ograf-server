import { graphicsListStore, isPlaybackGroup } from '../stores/graphicsList.js'

export interface DragSource {
	id: string
	type: 'item' | 'group'
	groupId?: string
	index: number
}

export interface DragTarget {
	id: string
	type: 'item' | 'group'
	groupId?: string
	index: number
	position: 'before' | 'after' | 'inside'
	element: HTMLElement
}

let activeSource: DragSource | null = null
let currentTarget: DragTarget | null = null
let activeIndicatorEl: HTMLElement | null = null

function clearActiveIndicator() {
	if (activeIndicatorEl) {
		activeIndicatorEl.classList.remove('dnd-drop-before', 'dnd-drop-after', 'dnd-drop-inside')
		activeIndicatorEl = null
	}
	currentTarget = null
}

export const dndManager = {
	startDrag(source: DragSource): void {
		activeSource = source
		clearActiveIndicator()
		document.body.classList.add('dnd-dragging-active')
		console.log('[react-draggable] startDrag', source)
	},

	updateDrag(clientX: number, clientY: number): void {
		if (!activeSource) return

		// Find elements under pointer
		const elements = document.elementsFromPoint(clientX, clientY)
		let foundTarget: DragTarget | null = null

		for (const el of elements) {
			const targetEl = el.closest('[data-dnd-entry-id]')
			if (!(targetEl instanceof HTMLElement)) continue

			const entryId = targetEl.getAttribute('data-dnd-entry-id')
			if (!entryId) continue

			const entryType = (targetEl.getAttribute('data-dnd-type') || 'item') as 'item' | 'group'
			const entryGroupId = targetEl.getAttribute('data-dnd-group-id') || undefined
			const entryIndex = parseInt(targetEl.getAttribute('data-dnd-index') || '0', 10)

			// Cannot drop on itself
			if (entryId === activeSource.id) continue

			// Groups cannot be dropped inside groups or other groups
			if (activeSource.type === 'group' && entryGroupId) continue

			// Check if dropping inside a group body
			const isGroupBody = Boolean(el.closest('[data-dnd-group-body]'))
			if (entryType === 'group' && isGroupBody && activeSource.type === 'item') {
				foundTarget = {
					id: entryId,
					type: 'group',
					groupId: undefined,
					index: entryIndex,
					position: 'inside',
					element: targetEl,
				}
				break
			}

			// Calculate before / after position based on bounding rect of targetEl
			const rect = targetEl.getBoundingClientRect()
			const relY = clientY - rect.top
			const position: 'before' | 'after' = relY < rect.height / 2 ? 'before' : 'after'

			foundTarget = {
				id: entryId,
				type: entryType,
				groupId: entryGroupId,
				index: entryIndex,
				position,
				element: targetEl,
			}
			break
		}

		if (
			!foundTarget ||
			!currentTarget ||
			foundTarget.id !== currentTarget.id ||
			foundTarget.position !== currentTarget.position
		) {
			clearActiveIndicator()
			if (foundTarget) {
				currentTarget = foundTarget
				activeIndicatorEl = foundTarget.element
				if (foundTarget.position === 'before') {
					activeIndicatorEl.classList.add('dnd-drop-before')
				} else if (foundTarget.position === 'after') {
					activeIndicatorEl.classList.add('dnd-drop-after')
				} else if (foundTarget.position === 'inside') {
					activeIndicatorEl.classList.add('dnd-drop-inside')
				}
			}
		}
	},

	endDrag(isCopy: boolean): void {
		document.body.classList.remove('dnd-dragging-active')
		const source = activeSource
		const target = currentTarget
		clearActiveIndicator()
		activeSource = null

		if (!source || !target) {
			console.log('[react-draggable] endDrag: no target')
			return
		}

		console.log('[react-draggable] endDrag apply', { source, target, isCopy })

		if (target.position === 'inside' && target.type === 'group') {
			// Dropped into group body
			const groupEntry = graphicsListStore.entries.find((e) => isPlaybackGroup(e) && e.id === target.id)
			const itemsCount = groupEntry && isPlaybackGroup(groupEntry) ? groupEntry.items?.length || 0 : 0
			graphicsListStore.moveOrCopyEntry(
				{ id: source.id, groupId: source.groupId },
				{ index: itemsCount, groupId: target.id },
				isCopy
			)
		} else {
			// Dropped before / after an item or group header
			const targetIndex = target.position === 'after' ? target.index + 1 : target.index
			graphicsListStore.moveOrCopyEntry(
				{ id: source.id, groupId: source.groupId },
				{ index: targetIndex, groupId: target.groupId },
				isCopy
			)
		}
	},

	cancelDrag(): void {
		document.body.classList.remove('dnd-dragging-active')
		clearActiveIndicator()
		activeSource = null
	},
}
