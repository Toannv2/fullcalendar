import { elementClosest, Emitter, PointerDragEvent } from '@fullcalendar/common'

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
  }

  destroy() {
    document.body.removeEventListener('mousedown', this.handleMouseDown, false)
    document.body.removeEventListener('mousemove', this.handleMouseMove, false)
    document.body.removeEventListener('keydown', this.handleKeyDown, false)
    document.body.removeEventListener('keyup', this.handleKeyUp, false)
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

  cleanup = () => {
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

  handleMouseDown = () => {
    this.emitter.trigger('mousedown', this.createEventFromMouse(this.lastPoint))
    this.cleanup()
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
          event.preventDefault();
          this.handleDuplicate()
        }
      }
    }
  }

  handleCopy = () => {
    if (this.tryStart(this.lastPoint)) {
      let pev = this.createEventFromMouse(this.lastPoint, true)
      this.emitter.trigger('pointer-copy', pev)
    } else {
      this.cleanup()
    }
  }

  handlePaste = () => {
    this.emitter.trigger('pointer-paste', this.createEventFromMouse(this.lastPoint))
    this.cleanup()
  }

  handleCut = () => {
    if (this.tryStart(this.lastPoint)) {
      let pev = this.createEventFromMouse(this.lastPoint, true)
      this.emitter.trigger('pointer-cut', pev)
    } else {
      this.cleanup()
    }
  }

  handleDuplicate = () => {
    this.handleCopy();
    this.handlePaste();
  }

  handleMouseMove = (ev: MouseEvent) => {
    this.lastPoint = ev
    this.emitter.trigger('mousemove', this.createEventFromMouse(ev, true))
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

  createEventFromTouch(ev: TouchEvent, isFirst?: boolean): PointerDragEvent {
    let touches = ev.touches
    let pageX
    let pageY
    let deltaX = 0
    let deltaY = 0

    // if touch coords available, prefer,
    // because FF would give bad ev.pageX ev.pageY
    if (touches && touches.length) {
      pageX = touches[0].pageX
      pageY = touches[0].pageY
    } else {
      pageX = (ev as any).pageX
      pageY = (ev as any).pageY
    }

    // TODO: repeat code
    if (isFirst) {
      this.origPageX = pageX
      this.origPageY = pageY
    } else {
      deltaX = pageX - this.origPageX
      deltaY = pageY - this.origPageY
    }

    return {
      origEvent: ev,
      isTouch: true,
      subjectEl: this.subjectEl,
      pageX,
      pageY,
      deltaX,
      deltaY
    }
  }
}
