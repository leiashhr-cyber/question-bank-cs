import { supabase } from './supabaseClient.js';

/*
 * This mirrors the shape of the `window.storage` API the prototype was built
 * against (get/set/delete/list, values are plain strings), so the rest of the
 * app needed almost no changes when moving off the Claude-artifact sandbox.
 * The `shared` flag from the original API is accepted for signature
 * compatibility but ignored — everything here is backed by one real,
 * shared Postgres table.
 */
export const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from('kv_store')
      .select('key,value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key: data.key, value: data.value, shared: true };
  },

  async set(key, value) {
    const { error } = await supabase
      .from('kv_store')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('storage.set failed', error);
      return null;
    }
    return { key, value, shared: true };
  },

  async delete(key) {
    const { error } = await supabase.from('kv_store').delete().eq('key', key);
    if (error) return null;
    return { key, deleted: true, shared: true };
  },

  async list(prefix = '') {
    const { data, error } = await supabase
      .from('kv_store')
      .select('key')
      .like('key', `${prefix}%`);
    if (error) return null;
    return { keys: (data || []).map(r => r.key), prefix, shared: true };
  },
};

/*
 * Uploads a compressed image (as a data URL string, same format the
 * prototype produced) to Supabase Storage and returns a plain public URL.
 * The app's <LazyImage> component already renders any plain URL directly,
 * so no changes were needed on the display side.
 */
export async function uploadImageDataUrl(dataUrl, path) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const { error } = await supabase.storage.from('lesson-images').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('lesson-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteImage(path) {
  await supabase.storage.from('lesson-images').remove([path]);
}
