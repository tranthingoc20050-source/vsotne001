export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

export interface GenerationTask {
  id: string; // Internal UUID or API ID
  apiTaskId?: string; // ID returned by API
  status: TaskStatus;
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  refImages: string[];
  createdAt: number;
  resultUrl?: string;
  error?: string;
  progress: number;
}

export interface GenerationConfig {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  refImages: string[]; // Base64 strings
}

export interface Character {
  id: string;
  name: string;
  code: string;
  image: string; // Base64
}

export interface ApiCreateResponse {
  code: number;
  msg: string;
  data: {
    id: string;
  };
}

export interface ApiResultResponse {
  code: number;
  msg: string;
  data: {
    id: string;
    results: Array<{ url: string; content: string }>;
    progress: number;
    status: string; // running, succeeded, failed
    failure_reason?: string;
    error?: string;
  };
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}

export const MODELS = [
  { value: 'nano-banana-fast', label: 'Nano Banana 极速版 (Fast)' },
  { value: 'nano-banana', label: 'Nano Banana 标准版' },
  { value: 'nano-banana-pro', label: 'Nano Banana 专业版 (Pro)' },
  { value: 'nano-banana-pro-vt', label: 'Nano Banana Pro VT' },
  { value: 'nano-banana-pro-cl', label: 'Nano Banana Pro CL' },
  { value: 'nano-banana-pro-vip', label: 'Nano Banana Pro VIP' },
  { value: 'nano-banana-pro-4k-vip', label: 'Nano Banana Pro 4K VIP' },
];

export const ASPECT_RATIOS = [
  { value: 'auto', label: '自动 (Auto)' },
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横屏)' },
  { value: '9:16', label: '9:16 (竖屏)' },
  { value: '4:3', label: '4:3 (标准)' },
  { value: '3:4', label: '3:4 (竖向标准)' },
  { value: '3:2', label: '3:2 (胶片)' },
  { value: '2:3', label: '2:3 (竖向胶片)' },
  { value: '21:9', label: '21:9 (超宽屏)' },
];

export const IMAGE_SIZES = [
  { value: '1K', label: '1K (标准)' },
  { value: '2K', label: '2K (仅限 Pro VIP)' },
  { value: '4K', label: '4K (仅限 Pro 4K)' },
];