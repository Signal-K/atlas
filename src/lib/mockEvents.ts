// Placeholder data only -- there is no events backend yet. Swap this out
// for a real fetch (PocketBase collection or computed sky events) once one
// exists; the shape below is what EventsPage renders against.
export interface AtlasEvent {
  id: string
  title: string
  kind: string
  when: string
}

export const MOCK_EVENTS: AtlasEvent[] = [
  { id: '1', title: 'Full Moon', kind: 'Moon', when: 'Tonight, 12:48 AM' },
  { id: '2', title: 'Perseid meteor shower peak', kind: 'Meteor shower', when: 'Aug 12, after midnight' },
  { id: '3', title: 'Saturn at opposition', kind: 'Planet', when: 'Aug 14' },
  { id: '4', title: 'ISS pass', kind: 'Satellite', when: 'Aug 9, 9:12 PM' },
]
