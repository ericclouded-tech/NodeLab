
import { GoogleGenAI, Type } from "@google/genai";

const GRSAI_HOST = "https://grsai.dakka.com.cn";
const COMFLY_HOST = "https://ai.comfly.chat";

export const fetchImageAsBase64 = async (url: string): Promise<{ data: string, mimeType: string }> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({ data: base64String, mimeType: blob.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * 映射比例和等级到 Comfly 接受的 size 字符串
 */
const mapToComflySize = (ratio: string, level: string = '1K'): string => {
  const sizes: Record<string, Record<string, string>> = {
    '1:1': { '1K': '1024x1024', '2K': '1536x1536', '4K': '2048x2048' },
    '16:9': { '1K': '1280x720', '2K': '1920x1080', '4K': '2560x1440' },
    '9:16': { '1K': '720x1280', '2K': '1080x1920', '4K': '1440x2560' },
    '4:3': { '1K': '1024x768', '2K': '1440x1080', '4K': '2048x1536' },
    '3:4': { '1K': '768x1024', '2K': '1080x1440', '4K': '1536x2048' },
  };
  return sizes[ratio]?.[level] || sizes['1:1']['1K'];
};

export const uploadToImgBB = async (imageSource: File | Blob | string, apiKey: string, name?: string) => {
  if (!apiKey) throw new Error("缺少 imgBB API Key");
  const formData = new FormData();
  if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    formData.append("image", imageSource.split(',')[1]);
  } else {
    formData.append("image", imageSource);
  }
  if (name) formData.append("name", name);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: "POST",
    body: formData,
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error?.message || "上传失败");
  
  return {
    url: result.data.url,
    mediumUrl: result.data.medium?.url || result.data.display_url || result.data.url
  };
};

export const prepareVeoPayload = (params: {
  model: string;
  prompt: string;
  urls: string[];
  aspectRatio: string;
  resolution?: string;
  durationSeconds?: string;
}) => {
  const { model, prompt, aspectRatio, urls, resolution, durationSeconds } = params;
  
  const payload: any = {
    model: model,
    aspectRatio: aspectRatio,
    firstFrameUrl: "",
    lastFrameUrl: "",
    urls: null,
    prompt: prompt,
    resolution: resolution || "720p",
    durationSeconds: durationSeconds ? parseInt(durationSeconds, 10) : 6,
    personGeneration: (urls.length > 0) ? "allow_adult" : "allow_all",
    webhook: "-1",
    shutProgress: false,
    cdn: ""
  };

  if (urls.length === 1) {
    payload.firstFrameUrl = urls[0];
    payload.lastFrameUrl = "";
    payload.urls = null;
  } else if (urls.length === 2) {
    payload.firstFrameUrl = urls[0];
    payload.lastFrameUrl = urls[1];
    payload.urls = null;
  } else if (urls.length >= 3) {
    payload.firstFrameUrl = "";
    payload.lastFrameUrl = "";
    payload.urls = urls.slice(0, 3);
  } else {
    payload.firstFrameUrl = "";
    payload.lastFrameUrl = "";
    payload.urls = null;
  }

  if (model === 'sora-2') {
    return {
      model: model,
      prompt: prompt,
      aspectRatio: aspectRatio,
      url: urls[0] || "",
      duration: 10,
      size: "small",
      webhook: "-1",
      shutProgress: false
    };
  }

  return payload;
};

export const grsaiDraw = async (params: {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize?: string;
  urls?: string[];
  apiKey: string;
}) => {
  const response = await fetch(`${GRSAI_HOST}/v1/draw/nano-banana`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      ...params,
      webHook: "-1",
      shutProgress: false
    }),
  });
  const data = await response.json();
  if (data.code !== 0) throw new Error(data.msg);
  return data.data.id;
};

export const grsaiVideo = async (params: {
  model: string;
  prompt: string;
  urls?: string[];
  aspectRatio: string;
  resolution?: string;
  durationSeconds?: string;
  apiKey: string;
}) => {
  const { model, apiKey } = params;
  
  const payload = prepareVeoPayload({
    model,
    prompt: params.prompt,
    urls: params.urls || [],
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
    durationSeconds: params.durationSeconds
  });

  const endpoint = model === 'sora-2' ? '/v1/video/sora-video' : '/v1/video/veo';

  const response = await fetch(`${GRSAI_HOST}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
  });
  
  const data = await response.json();
  if (data.code !== 0) throw new Error(data.msg);
  return data.data.id;
};

export const pollGrsaiResult = async (id: string, apiKey: string) => {
  const response = await fetch(`${GRSAI_HOST}/v1/draw/result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({ id }),
  });
  const data = await response.json();
  return data.data; 
};

