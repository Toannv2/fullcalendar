import { createPlugin } from '@fullcalendar/common'
import { CopyPasteInteract } from './interactions/CopyPasteInteract'
import { EventCopy } from './interactions/EventCopy'
import { LISTENER_REFINERS, OPTION_REFINERS } from './options'

export default createPlugin({
  componentInteractions: [EventCopy],
  calendarInteractions: [CopyPasteInteract],
  optionRefiners: OPTION_REFINERS,
  listenerRefiners: LISTENER_REFINERS,
})
