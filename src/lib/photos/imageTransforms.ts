type ResizeMode = 'cover' | 'contain';

type TransformPreset = {
  width: number;
  height: number;
  quality: number;
  resize: ResizeMode;
};

export type ImageTransformVariant = 'thumbnail' | 'detail' | 'cover';

const OBJECT_PUBLIC_SEGMENT = '/storage/v1/object/public/';
const RENDER_PUBLIC_SEGMENT = '/storage/v1/render/image/public/';

const PRESETS: Record<ImageTransformVariant, TransformPreset> = {
  thumbnail: {
    width: 640,
    height: 640,
    quality: 60,
    resize: 'cover',
  },
  detail: {
    width: 2200,
    height: 2200,
    quality: 85,
    resize: 'contain',
  },
  cover: {
    width: 1200,
    height: 675,
    quality: 70,
    resize: 'cover',
  },
};

function toRenderPath(pathname: string) {
  if (pathname.includes(RENDER_PUBLIC_SEGMENT)) {
    return pathname;
  }

  if (pathname.includes(OBJECT_PUBLIC_SEGMENT)) {
    return pathname.replace(OBJECT_PUBLIC_SEGMENT, RENDER_PUBLIC_SEGMENT);
  }

  return null;
}

export function buildOptimizedPhotoUrl(
  rawUrl: string | null | undefined,
  variant: ImageTransformVariant
) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const renderPath = toRenderPath(parsedUrl.pathname);

    if (!renderPath) {
      return rawUrl;
    }

    const token = parsedUrl.searchParams.get('token');
    const preset = PRESETS[variant];

    parsedUrl.pathname = renderPath;
    parsedUrl.search = '';
    if (token) {
      parsedUrl.searchParams.set('token', token);
    }
    parsedUrl.searchParams.set('width', String(preset.width));
    parsedUrl.searchParams.set('height', String(preset.height));
    parsedUrl.searchParams.set('resize', preset.resize);
    parsedUrl.searchParams.set('quality', String(preset.quality));

    return parsedUrl.toString();
  } catch {
    return rawUrl;
  }
}
