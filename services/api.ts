import { ApiCreateResponse, ApiResultResponse, GenerationConfig } from '../types';

const API_BASE_URL = 'https://grsai.dakka.com.cn/v1/draw';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const resizeImage = (base64: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8)); // Use JPEG with 0.8 quality to save space
    };
    img.onerror = () => resolve(base64); // Fallback to original if error
  });
};

export const createGenerationTask = async (apiKey: string, config: GenerationConfig): Promise<string> => {
  const payload = {
    model: config.model,
    prompt: config.prompt,
    aspectRatio: config.aspectRatio,
    imageSize: config.imageSize,
    urls: config.refImages.length > 0 ? config.refImages : undefined,
    webHook: "-1", // Polling mode
    shutProgress: false,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch(`${API_BASE_URL}/nano-banana`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const data: ApiCreateResponse = await response.json();
    if (data.code !== 0) {
      throw new Error(data.msg || 'Unknown API error');
    }

    return data.data.id;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络或减少参考图数量后重试');
    }
    throw error;
  }
};

export const fetchTaskResult = async (apiKey: string, taskId: string): Promise<ApiResultResponse['data']> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for polling

  try {
    const response = await fetch(`${API_BASE_URL}/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ id: taskId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Failed to check task status');
    }

    const data: ApiResultResponse = await response.json();
    if (data.code !== 0 && data.code !== 200) { 
         throw new Error(data.msg);
    }

    return data.data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('查询状态超时');
    }
    throw error;
  }
};