/**
 * YouTube OAuth (PKCE) + Token-Refresh.
 * Env: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET
 * Optional: YOUTUBE_REDIRECT_URI (sonst {origin}/api/youtube/auth/callback)
 * Google Cloud: YouTube Data API v3, Redirects localhost + Production.
 */
import 'server-only'

import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  leseYoutubeTokensAdmin,
  loescheYoutubeTokensDb,
  speichereYoutubeTokensAdmin,
  type YoutubeStoredTokens,
} from '@/lib/youtube/youtube-oauth-store'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload'

export function youtubeApiKonfiguriert(): boolean {
  return Boolean(process.env.YOUTUBE_CLIENT_ID?.trim() && process.env.YOUTUBE_CLIENT_SECRET?.trim())
}

function youtubeClientId(): string {
  const id = process.env.YOUTUBE_CLIENT_ID?.trim()
  if (!id) throw new Error('YOUTUBE_CLIENT_ID fehlt in .env.local')
  return id
}

function youtubeClientSecret(): string {
  const s = process.env.YOUTUBE_CLIENT_SECRET?.trim()
  if (!s) throw new Error('YOUTUBE_CLIENT_SECRET fehlt in .env.local')
  return s
}

export function youtubeRedirectUri(origin: string): string {
  const explicit = process.env.YOUTUBE_REDIRECT_URI?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  return `${origin.replace(/\/+$/, '')}/api/youtube/auth/callback`
}

export function erzeugeYoutubePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function baueYoutubeAuthUrl(origin: string, state: string, codeChallenge: string): string {
  const url = new URL(AUTH_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', youtubeClientId())
  url.searchParams.set('redirect_uri', youtubeRedirectUri(origin))
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  return url.toString()
}

async function tokenRequest(body: URLSearchParams, bisher?: YoutubeStoredTokens | null): Promise<YoutubeStoredTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube Token-Request fehlgeschlagen (${res.status}): ${text.slice(0, 240)}`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || bisher?.refreshToken || '',
    expiresAtMs: Date.now() + Number(data.expires_in || 3600) * 1000 - 60_000,
    channelId: bisher?.channelId ?? null,
    channelTitle: bisher?.channelTitle ?? null,
  }
}

export async function tauscheYoutubeAuthCode(opts: {
  code: string
  origin: string
  ownerUserId: string
  codeVerifier: string
}): Promise<void> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    client_id: youtubeClientId(),
    client_secret: youtubeClientSecret(),
    redirect_uri: youtubeRedirectUri(opts.origin),
    code_verifier: opts.codeVerifier,
  })
  const tokens = await tokenRequest(body)
  if (!tokens.refreshToken) throw new Error('Google lieferte kein Refresh-Token — bitte erneut verbinden (prompt=consent).')
  const kanal = await ladeKanalInfo(tokens.accessToken)
  await speichereYoutubeTokensAdmin(opts.ownerUserId, { ...tokens, ...kanal })
}

export async function frischesYoutubeAccessToken(ownerUserId: string): Promise<YoutubeStoredTokens> {
  const bisher = await leseYoutubeTokensAdmin(ownerUserId)
  if (!bisher) throw new Error('YouTube ist nicht verbunden.')
  if (bisher.expiresAtMs > Date.now() + 15_000) return bisher
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: bisher.refreshToken,
    client_id: youtubeClientId(),
    client_secret: youtubeClientSecret(),
  })
  const neu = await tokenRequest(body, bisher)
  if (!neu.refreshToken) neu.refreshToken = bisher.refreshToken
  await speichereYoutubeTokensAdmin(ownerUserId, neu)
  return neu
}

async function ladeKanalInfo(accessToken: string): Promise<{ channelId: string | null; channelTitle: string | null }> {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return { channelId: null, channelTitle: null }
    const j = (await res.json()) as { items?: { id?: string; snippet?: { title?: string } }[] }
    const item = j.items?.[0]
    return { channelId: item?.id ?? null, channelTitle: item?.snippet?.title ?? null }
  } catch {
    return { channelId: null, channelTitle: null }
  }
}

export async function youtubeStatus(sb: SupabaseClient | null): Promise<{
  configured: boolean
  connected: boolean
  channelTitle: string | null
}> {
  const configured = youtubeApiKonfiguriert()
  if (!sb) return { configured, connected: false, channelTitle: null }
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return { configured, connected: false, channelTitle: null }
  const tokens = await leseYoutubeTokensAdmin(user.id)
  if (!tokens) return { configured, connected: false, channelTitle: null }
  return { configured, connected: true, channelTitle: tokens.channelTitle }
}

export async function youtubeTrennen(sb: SupabaseClient): Promise<void> {
  await loescheYoutubeTokensDb(sb)
}
