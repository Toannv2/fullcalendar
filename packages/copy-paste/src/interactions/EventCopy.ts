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
  EventRemoveArg,
  isInteractionValid
} from '@fullcalendar/common'
import moment from 'moment-timezone'
import { __assign } from 'tslib'
import { HitChecker, isHitsEqual } from './HitChecker'
import { FeaturefulElementCopy } from '../dnd/FeaturefulElementCopy'
import { buildDatePointApiWithContext } from '../utils'

export type EventDragStopArg = EventDragArg
export type EventDragStartArg = EventDragArg

const FORMAT_TIME = 'YYYY-MM-DDTHH:mm:ss'

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
  hitChecker: HitChecker

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

    let hitChecker = this.hitChecker = new HitChecker(this.dragging, interactionSettingsStore)
    hitChecker.useSubjectCenter = settings.useEventCenter
    hitChecker.emitter.on('pointer-copy', this.handleCopy)
    hitChecker.emitter.on('pointer-cut', this.handleCut)
    hitChecker.emitter.on('pointer-duplicate', this.handleDuplicate)
    hitChecker.emitter.on('paste', this.handlePaste)
  }

  destroy() {
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
    let { component }: any = this
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
    if (!this.type || !hit) return

    let relevantEvents = this.relevantEvents!
    let initialHit = this.hitChecker.initialHit!
    // @ts-ignore
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

    receivingContext = hit.context
    let receivingOptions = receivingContext.options

    if (
      initialContext === receivingContext ||
      (receivingOptions.editable && receivingOptions.droppable)
    ) {
      mutation = computeEventMutation(initialHit, hit, receivingContext.getCurrentData().pluginHooks.eventDragMutationMassagers, this.subjectSeg)

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

    if (!isInvalid) {
      enableCursor()
    } else {
      disableCursor()
    }

    this.receivingContext = receivingContext
    this.validMutation = mutation
    this.mutatedRelevantEvents = mutatedRelevantEvents
  }

  handlePaste = (ev: PointerDragEvent) => {
    if (!this.type) return

    this.handleHitUpdate(this.hitChecker.finalHit, true)

    let { component }: any = this
    let { options } = component.context

    // @ts-ignore
    let initialContext = this.component.context
    let initialView = initialContext.viewApi
    let { receivingContext, validMutation } = this
    let eventDef = this.eventRange!.def
    let eventInstance = this.eventRange!.instance
    let eventApi = new EventApi(initialContext, eventDef, eventInstance)
    let relevantEvents = this.relevantEvents!
    let mutatedRelevantEvents = this.mutatedRelevantEvents!
    let { finalHit } = this.hitChecker

    if (validMutation) {
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

          let newEvent = this.cloneEvent()
          receivingContext.calendarApi.addEvent(newEvent)
        }

        let addedEventDef = mutatedRelevantEvents.defs[eventDef.defId]
        let addedEventInstance = mutatedRelevantEvents.instances[eventInstance.instanceId]
        let addedEventApi = new EventApi(receivingContext, addedEventDef, addedEventInstance)

        // @ts-ignore
        receivingContext.emitter.trigger('eventCopy', {
          ...buildDatePointApiWithContext(finalHit.dateSpan, receivingContext),
          draggedEl: ev.subjectEl as HTMLElement,
          jsEvent: ev.origEvent as MouseEvent,
          type: this.type,
          event: addedEventApi,
          oldEvent: eventApi,
          relatedEvents: buildEventApis(mutatedRelevantEvents, receivingContext, addedEventInstance),
          relatedOldEvents: buildEventApis(relevantEvents, initialContext, eventInstance),
          view: finalHit.context.viewApi
        })
      }
    }

    this.cleanup()
  }

  cleanup() { // reset all internal state
    this.clean()
    this.hitChecker.cleanup()
  }

  clean() {  // reset all internal state
    this.type = null
    this.subjectSeg = null
    this.isDragging = false
    this.eventRange = null
    this.relevantEvents = null
    this.receivingContext = null
    this.validMutation = null
    this.mutatedRelevantEvents = null
  }

  cloneEvent() {
    let eventInstance = this.eventRange!.instance

    // @ts-ignore
    let { component } = this
    let { options } = component.context

    let timeZone = options.timeZone === 'local' || !options.timeZone ? Intl.DateTimeFormat().resolvedOptions().timeZone : options.timeZone

    let { finalHit } = this.hitChecker
    let resourceId = finalHit.dateSpan.resourceId

    let newEvent: any = {
      ...this.eventRange.ui,
      ...this.eventRange.def
    }
    // @ts-ignore
    newEvent.resourceId = resourceId

    delete newEvent.ui
    delete newEvent.defId
    delete newEvent.publicId
    delete newEvent.resourceIds
    delete newEvent.extendedProps
    delete newEvent.recurringDef
    delete newEvent.sourceId

    newEvent.start = moment.utc(this.mutatedRelevantEvents.instances[eventInstance.instanceId].range.start).format(FORMAT_TIME)
    newEvent.end = moment.utc(this.mutatedRelevantEvents.instances[eventInstance.instanceId].range.end).format(FORMAT_TIME)
    newEvent.start = moment.tz(newEvent.start, timeZone).format()
    newEvent.end = moment.tz(newEvent.end, timeZone).format()

    return newEvent
  }
}

function computeEventMutation(hit0: Hit, hit1: Hit, massagers: eventDragMutationMassager[], subjectSeg: any): EventMutation {
  let dateSpan0 = hit0.dateSpan
  let dateSpan1 = hit1.dateSpan
  let date0 = subjectSeg.start
  let date1 = dateSpan1.range.start
  let standardProps = {} as any

  if (dateSpan0.allDay !== dateSpan1.allDay) {
    standardProps.allDay = dateSpan1.allDay
    standardProps.hasEnd = hit1.context.options.allDayMaintainDuration

    if (dateSpan1.allDay) {
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
