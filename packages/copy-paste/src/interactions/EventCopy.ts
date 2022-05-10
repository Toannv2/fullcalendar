import {
  Seg,
  PointerDragEvent, Hit,
  EventMutation, applyMutationToEventStore,
  startOfDay,
  EventStore, getRelevantEvents, createEmptyEventStore,
  EventInteractionState,
  diffDates, enableCursor, disableCursor,
  EventRenderRange, getElSeg,
  EventApi,
  eventDragMutationMassager,
  Interaction, InteractionSettings, interactionSettingsStore,
  EventDropTransformers,
  CalendarContext,
  ViewApi,
  EventChangeArg,
  buildEventApis,
  EventAddArg,
  EventRemoveArg,
  isInteractionValid
} from '@fullcalendar/common'
import { __assign } from 'tslib'
import { HitChecker, isHitsEqual } from './HitChecker'
import { FeaturefulElementCopy } from '../dnd/FeaturefulElementCopy'
import { buildDatePointApiWithContext } from '../utils'

export type EventDragStopArg = EventDragArg
export type EventDragStartArg = EventDragArg

export interface EventDragArg {
  el: HTMLElement
  event: EventApi
  jsEvent: MouseEvent
  view: ViewApi
}

export class EventCopy extends Interaction {
  static SELECTOR = '.fc-event'

  type: string

  dragging: FeaturefulElementCopy
  hitDragging: HitChecker

  // internal state
  subjectEl: HTMLElement | null = null
  subjectSeg: Seg | null = null // the seg being selected/dragged
  isDragging: boolean = false
  eventRange: EventRenderRange | null = null
  relevantEvents: EventStore | null = null // the events being dragged
  receivingContext: CalendarContext | null = null
  validMutation: EventMutation | null = null
  mutatedRelevantEvents: EventStore | null = null

  constructor(settings: InteractionSettings) {
    super(settings)

    // @ts-ignore
    let dragging = this.dragging = new FeaturefulElementCopy(settings.el)
    dragging.pointer.selector = EventCopy.SELECTOR

    let hitDragging = this.hitDragging = new HitChecker(this.dragging, interactionSettingsStore)
    hitDragging.useSubjectCenter = settings.useEventCenter
    hitDragging.emitter.on('pointer-copy', this.handleCopy)
    hitDragging.emitter.on('pointer-cut', this.handleCut)
    hitDragging.emitter.on('pointer-duplicate', this.handleDuplicate)
    hitDragging.emitter.on('hitupdate', this.handleHitUpdate)
    hitDragging.emitter.on('paste', this.handlePaste)
  }

  destroy() {
    console.log('destroy')
    this.dragging.destroy()
  }

  handleCopy = (ev: PointerDragEvent) => {
    this.type = 'copy'
    this.handleInputEvent(ev)
  }

  handleCut = (ev: PointerDragEvent) => {
    this.type = 'cut'
    this.handleInputEvent(ev)
  }

  handleDuplicate = (ev: PointerDragEvent) => {
    this.type = 'duplicate'
    this.handleInputEvent(ev)
  }

  handleInputEvent = (ev: PointerDragEvent) => {
    let { component } = this
    let initialContext = component.context
    this.subjectEl = ev.subjectEl as HTMLElement
    let subjectSeg = this.subjectSeg = getElSeg(ev.subjectEl as HTMLElement)!
    let eventRange = this.eventRange = subjectSeg.eventRange!
    let eventInstanceId = eventRange.instance!.instanceId

    this.relevantEvents = getRelevantEvents(
      initialContext.getCurrentData().eventStore,
      eventInstanceId
    )
  }

