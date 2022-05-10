import {
  DateSelectionApi,
  PointerDragEvent,
  // elementClosest,
  CalendarContext, getEventTargetViaRoot, elementClosest
  // getEventTargetViaRoot,
} from '@fullcalendar/common'
import { PointerTracking } from './PointerTracking'
import { EventCopy } from './EventCopy'

// import { PointerTrigger } from './PointerTrigger'
// import { PointerDragging } from '../dnd/PointerDragging'
// import { EventDragging } from './EventDragging'

export class CopyPasteInteract {
  context: CalendarContext
  documentPointer: PointerTracking
  isRecentPointerDateSelect = false // wish we could use a selector to detect date selection, but uses hit system
  matchesCancel = false
  matchesEvent = false

  constructor(context: CalendarContext) {
    this.context = context
    // let documentPointer = this.documentPointer = new PointerTracking(document)
    // documentPointer.shouldIgnoreMove = true
    // documentPointer.shouldWatchScroll = false
  }

  destroy() {
    // this.context.emitter.off('select', this.onSelect)
    this.documentPointer.destroy()
  }

  onSelect = (selectInfo: DateSelectionApi) => {
    if (selectInfo.jsEvent) {
      this.isRecentPointerDateSelect = true
    }
  }

  onDocumentPointerDown = (pev: PointerDragEvent) => {
    let unselectCancel = this.context.options.unselectCancel
    let downEl = getEventTargetViaRoot(pev.origEvent) as HTMLElement
    this.matchesCancel = !!elementClosest(downEl, unselectCancel)
    this.matchesEvent = !!elementClosest(downEl, EventCopy.SELECTOR) // interaction started on an event?
  }

  onDocumentPointerUp = (pev: PointerDragEvent) => {
    // let { context } = this
    // let { documentPointer } = this
    // let calendarState = context.getCurrentData()

    // touch-scrolling should never unfocus any type of selection
    // if (!documentPointer.wasTouchScroll) {
    //   if (
    //     calendarState.dateSelection && // an existing date selection?
    //     !this.isRecentPointerDateSelect // a new pointer-initiated date selection since last onDocumentPointerUp?
    //   ) {
    //     let unselectAuto = context.options.unselectAuto
    //
    //     if (unselectAuto && (!unselectAuto || !this.matchesCancel)) {
    //       context.calendarApi.unselect(pev)
    //     }
    //   }
    //
    //   if (
    //     calendarState.eventSelection && // an existing event selected?
    //     !this.matchesEvent // interaction DIDN'T start on an event
    //   ) {
    //     context.dispatch({ type: 'UNSELECT_EVENT' })
    //   }
    // }

    this.isRecentPointerDateSelect = false
  }
}
