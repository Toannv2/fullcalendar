import { elementClosest, Emitter, PointerDragEvent } from '@fullcalendar/common'
import { TYPE_EVENT } from './EventCopy'

//@ts-ignore
window.calendarUtils = window.calendarUtils || {}
//@ts-ignore
window.calendarUtils.emitter = window.calendarUtils.emitter || new Emitter()

function copy(event) {
  //@ts-ignore
  window.calendarUtils.emitter.trigger('copy', event)
}

function cut(event) {
  //@ts-ignore
  window.calendarUtils.emitter.trigger('cut', event)
}

//@ts-ignore
window.calendarUtils.copy = window.calendarUtils.copy || copy
//@ts-ignore
window.calendarUtils.cut = window.calendarUtils.cut || cut

const KEY_META = 'Meta'
const KEY_C = 'c'
const KEY_V = 'v'
const KEY_D = 'd'
const KEY_X = 'x'
const KEY_ESCAPE = 'Escape'
const KEY_ENTER = 'Enter'

const allowKeyboard = [KEY_META, KEY_C, KEY_V, KEY_D, KEY_X]

const CONTAINER_CLASS = '.fc-timeline-body, .fc-timegrid-body, .fc-daygrid-body'

export class PointerTracking {
  containerEl: EventTarget
  subjectEl: HTMLElement | null = null
  emitter: Emitter<any>

  pressedMetaKey: boolean = false
  listKey = {}

  type: TYPE_EVENT = TYPE_EVENT.NONE

  lastPoint = null

  isMac = navigator.userAgent.includes('Mac')

  // options that can be directly assigned by caller
  selector: string = '' // will cause subjectEl in all emitted events to be this element
  handleSelector: string = ''

  // internal states
  origPageX: number
  origPageY: number

  constructor(containerEl: EventTarget) {
    this.containerEl = containerEl
    this.emitter = new Emitter()

    document.body.addEventListener('mousedown', this.handleMouseDown, false)
    document.body.addEventListener('mousemove', this.handleMouseMove, false)
    document.body.addEventListener('keydown', this.handleKeyDown, false)
    document.body.addEventListener('keyup', this.handleKeyUp, false)

    // global utils
    // @ts-ignore
    window.calendarUtils.emitter.on('copy', this.handleGlobalCopy)
    // @ts-ignore
    window.calendarUtils.emitter.on('cut', this.handleGlobalCut)
  }

  destroy() {
    document.body.removeEventListener('mousedown', this.handleMouseDown, false)
    document.body.removeEventListener('mousemove', this.handleMouseMove, false)
    document.body.removeEventListener('keydown', this.handleKeyDown, false)
    document.body.removeEventListener('keyup', this.handleKeyUp, false)

    // @ts-ignore
    window.calendarUtils.emitter.off('copy', this.handleGlobalCopy)
    // @ts-ignore
    window.calendarUtils.emitter.off('cut', this.handleGlobalCut)
  }

  tryStart = (ev: UIEvent): boolean => {
    let subjectEl = this.querySubjectEl(ev)

    let fcTimeEl = (ev.target as HTMLElement).closest(CONTAINER_CLASS)
    let containerFcTimeEl = (this.containerEl as HTMLElement).closest(CONTAINER_CLASS)
    if (subjectEl && fcTimeEl === containerFcTimeEl) {
      this.subjectEl = subjectEl
      return true
    }

    return false
  }

  globalTryStart = (element: HTMLElement): boolean => {
    let subjectEl = this.queryEl(element)

    let fcTimeEl = element.closest(CONTAINER_CLASS)
    let containerFcTimeEl = (this.containerEl as HTMLElement).closest(CONTAINER_CLASS)
    if (subjectEl && fcTimeEl === containerFcTimeEl) {
      this.subjectEl = subjectEl
      return true
    }

    return false
  }

  cleanup = () => {
    this.type = TYPE_EVENT.NONE
    this.subjectEl = null
    this.listKey = {}
    this.emitter.trigger('cleanup', true)
  }

  querySubjectEl(ev: UIEvent): HTMLElement {
    if (this.selector) {
      return elementClosest(ev.target as HTMLElement, this.selector)
    }
    return this.containerEl as HTMLElement
  }

  queryEl(el: HTMLElement): HTMLElement {
    if (this.selector) {
      return el.closest(this.selector)
    }
    return this.containerEl as HTMLElement
  }

  handleMouseDown = (event) => {
    if (this.lastPoint && this.type !== TYPE_EVENT.NONE) {
      this.emitter.trigger('mousedown', this.createEventFromMouse(this.lastPoint))
    }
    setTimeout(() => this.cleanup(), 50)
  }

