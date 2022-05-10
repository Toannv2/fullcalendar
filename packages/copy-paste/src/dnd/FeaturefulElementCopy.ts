import {
  PointerDragEvent,
  // preventSelection,
  allowSelection,
  // preventContextMenu,
  allowContextMenu, Emitter
} from '@fullcalendar/common'
// import { ElementMirror } from './ElementMirror'
// import { AutoScroller } from './AutoScroller'
import { PointerTracking } from '../interactions/PointerTracking'

/*
Monitors dragging on an element. Has a number of high-level features:
- minimum distance required before dragging
- minimum wait time ("delay") before dragging
- a mirror element that follows the pointer
*/
export class FeaturefulElementCopy {
  pointer: PointerTracking

  emitter: Emitter<any>

  // options that can be directly set by caller
  // the caller can also set the PointerDragging's options as well
  delay: number | null = null
  minDistance: number = 0
  touchScrollAllowed: boolean = true // prevents drag from starting and blocks scrolling during drag

  mirrorNeedsRevert: boolean = false
  isInteracting: boolean = false // is the user validly moving the pointer? lasts until pointerup
  isDragging: boolean = false // is it INTENTFULLY dragging? lasts until after revert animation
  isDelayEnded: boolean = false
  isDistanceSurpassed: boolean = false
  delayTimeoutId: number | null = null

  containerEl: HTMLElement

  constructor(containerEl: HTMLElement, selector?: string) {
    this.containerEl = containerEl

    this.emitter = new Emitter()

    let pointer = this.pointer = new PointerTracking(containerEl)
    pointer.emitter.on('pointer-copy', this.onPointerCopy)
    pointer.emitter.on('pointer-cut', this.onPointerCut)
    pointer.emitter.on('pointer-duplicate', this.onPointerDuplicate)
    pointer.emitter.on('pointer-paste', this.onPointerPaste)

    if (selector) {
      pointer.selector = selector
    }
  }

  destroy() {
    this.pointer.destroy()
  }

  onPointerCopy = (ev: PointerDragEvent) => {
    this.emitter.trigger('pointer-copy', ev)
  }

  onPointerCut = (ev: PointerDragEvent) => {
    this.emitter.trigger('pointer-cut', ev)
  }

  onPointerDuplicate = (ev: PointerDragEvent) => {
    this.emitter.trigger('pointer-duplicate', ev)
  }

  onPointerPaste = (ev: PointerDragEvent) => {
    allowSelection(document.body)
    allowContextMenu(document.body)

    this.emitter.trigger('pointer-paste', ev)
  }
}
