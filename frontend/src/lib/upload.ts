const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function uploadFile(token: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_URL}/uploads/general`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Upload failed');
  }
  return (await res.json()).url as string;
}

export async function uploadProfilePhoto(
  token: string,
  profileId: string,
  file: File,
): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_URL}/uploads/profile/${profileId}/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to upload photo');
  }
  return (await res.json()).url as string;
}
