import {
  computeRect,
  constrainPoint,
  ElementDragging,
  Emitter,
  Hit,
  InteractionSettingsStore,
  isDateSpansEqual,
  mapHash,
  PointerDragEvent,
  rangeContainsRange,
  Point,
  diffPoints,
  getRectCenter,
  intersectRects
} from '@fullcalendar/common'
import { OffsetTracker } from '../OffsetTracker'
import { FeaturefulElementCopy } from '../dnd/FeaturefulElementCopy'

export class HitChecker {
  type: string = null

  droppableStore: InteractionSettingsStore
  dragging: ElementDragging
  emitter: Emitter<any>

  // options that can be set by caller
  useSubjectCenter: boolean = false
  requireInitial: boolean = true // if doesn't start out on a hit, won't emit any events

  // internal state
  offsetTrackers: { [componentUid: string]: OffsetTracker }
  initialHit: Hit | null = null
  finalHit: Hit | null = null
  movingHit: Hit | null = null
  coordAdjust?: Point

  constructor(dragging: FeaturefulElementCopy, droppableStore: InteractionSettingsStore) {
    this.droppableStore = droppableStore

    dragging.emitter.on('pointer-copy', this.handleCopy)
    dragging.emitter.on('pointer-cut', this.handleCut)
    dragging.emitter.on('pointer-duplicate', this.handleDuplicate)
    dragging.emitter.on('pointer-paste', this.handlePaste)
    dragging.emitter.on('mousemove', this.handleMove)
    dragging.emitter.on('cleanup', this.cleanup)

    // @ts-ignore
    this.dragging = dragging
    this.emitter = new Emitter()
  }

  checkValidBehavior = () => {
    return this.type !== null
  }

  handleCopy = (ev: PointerDragEvent) => {
    this.type = 'copy'
    this.prevHandle(ev)
    this.emitter.trigger('pointer-copy', ev)
  }

  handleCut = (ev: PointerDragEvent) => {
    this.type = 'cut'
    this.prevHandle(ev)
    this.emitter.trigger('pointer-cut', ev)
  }

  handleDuplicate = (ev: PointerDragEvent) => {
    this.type = 'duplicate'
    this.prevHandle(ev)
    this.emitter.trigger('pointer-duplicate', ev)
  }

  handleMove = (ev: PointerDragEvent, forceHandle?: boolean) => {
    if (!this.checkValidBehavior())
      return

    let hit = this.queryHitForOffset(
      ev.pageX + this.coordAdjust!.left,
      ev.pageY + this.coordAdjust!.top,
    )

    if (forceHandle || !isHitsEqual(this.movingHit, hit)) {
      this.movingHit = hit
      this.emitter.trigger('hitupdate', hit, false, ev)
    }
  }

  handlePaste = (ev: PointerDragEvent) => {
    if (!this.initialHit) return

    this.finalHit = this.queryHitForOffset(
      ev.pageX + this.coordAdjust!.left,
      ev.pageY + this.coordAdjust!.top
    )

    if (!this.finalHit) return

    this.emitter.trigger('paste', ev)
  }

  prevHandle = (ev: PointerDragEvent) => {
    this.initialHit = null
    this.finalHit = null
    this.prepareHits()
    this.processFirstCoord(ev)
    this.handleMove(ev, true)
  }

  processFirstCoord(ev: PointerDragEvent) {
    let origPoint = { left: ev.pageX, top: ev.pageY }
    let adjustedPoint = origPoint
    let subjectEl = ev.subjectEl
    let subjectRect

    if (subjectEl instanceof HTMLElement) {
      subjectRect = computeRect(subjectEl)
      adjustedPoint = constrainPoint(adjustedPoint, subjectRect)
    }

    let initialHit = this.initialHit = this.queryHitForOffset(adjustedPoint.left, adjustedPoint.top)
    if (initialHit) {
      if (this.useSubjectCenter && subjectRect) {
        let slicedSubjectRect = intersectRects(subjectRect, initialHit.rect)
        if (slicedSubjectRect) {
          adjustedPoint = getRectCenter(slicedSubjectRect)
        }
      }

      this.coordAdjust = diffPoints(adjustedPoint, origPoint)
    } else {
      this.coordAdjust = { left: 0, top: 0 }
    }
  }

  prepareHits() {
    this.offsetTrackers = mapHash(this.droppableStore, (interactionSettings) => {
      interactionSettings.component.prepareHits()
      return new OffsetTracker(interactionSettings.el)
    })
  }

  releaseHits() {
    let { offsetTrackers } = this

    for (let id in offsetTrackers) {
      offsetTrackers[id].destroy()
    }

    this.offsetTrackers = {}
  }

  queryHitForOffset(offsetLeft: number, offsetTop: number): Hit | null {
    let { droppableStore, offsetTrackers } = this
    let bestHit: Hit | null = null

    for (let id in droppableStore) {
      let component = droppableStore[id].component
      let offsetTracker = offsetTrackers[id]

      if (
        offsetTracker && // wasn't destroyed mid-drag
        offsetTracker.isWithinClipping(offsetLeft, offsetTop)
      ) {
        let originLeft = offsetTracker.computeLeft()
        let originTop = offsetTracker.computeTop()
        let positionLeft = offsetLeft - originLeft
        let positionTop = offsetTop - originTop
        let { origRect } = offsetTracker
        let width = origRect.right - origRect.left
        let height = origRect.bottom - origRect.top

        if (
          // must be within the element's bounds
          positionLeft >= 0 && positionLeft < width &&
          positionTop >= 0 && positionTop < height
        ) {
          let hit = component.queryHit(positionLeft, positionTop, width, height)
          if (
            hit && (
              // make sure the hit is within activeRange, meaning it's not a dead cell
              rangeContainsRange(hit.dateProfile.activeRange, hit.dateSpan.range)
            ) &&
            (!bestHit || hit.layer > bestHit.layer)
          ) {
            hit.componentId = id
            hit.context = component.context

            // TODO: better way to re-orient rectangle
            hit.rect.left += originLeft
            hit.rect.right += originLeft
            hit.rect.top += originTop
            hit.rect.bottom += originTop

            bestHit = hit
          }
        }
      }
    }

    return bestHit
  }

  cleanup = () => {
    this.initialHit = null
    this.finalHit = null
    this.type = null
    this.emitter.trigger('cleanup', true)
  }
}

export function isHitsEqual(hit0: Hit | null, hit1: Hit | null): boolean {
  if (!hit0 && !hit1) {
    return true
  }

  if (Boolean(hit0) !== Boolean(hit1)) {
    return false
  }

  return isDateSpansEqual(hit0!.dateSpan, hit1!.dateSpan)
}