  handleHitUpdate = (hit: Hit | null, isFinal: boolean) => {
    if (!this.type) return

    let relevantEvents = this.relevantEvents!
    let initialHit = this.hitDragging.initialHit!
    let initialContext = this.component.context

    // states based on new hit
    let receivingContext: CalendarContext | null = null
    let mutation: EventMutation | null = null
    let mutatedRelevantEvents: EventStore | null = null
    let isInvalid = false
    let interaction: EventInteractionState = {
      affectedEvents: relevantEvents,
      mutatedEvents: createEmptyEventStore(),
      isEvent: true
    }

    if (hit) {
      receivingContext = hit.context
      let receivingOptions = receivingContext.options

      if (
        initialContext === receivingContext ||
        (receivingOptions.editable && receivingOptions.droppable)
      ) {
        mutation = computeEventMutation(initialHit, hit, receivingContext.getCurrentData().pluginHooks.eventDragMutationMassagers)

        if (mutation && relevantEvents) {
          mutatedRelevantEvents = applyMutationToEventStore(
            relevantEvents,
            receivingContext.getCurrentData().eventUiBases,
            mutation,
            receivingContext
          )
          interaction.mutatedEvents = mutatedRelevantEvents

          if (!isInteractionValid(interaction, hit.dateProfile, receivingContext)) {
            isInvalid = true
            mutation = null
            mutatedRelevantEvents = null
            interaction.mutatedEvents = createEmptyEventStore()
          }
        }
      } else {
        receivingContext = null
      }
    }

    // this.displayDrag(receivingContext, interaction)

    if (!isInvalid) {
      enableCursor()
    } else {
      disableCursor()
    }

    if (
      initialContext === receivingContext && // TODO: write test for this
      isHitsEqual(initialHit, hit)
    ) {
      mutation = null
    }

    this.receivingContext = receivingContext
    this.validMutation = mutation
    this.mutatedRelevantEvents = mutatedRelevantEvents
  }

  handlePaste = (ev: PointerDragEvent) => {
    if (!this.type) return

    let { component } = this
    let { options } = component.context

    let initialContext = this.component.context
    let initialView = initialContext.viewApi
    let { receivingContext, validMutation } = this
    let eventDef = this.eventRange!.def
    let eventInstance = this.eventRange!.instance
    let eventApi = new EventApi(initialContext, eventDef, eventInstance)
    let relevantEvents = this.relevantEvents!
    let mutatedRelevantEvents = this.mutatedRelevantEvents!
    let { finalHit } = this.hitDragging

    // this.clearDrag() // must happen after revert animation

    if (validMutation) {
      // dropped within same calendar

      if (receivingContext === initialContext) {
        let newEventApi = new EventApi(
          initialContext,
          mutatedRelevantEvents.defs[eventDef.defId],
          eventInstance ? mutatedRelevantEvents.instances[eventInstance.instanceId] : null
        )

        if (options.previewCopy === void 0 || options.previewCopy === true) {
          if (this.type === 'copy') {
            let newEvent = this.cloneEvent()
            initialContext.calendarApi.addEvent(newEvent)
          } else if (this.type === 'cut') {
            initialContext.dispatch({
              type: 'MERGE_EVENTS',
              eventStore: mutatedRelevantEvents
            })
          }
        }

        let eventChangeArg: EventChangeArg = {
          oldEvent: eventApi,
          event: newEventApi,
          relatedEvents: buildEventApis(mutatedRelevantEvents, initialContext, eventInstance),
          revert() {
            initialContext.dispatch({
              type: 'MERGE_EVENTS',
              eventStore: relevantEvents // the pre-change data
            })
          }
        }

        let transformed: ReturnType<EventDropTransformers> = {}
        for (let transformer of initialContext.getCurrentData().pluginHooks.eventDropTransformers) {
          __assign(transformed, transformer(validMutation, initialContext))
        }

        // @ts-ignore
        initialContext.emitter.trigger('eventCopy', {
          ...eventChangeArg,
          ...transformed,
          type: this.type,
          el: ev.subjectEl as HTMLElement,
          delta: validMutation.datesDelta!,
          jsEvent: ev.origEvent as MouseEvent, // bad
          view: initialView
        })

        // dropped in different calendar
      } else if (receivingContext) {
        if (options.previewCopy === void 0 || options.previewCopy === true) {
          if (this.type === 'cut') {
            let eventRemoveArg: EventRemoveArg = {
              event: eventApi,
              relatedEvents: buildEventApis(relevantEvents, initialContext, eventInstance),
              revert() {
                initialContext.dispatch({
                  type: 'MERGE_EVENTS',
                  eventStore: relevantEvents
                })
              }
            }

            initialContext.dispatch({
              type: 'REMOVE_EVENTS',
              eventStore: relevantEvents
            })

            initialContext.emitter.trigger('eventRemove', eventRemoveArg)
          }

          receivingContext.dispatch({
            type: 'MERGE_EVENTS',
            eventStore: mutatedRelevantEvents
          })
        }

        receivingContext.emitter.trigger('eventCopy', {
          ...buildDatePointApiWithContext(finalHit.dateSpan, receivingContext),
          draggedEl: ev.subjectEl as HTMLElement,
          jsEvent: ev.origEvent as MouseEvent,
          type: this.type,
          view: finalHit.context.viewApi
        })
      }
    } else {
      initialContext.emitter.trigger('_noEventDrop')
    }

    this.cleanup()
  }

