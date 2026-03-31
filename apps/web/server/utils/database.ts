import * as schema from '#server/database/schema'
import { createAppDatabase } from '#layer/server/utils/database'

/** https://developers.cloudflare.com/d1/platform/limits/ (maximum bound parameters per query) */
export const D1_MAX_BOUND_PARAMETERS_PER_QUERY = 100

export const useAppDatabase = createAppDatabase(schema)
