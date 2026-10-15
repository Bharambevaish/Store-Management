import api from '../services/api.js';

const createBlobUrl = async (path) => {
  const response = await api.get(path, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
};

export const downloadAuthenticatedFile = async (path, filename) => {
  const blobUrl = await createBlobUrl(path);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
};

export const openAuthenticatedFile = async (path) => {
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;

  try {
    const blobUrl = await createBlobUrl(path);
    if (popup) {
      popup.location.replace(blobUrl);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'document.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    if (popup) popup.close();
    throw error;
  }
};
