import { createPlugin } from '@fullcalendar/common'
import { CopyPasteInteract } from './interactions/CopyPasteInteract'
import { EventCopy } from './interactions/EventCopy'
import { LISTENER_REFINERS, OPTION_REFINERS } from './options'

export default createPlugin({
  componentInteractions: [EventCopy],
  calendarInteractions: [CopyPasteInteract],
  // elementDraggingImpl: FeaturefulElementDragging,
  optionRefiners: OPTION_REFINERS,
  listenerRefiners: LISTENER_REFINERS,
})

// export * from './api-type-deps'
// export { FeaturefulElementDragging }
// export { PointerDragging } from './dnd/PointerDragging'
// export { ExternalDraggable as Draggable } from './interactions-external/ExternalDraggable'
// export { ThirdPartyDraggable } from './interactions-external/ThirdPartyDraggable'
