import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
const origin = Deno.env.get('APP_ORIGIN') ?? ''
const cors = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const b64 = (x: Uint8Array) => btoa(String.fromCharCode(...x))
const unb64 = (x: string) => Uint8Array.from(atob(x), c => c.charCodeAt(0))
Deno.serve(async req => {
  if (!origin || req.headers.get('Origin') !== origin) return reply({ error: 'Origin not allowed' }, 403)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return reply({ error: 'Sign-in required' }, 401)
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, keyText = Deno.env.get('AADHAAR_ENCRYPTION_KEY')!
  if (!url || !anon || !service || !keyText) return reply({ error: 'Vault not configured' }, 503)
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return reply({ error: 'Invalid session' }, 401)
  const admin = createClient(url, service)
  try {
    const { action, residentId, aadhaar } = await req.json()
    if (!['store', 'read', 'delete'].includes(action) || !residentId) return reply({ error: 'Invalid request' }, 400)
    const { data: resident } = await admin.from('residents').select('id,properties!inner(owner_id)').eq('id', residentId).eq('properties.owner_id', user.id).maybeSingle()
    if (!resident) return reply({ error: 'Resident not found or access denied' }, 404)
    const rawKey = unb64(keyText)
    if (rawKey.length !== 32) return reply({ error: 'AES-256 key must decode to 32 bytes' }, 503)
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt'])
    const aad = new TextEncoder().encode(`resident:${residentId}:v1`)
    if (action === 'store') {
      const digits = String(aadhaar ?? '').replace(/\D/g, '')
      if (!/^\d{12}$/.test(digits)) return reply({ error: 'Enter a valid 12-digit Aadhaar number' }, 400)
      const nonce = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, key, new TextEncoder().encode(digits)))
      const { error } = await admin.from('resident_aadhaar_vault').upsert({ resident_id: residentId, ciphertext: b64(encrypted), nonce: b64(nonce), key_version: 'v1', updated_at: new Date().toISOString() })
      if (error) throw error
      await admin.from('aadhaar_access_audit').insert({ owner_user_id: user.id, resident_id: residentId, action: 'store' })
      return reply({ stored: true })
    }
    if (action === 'read') {
      const { data, error } = await admin.from('resident_aadhaar_vault').select('ciphertext,nonce,key_version').eq('resident_id', residentId).maybeSingle()
      if (error) throw error
      if (!data) return reply({ error: 'No Aadhaar stored' }, 404)
      if (data.key_version !== 'v1') return reply({ error: 'Unsupported key version' }, 409)
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(data.nonce), additionalData: aad }, key, unb64(data.ciphertext))
      await admin.from('aadhaar_access_audit').insert({ owner_user_id: user.id, resident_id: residentId, action: 'read' })
      return reply({ aadhaar: new TextDecoder().decode(plain) })
    }
    const { error } = await admin.from('resident_aadhaar_vault').delete().eq('resident_id', residentId)
    if (error) throw error
    await admin.from('aadhaar_access_audit').insert({ owner_user_id: user.id, resident_id: residentId, action: 'delete' })
    return reply({ deleted: true })
  } catch (e) {
    console.error('Aadhaar vault request failed', e)
    return reply({ error: 'Vault operation failed' }, 500)
  }
})