  // render a drag state on the next receivingCalendar
  displayDrag(nextContext: CalendarContext | null, state: EventInteractionState) {
    let initialContext = this.component.context
    let prevContext = this.receivingContext

    // does the previous calendar need to be cleared?
    if (prevContext && prevContext !== nextContext) {
      // does the initial calendar need to be cleared?
      // if so, don't clear all the way. we still need to to hide the affectedEvents
      if (prevContext === initialContext) {
        prevContext.dispatch({
          type: 'SET_EVENT_DRAG',
          state: {
            affectedEvents: state.affectedEvents,
            mutatedEvents: createEmptyEventStore(),
            isEvent: true
          }
        })

        // completely clear the old calendar if it wasn't the initial
      } else {
        prevContext.dispatch({ type: 'UNSET_EVENT_DRAG' })
      }
    }

    if (nextContext) {
      nextContext.dispatch({ type: 'SET_EVENT_DRAG', state })
    }
  }

  clearDrag() {
    let initialCalendar = this.component.context
    let { receivingContext } = this

    if (receivingContext) {
      receivingContext.dispatch({ type: 'UNSET_EVENT_DRAG' })
    }

    // the initial calendar might have an dummy drag state from displayDrag
    if (initialCalendar !== receivingContext) {
      initialCalendar.dispatch({ type: 'UNSET_EVENT_DRAG' })
    }
  }

  cleanup() { // reset all internal state
    this.type = null
    this.subjectSeg = null
    this.isDragging = false
    this.eventRange = null
    this.relevantEvents = null
    this.receivingContext = null
    this.validMutation = null
    this.mutatedRelevantEvents = null

    this.hitDragging.cleanup()
  }

  cloneEvent() {
    let eventInstance = this.eventRange!.instance
    let eventDef = this.eventRange!.def

    // let { component } = this
    // let { options } = component.context

    // let timeZone = options.timeZone
    // console.log(timeZone)
    let offset = 0
    // let offsetLocal = new Date().getTimezoneOffset() * 60 * 1000
    // timeZone

    let { finalHit } = this.hitDragging
    let resourceId = finalHit.dateSpan.resourceId
    // finalHit.dateSpan.range

    let newEvent = {
      ...this.mutatedRelevantEvents.defs[eventDef.defId]
    }

    newEvent.resourceId = resourceId

    delete newEvent.defId
    // @ts-ignore
    delete newEvent.publicId
    // @ts-ignore
    delete newEvent.resourceIds

    // @ts-ignore
    newEvent.start = new Date(this.mutatedRelevantEvents.instances[eventInstance.instanceId].range.start.getTime() + offset)
    // @ts-ignore
    newEvent.end = new Date(this.mutatedRelevantEvents.instances[eventInstance.instanceId].range.end.getTime() + offset)
    return newEvent
  }
}

function computeEventMutation(hit0: Hit, hit1: Hit, massagers: eventDragMutationMassager[]): EventMutation {
  let dateSpan0 = hit0.dateSpan
  let dateSpan1 = hit1.dateSpan
  let date0 = dateSpan0.range.start
  let date1 = dateSpan1.range.start
  let standardProps = {} as any

  if (dateSpan0.allDay !== dateSpan1.allDay) {
    standardProps.allDay = dateSpan1.allDay
    standardProps.hasEnd = hit1.context.options.allDayMaintainDuration

    if (dateSpan1.allDay) {
      // means date1 is already start-of-day,
      // but date0 needs to be converted
      date0 = startOfDay(date0)
    }
  }

  let delta = diffDates(
    date0, date1,
    hit0.context.dateEnv,
    hit0.componentId === hit1.componentId ?
      hit0.largeUnit :
      null
  )

  if (delta.milliseconds) { // has hours/minutes/seconds
    standardProps.allDay = false
  }

  let mutation: EventMutation = {
    datesDelta: delta,
    standardProps
  }

  for (let massager of massagers) {
    massager(mutation, hit0, hit1)
  }

  return mutation
}
