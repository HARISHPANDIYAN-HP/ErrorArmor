import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true });

export const unwrap = (res) => res.data.data;
export const errMsg = (e) => e?.response?.data?.error?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is the backend running?' : e?.message) || 'Something went wrong';
export const fieldErrors = (e) => Object.fromEntries((e?.response?.data?.error?.details || []).map((d) => [d.field, d.message]));

export async function download(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fmtDuration = (ms) => {
  if (!ms && ms !== 0) return '-';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};
export const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');
