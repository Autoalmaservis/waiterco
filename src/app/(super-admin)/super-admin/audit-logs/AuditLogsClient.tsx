'use client'

import { useState } from 'react'
import { Search, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import type { AuditRow } from './page'

const actionColors: Record<string, string> = {
  create:   'text-green-700 bg-green-50',
  insert:   'text-green-700 bg-green-50',
  update:   'text-blue-700 bg-blue-50',
  delete:   'text-red-700 bg-red-50',
  login:    'text-purple-700 bg-purple-50',
  logout:   'text-gray-600 bg-gray-100',
  toggle:   'text-orange-700 bg-orange-50',
}

function getActionColor(action: string) {
  const key = Object.keys(actionColors).find(k => action.toLowerCase().includes(k))
  return key ? actionColors[key] : 'text-gray-600 bg-gray-100'
}

function DataDiff({ old_data, new_data }: { old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null }) {
  if (!old_data && !new_data) return null
  const allKeys = new Set([
    ...Object.keys(old_data ?? {}),
    ...Object.keys(new_data ?? {}),
  ])
  const changedKeys = [...allKeys].filter(k => {
    const o = JSON.stringify((old_data ?? {})[k])
    const n = JSON.stringify((new_data ?? {})[k])
    return o !== n
  })
  if (changedKeys.length === 0) return null
  return (
    <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100">
            <th className="text-left px-3 py-1.5 text-gray-500 font-medium">Pole</th>
            <th className="text-left px-3 py-1.5 text-red-500 font-medium">Pred</th>
            <th className="text-left px-3 py-1.5 text-green-600 font-medium">Po</th>
          </tr>
        </thead>
        <tbody>
          {changedKeys.map(k => (
            <tr key={k} className="border-b border-gray-100 last:border-0">
              <td className="px-3 py-1.5 font-mono text-gray-600">{k}</td>
              <td className="px-3 py-1.5 font-mono text-red-600 line-through">
                {JSON.stringify((old_data ?? {})[k]) ?? '–'}
              </td>
              <td className="px-3 py-1.5 font-mono text-green-700">
                {JSON.stringify((new_data ?? {})[k]) ?? '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LogRow({ log }: { log: AuditRow }) {
  const [expanded, setExpanded] = useState(false)
  const hasDiff = !!(log.old_data || log.new_data)
  const color = getActionColor(log.action)

  return (
    <>
      <tr
        onClick={() => hasDiff && setExpanded(e => !e)}
        className={`transition-colors border-b border-gray-50 ${hasDiff ? 'cursor-pointer hover:bg-gray-50' : ''}`}>
        <td className="px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {hasDiff ? (
              expanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />
            ) : <span className="w-3.5" />}
            <span>{log.actor_name ?? <span className="text-gray-400 italic">System</span>}</span>
          </div>
          {log.actor_role && <p className="text-xs text-gray-400 ml-5.5">{log.actor_role}</p>}
        </td>
        <td className="px-6 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{log.action}</span>
        </td>
        <td className="px-6 py-3 text-sm text-gray-600">
          {log.resource_type && <span>{log.resource_type}</span>}
          {log.resource_id && <span className="text-gray-400 font-mono text-xs ml-1">#{log.resource_id.slice(0, 8)}</span>}
        </td>
        <td className="px-6 py-3 text-xs text-gray-400 font-mono">{log.ip_address ?? '–'}</td>
        <td className="px-6 py-3 text-sm text-gray-400">
          {new Date(log.created_at).toLocaleString('sk-SK')}
        </td>
      </tr>
      {expanded && hasDiff && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={5} className="px-6 pb-3">
            <DataDiff old_data={log.old_data} new_data={log.new_data} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function AuditLogsClient({ logs }: { logs: AuditRow[] }) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [resourceFilter, setResourceFilter] = useState('all')

  const actions = [...new Set(logs.map(l => l.action))].sort()
  const resources = [...new Set(logs.map(l => l.resource_type).filter(Boolean))].sort() as string[]

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (l.actor_name ?? '').toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.resource_type ?? '').toLowerCase().includes(q) ||
      (l.resource_id ?? '').toLowerCase().includes(q)
    const matchAction = actionFilter === 'all' || l.action === actionFilter
    const matchResource = resourceFilter === 'all' || l.resource_type === resourceFilter
    return matchSearch && matchAction && matchResource
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logy</h1>
        <p className="text-gray-500 text-sm mt-1">{logs.length} záznamov (posledných 500) · kliknite na riadok pre diff</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Hľadať podľa aktéra, akcie, zdroja…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
          <option value="all">Všetky akcie</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={resourceFilter} onChange={e => setResourceFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
          <option value="all">Všetky zdroje</option>
          {resources.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{logs.length === 0 ? 'Žiadne záznamy' : 'Žiadne výsledky'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Aktér</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Akcia</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Zdroj</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">IP</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Čas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => <LogRow key={l.id} log={l} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
