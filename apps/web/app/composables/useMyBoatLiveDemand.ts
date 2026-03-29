import type { LiveDemand } from '../../shared/myboatLive'
import type { ComputedRef, Ref } from 'vue'
import type { VesselStoreNamespace } from './useMyBoatVesselStore'

export function useMyBoatLiveDemand(options: {
  namespace: VesselStoreNamespace
  consumerId: string
  demand:
    | Ref<Partial<LiveDemand> | null | undefined>
    | ComputedRef<Partial<LiveDemand> | null | undefined>
}) {
  const store = useMyBoatVesselStore()

  watch(
    () => options.demand.value,
    (nextDemand) => {
      store.setLiveDemand(options.namespace, options.consumerId, nextDemand)
    },
    { immediate: true, deep: true },
  )

  onScopeDispose(() => {
    store.clearLiveDemand(options.namespace, options.consumerId)
  })
}
