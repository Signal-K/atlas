import { metaFor } from './tonightTargets'
export type Equipment = 'eye' | 'binoculars' | 'telescope'
export function matchesEquipment(kind: string, equipment: Equipment): boolean {
  const meta = metaFor(kind)
  return equipment === 'telescope' || meta.nakedEyeVisible || (equipment === 'binoculars' && meta.binocularFriendly === true)
}
