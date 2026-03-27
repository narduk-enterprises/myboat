import * as schema from '#server/database/schema'
import { createAppDatabase } from '#layer/server/utils/database'

export const useAppDatabase = createAppDatabase(schema)
