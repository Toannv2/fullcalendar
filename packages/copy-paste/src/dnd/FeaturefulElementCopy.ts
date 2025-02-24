import {
  PointerDragEvent,
  allowSelection,
  allowContextMenu, Emitter, preventSelection, preventContextMenu, elementClosest
} from '@fullcalendar/common'
import { PointerTracking } from '../interactions/PointerTracking'
import { ElementMirror } from './ElementMirror'
import { AutoScroller } from './AutoScroller'

export class FeaturefulElementCopy {
  mirror: ElementMirror
  mirrorStatic: ElementMirror
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

  initialScroll = { scrollTop: 0, scrollLeft: 0 }

  containerEl: HTMLElement

  constructor(containerEl: HTMLElement, selector?: string) {
    this.containerEl = containerEl

    this.emitter = new Emitter()
    this.mirror = new ElementMirror()
    this.mirrorStatic = new ElementMirror()
    this.autoScroller = new AutoScroller()

    let pointer = this.pointer = new PointerTracking(containerEl)
    pointer.emitter.on('scroll', this.onScroll)
    pointer.emitter.on('pointer-copy', this.onPointerCopy)
    pointer.emitter.on('pointer-cut', this.onPointerCut)
    pointer.emitter.on('pointer-paste', this.onPointerPaste)
    pointer.emitter.on('mousedown', this.onMousedown)
    pointer.emitter.on('mousemove', this.onMousemove)
    pointer.emitter.on('cleanup', this.cleanup)

    this.mirrorStatic.parentNode = elementClosest(containerEl, '.fc')
    this.mirrorStatic.position = 'absolute'

    if (selector) {
      pointer.selector = selector
    }
  }

  destroy() {
    this.pointer.destroy()
  }

  onScroll = () => {
    if (this.type !== 'copy')
      return

    const parentElement = this.containerEl.parentElement
    this.mirrorStatic.handleScroll(
      parentElement.scrollLeft - this.initialScroll.scrollLeft,
      parentElement.scrollTop - this.initialScroll.scrollTop)
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

    //@ts-ignore
    const parentRect = this.mirrorStatic.parentNode.getBoundingClientRect()
    const parentElement = this.containerEl.parentElement

    this.initialScroll.scrollTop = parentElement.scrollTop
    this.initialScroll.scrollLeft = parentElement.scrollLeft

    this.mirrorStatic.setIsVisible(true)
    this.mirrorStatic.start(ev.subjectEl as HTMLElement, -parentRect.x, -parentRect.y)
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
    this.mirrorStatic.stop(
      false, () => {
      }
    )
    this.emitter.trigger('cleanup', true)
  }
}