  // Keyboard
  // ----------------------------------------------------------------------------------------------------
  handleKeyDown = (ev: KeyboardEvent) => {
    if (this.listKey[ev.key] !== void 0)
      return

    if (allowKeyboard.includes(ev.key)) {
      this.listKey[ev.key] = ev
    }

    this.checkPrimaryKey()
    this.handleCopyPaste(ev)
  }

  handleKeyUp = (ev: KeyboardEvent) => {
    delete this.listKey[ev.key]
    if (ev.key === KEY_META) {
      this.listKey = {}
    }
  }

  checkPrimaryKey = () => {
    this.pressedMetaKey = false
    Object.values(this.listKey).forEach((value: KeyboardEvent) => {
      if (value.key === KEY_META) {
        this.pressedMetaKey = true
      }
    })
  }

  handleCopyPaste = (event: KeyboardEvent) => {
    // for MacOS or Window keyboard
    if (this.lastPoint) {
      if (event.key === KEY_ENTER) {
        return this.handlePaste()
      } else if (event.key === KEY_ESCAPE) {
        return this.cleanup()
      }

      if ((this.isMac && this.pressedMetaKey || !this.isMac && event.ctrlKey)) {
        if (event.key === KEY_C) {
          this.handleCopy()
        } else if (event.key === KEY_V) {
          this.handlePaste()
        } else if (event.key === KEY_X) {
          this.handleCut()
        } else if (event.key === KEY_D) {
          this.handleDuplicate(event)
        }
      }
    }
  }

  handleCopy = () => {
    if (this.tryStart(this.lastPoint)) {
      this.type = TYPE_EVENT.COPY
      let pev = this.createEventFromMouse(this.lastPoint, true)
      this.emitter.trigger('pointer-copy', pev)
    } else {
      this.cleanup()
    }
  }

  handlePaste = () => {
    if (this.type === TYPE_EVENT.NONE)
      return

    this.emitter.trigger('pointer-paste', this.createEventFromMouse(this.lastPoint))
    setTimeout(() => this.cleanup(), 50)
  }

  handleCut = () => {
    if (this.tryStart(this.lastPoint)) {
      this.type = TYPE_EVENT.CUT
      let pev = this.createEventFromMouse(this.lastPoint, true)
      this.emitter.trigger('pointer-cut', pev)
    } else {
      this.cleanup()
    }
  }

  handleDuplicate = (event) => {
    this.handleCopy()

    if (this.type === TYPE_EVENT.NONE)
      return

    event.preventDefault()
    this.handlePaste()
  }

  handleMouseMove = (ev: MouseEvent) => {
    this.lastPoint = ev
    this.emitter.trigger('mousemove', this.createEventFromMouse(ev, true))
  }

  // Event from global
  // ----------------------------------------------------------------------------------------------------

  handleGlobalCopy = (el) => {
    if (el && this.globalTryStart(el)) {
      this.type = TYPE_EVENT.COPY
      let pev = this.createEventFromElement(this.subjectEl)
      this.emitter.trigger('pointer-copy', pev)
    } else {
      this.cleanup()
    }
  }

  handleGlobalCut = (el) => {
    if (el && this.globalTryStart(el)) {
      this.type = TYPE_EVENT.CUT
      let pev = this.createEventFromElement(this.subjectEl)
      this.emitter.trigger('pointer-cut', pev)
    } else {
      this.cleanup()
    }
  }

  // Event Normalization
  // ----------------------------------------------------------------------------------------------------

  createEventFromMouse(ev: MouseEvent, isFirst?: boolean): PointerDragEvent {
    let deltaX = 0
    let deltaY = 0

    // TODO: repeat code
    if (isFirst) {
      this.origPageX = ev.pageX
      this.origPageY = ev.pageY
    } else {
      deltaX = ev.pageX - this.origPageX
      deltaY = ev.pageY - this.origPageY
    }

    return {
      origEvent: ev,
      isTouch: false,
      subjectEl: this.subjectEl,
      pageX: ev.pageX,
      pageY: ev.pageY,
      deltaX,
      deltaY
    }
  }

  createEventFromElement(el: Element): PointerDragEvent {
    const rect = el.getBoundingClientRect()

    return {
      // @ts-ignore
      origEvent: { target: el },
      isFromGlobal: true,
      subjectEl: this.subjectEl,
      pageX: rect.x + (rect.width / 2) + window.scrollX,
      pageY: rect.y + (rect.height / 2) + window.scrollY,
      deltaX: 0,
      deltaY: 0
    }
  }
}
