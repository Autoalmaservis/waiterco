"use client"

import { useRouter } from "next/navigation"

interface Props {
  venues: { id: string; name: string }[]
  selectedVenueId: string
  basePath: string
}

export default function VenueSelector({ venues, selectedVenueId, basePath }: Props) {
  const router = useRouter()
  return (
    <select
      value={selectedVenueId}
      onChange={(e) => router.push(`${basePath}?venue=${e.target.value}`)}
      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
    >
      {venues.map((v) => (
        <option key={v.id} value={v.id}>{v.name}</option>
      ))}
    </select>
  )
}
