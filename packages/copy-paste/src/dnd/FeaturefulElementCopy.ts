import {
  PointerDragEvent,
  allowSelection,
  allowContextMenu, Emitter, preventSelection, preventContextMenu
} from '@fullcalendar/common'
import { PointerTracking } from '../interactions/PointerTracking'
import { ElementMirror } from './ElementMirror'
import { AutoScroller } from './AutoScroller'

export class FeaturefulElementCopy {
  mirror: ElementMirror
  pointer: PointerTracking

  autoScroller: AutoScroller

  type: string = null

  emitter: Emitter<any>

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
    this.mirror = new ElementMirror()
    this.autoScroller = new AutoScroller()

    let pointer = this.pointer = new PointerTracking(containerEl)
    pointer.emitter.on('pointer-copy', this.onPointerCopy)
    pointer.emitter.on('pointer-cut', this.onPointerCut)
    pointer.emitter.on('pointer-paste', this.onPointerPaste)
    pointer.emitter.on('mousedown', this.onMousedown)
    pointer.emitter.on('mousemove', this.onMousemove)
    pointer.emitter.on('cleanup', this.cleanup)

    if (selector) {
      pointer.selector = selector
    }
  }

  destroy() {
    this.pointer.destroy()
  }

  onPointerCopy = (ev: PointerDragEvent) => {
    this.type = 'copy'
    this.emitter.trigger('pointer-copy', ev)
    this.onPointerDown(ev)
  }

  onPointerCut = (ev: PointerDragEvent) => {
    this.type = 'cut'
    this.emitter.trigger('pointer-cut', ev)
    this.onPointerDown(ev)
  }

  onPointerPaste = (ev: PointerDragEvent) => {
    if (this.type === null)
      return

    allowSelection(document.body)
    allowContextMenu(document.body)

    this.emitter.trigger('pointer-paste', ev)
  }

  onPointerDown = (ev: PointerDragEvent) => {
    preventSelection(document.body)
    preventContextMenu(document.body)

    this.mirror.setIsVisible(true)
    this.mirror.start(ev.subjectEl as HTMLElement, ev.pageX, ev.pageY)
  }

  onMousedown = (ev: PointerDragEvent) => {
    if (this.type === null)
      return

    allowSelection(document.body)
    allowContextMenu(document.body)

    this.emitter.trigger('pointer-paste', ev)
  }

  onMousemove = (ev: PointerDragEvent) => {
    if (this.type === null)
      return

    this.emitter.trigger('mousemove', ev)

    // if (ev.origEvent.type !== 'scroll') {
    this.mirror.handleMove(ev.pageX, ev.pageY)
    // }
  }

  setMirrorIsVisible(bool: boolean) {
    this.mirror.setIsVisible(bool)
  }

  cleanup = () => {
    this.type = null
    this.mirror.stop(
      false, () => {
      }
    )
    this.emitter.trigger('cleanup', true)
  }
}