// Comfly API services
export const comflyVideo = async (params: {
  model: string;
  prompt: string;
  urls?: string[];
  aspectRatio: string;
  apiKey: string;
  enable_upsample?: boolean;
}) => {
  const { model, apiKey, prompt, urls, aspectRatio, enable_upsample } = params;
  
  const payload = {
    prompt,
    model,
    aspect_ratio: aspectRatio === '1:1' ? '16:9' : aspectRatio,
    images: urls && urls.length > 0 ? urls : undefined,
    enable_upsample: enable_upsample
  };

  const response = await fetch(`${COMFLY_HOST}/v2/videos/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
  });
  
  const data = await response.json();
  const taskId = data.task_id || (data.data && data.data.task_id);
  if (!taskId) throw new Error(data.message || "Comfly 视频任务提交失败");
  return taskId;
};

/**
 * Comfly 异步绘图/重绘接口 (V1)
 */
export const comflyDrawTask = async (params: {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize?: string;
  urls?: string[];
  apiKey: string;
}) => {
  const { model, apiKey, prompt, urls, aspectRatio, imageSize } = params;
  const targetSize = mapToComflySize(aspectRatio, imageSize);
  const hasImages = urls && urls.length > 0;

  let endpoint = hasImages ? "/v1/images/edits" : "/v1/images/generations";
  const url = `${COMFLY_HOST}${endpoint}?async=true`;

  const headers = new Headers();
  headers.append("Authorization", `Bearer ${apiKey}`);

  let requestBody: any;

  if (hasImages) {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("model", model);
    formData.append("size", targetSize);
    formData.append("n", "1");
    // 获取图片并作为文件流上传
    const imgResponse = await fetch(urls[0]);
    const blob = await imgResponse.blob();
    formData.append("image", blob, "input.png");
    requestBody = formData;
  } else {
    headers.append("Content-Type", "application/json");
    requestBody = JSON.stringify({
      prompt,
      model,
      size: targetSize,
      n: 1
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: requestBody,
  });
  
  const result = await response.json();
  // 按照 Comfly V1 范例，任务 ID 可能在 data.task_id 中
  const taskId = result.task_id || (result.data && result.data.task_id) || result.id || (result.data && result.data.id);
  if (!taskId) throw new Error(result.message || "Comfly 异步任务提交失败");
  return taskId;
};

/**
 * Comfly 轮询任务结果 (V1 /tasks)
 */
export const pollComflyImageResult = async (taskId: string, apiKey: string) => {
  const response = await fetch(`${COMFLY_HOST}/v1/images/tasks/${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
  });
  const data = await response.json();
  return data;
};

/**
 * Comfly 同步绘图接口
 */
export const comflyDraw = async (params: {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize?: string;
  urls?: string[];
  apiKey: string;
}) => {
  const { model, apiKey, prompt, urls, aspectRatio, imageSize } = params;
  const targetSize = mapToComflySize(aspectRatio, imageSize);
  
  const payload = {
    model,
    prompt,
    size: targetSize,
    n: 1,
    image: urls && urls.length > 0 ? urls[0] : undefined,
  };

  const response = await fetch(`${COMFLY_HOST}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
  });
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Comfly 绘图失败");
  
  const url = data.data?.[0]?.url || data.url;
  if (!url) throw new Error("未获取到图片 URL");
  return url;
};

export const pollComflyResult = async (taskId: string, apiKey: string) => {
  const response = await fetch(`${COMFLY_HOST}/v2/videos/generations/${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    },
  });
  const data = await response.json();
  return data;
};

export const getGrsaiCredits = async (apiKey: string) => {
  if (!apiKey) return null;
  const response = await fetch(`${GRSAI_HOST}/client/openapi/getAPIKeyCredits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ apiKey }),
  });
  const result = await response.json();
  return result;
};

export const getComflyCredits = async (apiKey: string) => {
  if (!apiKey) return null;
  try {
    const response = await fetch(`${COMFLY_HOST}/v1/token/quota`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP Error: ${response.status} - ${errText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (err: any) {
    throw new Error(err.message || "Network Error");
  }
};

export const geminiTextExpert = async (prompt: string, systemInstruction: string, images?: { data: string, mimeType: string }[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [{ text: prompt }];
  if (images && images.length > 0) {
    images.forEach(img => {
      parts.push({ inlineData: img });
    });
  }
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      systemInstruction: `${systemInstruction}\n\n注意：你必须返回有效的 JSON 格式，包含 displaySummary 和 outputs 数组。`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          displaySummary: { type: Type.STRING, description: "一段对创作意图的精彩总结文字" },
          outputs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "提示词标题" },
                prompt: { type: Type.STRING, description: "具体的创作提示词内容" }
              },
              required: ["title", "prompt"]
            }
          }
        },
        required: ["displaySummary", "outputs"]
      }
    },
  });
  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return { displaySummary: response.text, outputs: [] };
  }
};

export const geminiNativeImageGen = async (prompt: string, aspectRatio: string, imageSize: string = '1K', images?: { data: string, mimeType: string }[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = (imageSize === '2K' || imageSize === '4K') 
    ? 'gemini-3-pro-image-preview' 
    : 'gemini-2.5-flash-image';

  const parts: any[] = [{ text: prompt }];
  if (images && images.length > 0) {
    images.forEach(img => {
      parts.push({ inlineData: img });
    });
  }
  const response = await ai.models.generateContent({
    model: model,
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any || "1:1",
        ...(model === 'gemini-3-pro-image-preview' ? { imageSize: imageSize as any } : {})
      }
    }
  });
  if (!response.candidates?.[0]?.content?.parts) throw new Error("生成失败");
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("未找到图像数据");
};
