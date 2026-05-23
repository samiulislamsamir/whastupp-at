/**
 * Helper to convert a file to a base64-encoded string.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Uploads an image to ImgBB via our backend API proxy.
 * Keep the API keys secure and clean on the server side.
 * @param file The image file to upload
 * @returns The hosted web URL of the uploaded image
 */
export async function uploadImageToImgBB(file: File): Promise<string> {
  try {
    const base64Data = await fileToBase64(file);
    
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Data }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Upload failed with status ${response.status}`);
    }

    if (result.success && result.url) {
      return result.url;
    }

    throw new Error('Image upload succeeded but no URL was returned');
  } catch (err: any) {
    console.error('ImgBB upload error:', err);
    throw err;
  }
}
