'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Gauge, Plus, Save, Trash2, Eye, EyeOff } from 'lucide-react'
import LeagueTicker from '@/components/LeagueTicker'

type TickerSettings = {
  id?: string
  league_id: string
  is_enabled?: boolean
  label?: string | null
  speed_seconds?: number | null
  pause_on_hover?: boolean | null
  background_style?: string | null
}

type TickerItem = {
  id: string
  league_id: string
  text: string
  emoji?: string | null
  link_url?: string | null
  is_active?: boolean
  sort_order?: number | null
}

const DEFAULT_SETTINGS: TickerSettings = {
  league_id: '',
  is_enabled: true,
  label: 'League Ticker',
  speed_seconds: 32,
  pause_on_hover: true,
  background_style: 'emerald',
}


function isTickerSetupError(message?: string) {
  const normalized = String(message || '').toLowerCase()
  return (
    normalized.includes('league_ticker_items') ||
    normalized.includes('league_ticker_settings') ||
    normalized.includes('schema cache')
  )
}

export default function LeagueTickerManager({
  leagueId,
  initialSettings,
  initialItems,
  setupError,
}: {
  leagueId: string
  initialSettings: TickerSettings | null
  initialItems: TickerItem[]
  setupError?: string
}) {
  const supabase = createClient()
  const [settings, setSettings] = useState<TickerSettings>({
    ...DEFAULT_SETTINGS,
    ...(initialSettings || {}),
    league_id: leagueId,
  })
  const [items, setItems] = useState<TickerItem[]>(initialItems || [])
  const [newEmoji, setNewEmoji] = useState('🔥')
  const [newText, setNewText] = useState('')
  const [newLink, setNewLink] = useState('')
  const [status, setStatus] = useState(setupError || '')
  const [saving, setSaving] = useState(false)

  const previewItems = useMemo(() => {
    if (items.length) return items
    return [
      {
        id: 'preview-1',
        league_id: leagueId,
        emoji: '🔥',
        text: 'Blockbuster trade just dropped',
        is_active: true,
        sort_order: 1,
      },
      {
        id: 'preview-2',
        league_id: leagueId,
        emoji: '🏆',
        text: 'Trophy Room updated with league history',
        is_active: true,
        sort_order: 2,
      },
      {
        id: 'preview-3',
        league_id: leagueId,
        emoji: '📈',
        text: 'Power rankings chaos incoming',
        is_active: true,
        sort_order: 3,
      },
    ]
  }, [items, leagueId])

  async function saveSettings() {
    setStatus('')
    setSaving(true)

    const { error } = await supabase.from('league_ticker_settings').upsert(
      {
        league_id: leagueId,
        is_enabled: !!settings.is_enabled,
        label: settings.label?.trim() || 'League Ticker',
        speed_seconds: Math.max(Number(settings.speed_seconds || 32), 8),
        pause_on_hover: settings.pause_on_hover !== false,
        background_style: settings.background_style || 'emerald',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'league_id' }
    )

    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus('Ticker settings saved.')
  }

  async function addItem() {
    setStatus('')

    if (!newText.trim()) {
      setStatus('Ticker text is required.')
      return
    }

    const nextSortOrder =
      Math.max(0, ...items.map((item) => Number(item.sort_order || 0))) + 1

    const { data, error } = await supabase
      .from('league_ticker_items')
      .insert({
        league_id: leagueId,
        emoji: newEmoji.trim() || '⚡',
        text: newText.trim(),
        link_url: newLink.trim() || null,
        is_active: true,
        sort_order: nextSortOrder,
      })
      .select('*')
      .single()

    if (error) {
      setStatus(error.message)
      return
    }

    setItems((current) => [...current, data])
    setNewText('')
    setNewLink('')
    setNewEmoji('🔥')
    setStatus('Ticker item added.')
  }

  async function updateItem(item: TickerItem, patch: Partial<TickerItem>) {
    const nextItem = { ...item, ...patch }
    setItems((current) =>
      current.map((existing) => (existing.id === item.id ? nextItem : existing))
    )

    if (item.id.startsWith('preview-')) return

    const { error } = await supabase
      .from('league_ticker_items')
      .update({
        emoji: nextItem.emoji,
        text: nextItem.text,
        link_url: nextItem.link_url || null,
        is_active: nextItem.is_active !== false,
        sort_order: Number(nextItem.sort_order || 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('league_id', leagueId)

    if (error) setStatus(error.message)
  }

  async function deleteItem(item: TickerItem) {
    const confirmed = window.confirm('Delete this ticker item?')
    if (!confirmed) return

    setItems((current) => current.filter((existing) => existing.id !== item.id))

    const { error } = await supabase
      .from('league_ticker_items')
      .delete()
      .eq('id', item.id)
      .eq('league_id', leagueId)

    if (error) setStatus(error.message)
  }

  async function moveItem(item: TickerItem, direction: -1 | 1) {
    const ordered = [...items].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
    )
    const index = ordered.findIndex((existing) => existing.id === item.id)
    const swapIndex = index + direction

    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return

    const first = ordered[index]
    const second = ordered[swapIndex]
    const firstOrder = Number(first.sort_order || index + 1)
    const secondOrder = Number(second.sort_order || swapIndex + 1)

    await updateItem(first, { sort_order: secondOrder })
    await updateItem(second, { sort_order: firstOrder })
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950">
            <Gauge size={22} />
          </div>
          <div>
            <h2 className="text-3xl font-black">League Ticker Bar</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Create a rolling scoreboard-style banner for trades, jokes, weekly notes, and league chaos.
            </p>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <LeagueTicker settings={{ ...settings, is_enabled: true }} items={previewItems} />
      </div>

      {isTickerSetupError(status) && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-black">Ticker database tables are not set up yet.</p>
          <p className="mt-1 text-amber-100/80">
            Run <span className="font-mono">supabase/league-ticker.sql</span> in Supabase SQL Editor, then refresh this page. The ticker UI is loaded, but saving items will fail until those tables exist.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <label className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 lg:col-span-2">
          <span className="text-sm font-bold text-zinc-400">Ticker label</span>
          <input
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-emerald-500"
            value={settings.label || ''}
            onChange={(e) => setSettings({ ...settings, label: e.target.value })}
            placeholder="League Ticker"
          />
        </label>

        <label className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <span className="text-sm font-bold text-zinc-400">Speed</span>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min="8"
              max="90"
              value={Number(settings.speed_seconds || 32)}
              onChange={(e) =>
                setSettings({ ...settings, speed_seconds: Number(e.target.value) })
              }
              className="w-full accent-emerald-500"
            />
            <span className="w-14 text-right text-sm font-black text-emerald-400">
              {Number(settings.speed_seconds || 32)}s
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Lower is faster.</p>
        </label>

        <label className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <span className="text-sm font-bold text-zinc-400">Color</span>
          <select
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-emerald-500"
            value={settings.background_style || 'emerald'}
            onChange={(e) =>
              setSettings({ ...settings, background_style: e.target.value })
            }
          >
            <option value="emerald">Emerald</option>
            <option value="gold">Gold</option>
            <option value="red">Red/Orange</option>
            <option value="blue">Blue</option>
            <option value="purple">Purple</option>
          </select>
        </label>

        <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <button
            onClick={() => setSettings({ ...settings, is_enabled: !settings.is_enabled })}
            className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-black transition ${
              settings.is_enabled
                ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {settings.is_enabled ? <Eye size={18} /> : <EyeOff size={18} />}
            {settings.is_enabled ? 'Enabled' : 'Disabled'}
          </button>

          <button
            onClick={() =>
              setSettings({ ...settings, pause_on_hover: settings.pause_on_hover === false })
            }
            className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-black text-zinc-300 hover:bg-zinc-900"
          >
            {settings.pause_on_hover === false ? 'Hover Pause Off' : 'Hover Pause On'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="text-xl font-black">Add Ticker Item</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-[90px_1fr_1fr_auto]">
          <input
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-center text-xl outline-none focus:border-emerald-500"
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
            placeholder="🔥"
            maxLength={4}
          />
          <input
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-emerald-500"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Ticker text, e.g. Jack wins the trade deadline"
          />
          <input
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-emerald-500"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="Optional link, e.g. /league/.../trade-center"
          />
          <button
            onClick={addItem}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 hover:bg-emerald-400"
          >
            <Plus size={18} /> Add
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <h3 className="text-xl font-black">Ticker Items</h3>

        <AnimatePresence initial={false}>
          {[...items]
            .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
            .map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="grid gap-3 lg:grid-cols-[80px_1fr_1fr_auto] lg:items-center">
                  <input
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-lg outline-none focus:border-emerald-500"
                    value={item.emoji || ''}
                    onChange={(e) => updateItem(item, { emoji: e.target.value })}
                    maxLength={4}
                  />
                  <input
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-emerald-500"
                    value={item.text || ''}
                    onChange={(e) => updateItem(item, { text: e.target.value })}
                  />
                  <input
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-emerald-500"
                    value={item.link_url || ''}
                    onChange={(e) => updateItem(item, { link_url: e.target.value })}
                    placeholder="Optional link"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => moveItem(item, -1)}
                      className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-black hover:bg-zinc-900"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveItem(item, 1)}
                      className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-black hover:bg-zinc-900"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => updateItem(item, { is_active: item.is_active === false })}
                      className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-black hover:bg-zinc-900"
                    >
                      {item.is_active === false ? 'Show' : 'Hide'}
                    </button>
                    <button
                      onClick={() => deleteItem(item)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-900 px-3 py-2 text-sm font-black text-red-300 hover:bg-red-950/40"
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>

        {!items.length && (
          <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-5 text-zinc-400">
            No saved ticker items yet. Add a few items above and they will scroll across the league home page.
          </p>
        )}
      </div>

      {status && <p className="mt-4 text-sm font-bold text-zinc-400">{status}</p>}
    </section>
  )
}
