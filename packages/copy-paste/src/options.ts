import { identity, Identity } from '@fullcalendar/common'

export const OPTION_REFINERS = {
  previewCopy: Boolean,
}

export const LISTENER_REFINERS = {
  eventCopy: identity as Identity<(arg: any) => void>,
}
