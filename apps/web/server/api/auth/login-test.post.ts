import { z } from 'zod'
import { definePublicMutation, withOptionalValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import type { AuthMutationResult } from '#server/utils/app-auth'
import { assertUiTestingEnabled, ensureUiTestingSessionUser } from '#server/utils/ui-testing'

const bodySchema = z.object({})

export default definePublicMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.showcaseAuthLoginTest,
    parseBody: withOptionalValidatedBody(bodySchema.parse, {}),
  },
  async ({ event }): Promise<AuthMutationResult> => {
    assertUiTestingEnabled(event)
    const sessionUser = await ensureUiTestingSessionUser(event)
    await setUserSession(event, { user: sessionUser })

    return {
      user: sessionUser,
      nextStep: 'signed_in',
    }
  },
)
