import { z } from 'zod'
import { defineUserMutation, withOptionalValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { assertUiTestingEnabled, seedUiAuditWorkspace } from '#server/utils/ui-testing'

const bodySchema = z.object({})

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.showcaseAuthLoginTest,
    parseBody: withOptionalValidatedBody(bodySchema.parse, {}),
  },
  async ({ event, user }) => {
    assertUiTestingEnabled(event)
    return seedUiAuditWorkspace(event, user)
  },
)
