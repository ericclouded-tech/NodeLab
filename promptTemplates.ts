
export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'cinematic-realism',
    title: '🎬 Cinematic',
    content: 'Ultra-realistic, 8k resolution, cinematic lighting, shot on 35mm lens, depth of field, detailed textures, volumetric fog, moody atmosphere, professional color grading.'
  },
  {
    id: 'ghibli-anime',
    title: '🍃 吉卜力风格',
    content: 'Studio Ghibli style, hand-drawn aesthetic, lush green landscapes, soft sunlight, nostalgic atmosphere, vibrant colors, Joe Hisaishi movie vibes, highly detailed background.'
  },
  {
    id: 'cyberpunk-neon',
    title: '🌃 赛博朋克',
    content: 'Cyberpunk aesthetic, neon-drenched city streets, rainy night, reflections on puddles, futuristic technology, high contrast, pink and blue lighting, blade runner style.'
  },
  {
    id: 'concept-sketch',
    title: '✏️ 概念草图',
    content: 'Rough concept sketch, charcoal and graphite, white background, artistic lines, architectural study, expressive strokes, minimal shading.'
  },
  {
    id: 'masterpiece-standard',
    title: '🌟 Masterpiece',
    content: 'Masterpiece, best quality, highly detailed, sharp focus, intricate details, professional lighting, award winning photography.'
  },
  {
    id: 'HD-redraw',
    title: '🌟 高清-重绘',
    content: '请对参考图片进行无损高清放大（Upscale）。请严格保持原图的构图、色彩、光影和所有细节元素不变，不要进行任何创造性的重绘或添加新内容。仅专注于提升分辨率、锐化边缘（Sharpening）和去除噪点（Denoising），实现像素级的高清修复。Best quality, 8k, masterpiece, highres, ultra detailed, sharp focus, image restoration, upscale, faithful to original.'
  },
  {
    id: 'Mood Board',
    title: '🌟 Mood Board',
    content: ' # Directive: Create a "Rich Narrative Mood Board" (9-Grid Layout)\n## 1. PROJECT INPUT \n**A. [Story & Concept / 故事与核心想法]**\n> [跟据自身内容书写]\n**B. [Key Symbols / 核心意象 (Optional)]**\n> [深度理解参考图，自行创作]\n**C. [Color Preferences / 色彩倾向 (Optional)]**\n> [深度理解参考图，自行创作]\n**D. [Reference Images / 参考图]**\n> (See attached images / 请读取我上传的图片)\n'
  },
  {
    id: 'character Board',
    title: '🌟 角色设计分拆',
    content: '(strictly mimic source image art style:1.5), (same visual style:1.4),\nscore_9, score_8_up, masterpiece, best quality, (character sheet:1.4), (reference sheet:1.3), (consistent art style:1.3), matching visual style, \n[Structure & General Annotations]:\nmultiple views, full body central figure, clean background, \n(heavy annotation:1.4), (text labels with arrows:1.3), handwriting, data readout,\n[SPECIAL CHARACTER DESCRIPTION AREA]:\n(prominent character profile text box:1.6), (dedicated biography section:1.5), large descriptive text block,\n[在此处填写特殊角色说明，例如：姓名、种族、背景故事等],\n[Clothing Breakdown]:\n(clothing breakdown:1.5), (outfit decomposition:1.4), garment analysis, (floating apparel:1.3), \ndisplaying outerwear, displaying upper body garment, displaying lower body garment, \n[Footwear Focus]:\n(detailed footwear display:1.5), (floating shoes:1.4), shoe design breakdown, focus on shoes, \n[Inventory & Details]:\n(inventory knolling:1.2), open container, personal accessories, organized items display, expression panels\n'
  }
];


