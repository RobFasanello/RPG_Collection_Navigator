import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';
import useModalFocusTrap from '../hooks/useModalFocusTrap';

type ImageCropDialogProps = {
  file: File;
  title: string;
  onApply: (file: File) => void;
  onCancel: () => void;
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

const PREVIEW_MAX_WIDTH = 960;
const PREVIEW_MAX_HEIGHT = 560;
const MIN_CROP_SIZE = 8;
const IMAGE_QUALITY = 0.88;

function getPreviewSize(image: HTMLImageElement) {
  const scale = Math.min(
    PREVIEW_MAX_WIDTH / image.naturalWidth,
    PREVIEW_MAX_HEIGHT / image.naturalHeight,
    1
  );

  return {
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale)),
  };
}

function normalizeCrop(start: Point, end: Point): CropRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function drawCropPreview({
  canvas,
  image,
  crop,
  brightness,
  contrast,
}: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  crop: CropRect;
  brightness: number;
  contrast: number;
}) {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.filter = 'none';

  context.fillStyle = 'rgba(17, 24, 39, 0.68)';
  context.fillRect(0, 0, canvas.width, crop.y);
  context.fillRect(0, crop.y + crop.height, canvas.width, canvas.height - crop.y - crop.height);
  context.fillRect(0, crop.y, crop.x, crop.height);
  context.fillRect(crop.x + crop.width, crop.y, canvas.width - crop.x - crop.width, crop.height);

  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  context.setLineDash([8, 5]);
  context.strokeRect(crop.x + 1, crop.y + 1, Math.max(0, crop.width - 2), Math.max(0, crop.height - 2));
  context.setLineDash([]);
}

function createCroppedImageFile({
  file,
  image,
  crop,
  previewWidth,
  previewHeight,
  brightness,
  contrast,
}: {
  file: File;
  image: HTMLImageElement;
  crop: CropRect;
  previewWidth: number;
  previewHeight: number;
  brightness: number;
  contrast: number;
}) {
  const outputType = /\.jpe?g$/i.test(file.name) ? 'image/jpeg' : 'image/webp';
  const sourceX = Math.round((crop.x / previewWidth) * image.naturalWidth);
  const sourceY = Math.round((crop.y / previewHeight) * image.naturalHeight);
  const sourceWidth = Math.max(1, Math.round((crop.width / previewWidth) * image.naturalWidth));
  const sourceHeight = Math.max(1, Math.round((crop.height / previewHeight) * image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return Promise.reject(new Error('Could not create cropped image.'));
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not create cropped image.'));
          return;
        }

        resolve(new File([blob], file.name, { type: outputType }));
      },
      outputType,
      IMAGE_QUALITY
    );
  });
}

export default function ImageCropDialog({ file, title, onApply, onCancel }: ImageCropDialogProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ pointerId: number; start: Point } | null>(null);
  const modalRef = useModalFocusTrap<HTMLDivElement>(true, onCancel);
  const [imageUrl, setImageUrl] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: PREVIEW_MAX_WIDTH, height: PREVIEW_MAX_HEIGHT });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: PREVIEW_MAX_WIDTH, height: PREVIEW_MAX_HEIGHT });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const nextImageUrl = URL.createObjectURL(file);
    setImageUrl(nextImageUrl);
    setImageLoaded(false);
    setBrightness(100);
    setContrast(100);
    setError('');

    return () => URL.revokeObjectURL(nextImageUrl);
  }, [file]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = previewCanvasRef.current;
    if (!imageLoaded || !image || !canvas) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      drawCropPreview({ canvas, image, crop, brightness, contrast });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [imageLoaded, crop, brightness, contrast, previewSize]);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(previewSize.width, (event.clientX - bounds.left) * (previewSize.width / bounds.width))),
      y: Math.max(0, Math.min(previewSize.height, (event.clientY - bounds.top) * (previewSize.height / bounds.height))),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imageLoaded || event.button !== 0) {
      return;
    }

    const start = getCanvasPoint(event);
    dragRef.current = { pointerId: event.pointerId, start };
    setCrop({ x: start.x, y: start.y, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    setCrop(normalizeCrop(drag.start, getCanvasPoint(event)));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextCrop = normalizeCrop(drag.start, getCanvasPoint(event));
    if (nextCrop.width < MIN_CROP_SIZE || nextCrop.height < MIN_CROP_SIZE) {
      setCrop({ x: 0, y: 0, width: previewSize.width, height: previewSize.height });
    } else {
      setCrop(nextCrop);
    }

    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resetCrop = () => {
    setCrop({ x: 0, y: 0, width: previewSize.width, height: previewSize.height });
    setBrightness(100);
    setContrast(100);
  };

  const handleApply = async () => {
    const image = imageRef.current;
    if (!imageLoaded || !image) {
      setError('Image is still loading.');
      return;
    }
    if (crop.width < MIN_CROP_SIZE || crop.height < MIN_CROP_SIZE) {
      setError('Drag a crop box across the image before applying.');
      return;
    }

    setIsApplying(true);
    setError('');
    try {
      const croppedFile = await createCroppedImageFile({
        file,
        image,
        crop,
        previewWidth: previewSize.width,
        previewHeight: previewSize.height,
        brightness,
        contrast,
      });
      onApply(croppedFile);
    } catch (err: any) {
      setError(err?.message || 'Could not create cropped image.');
    } finally {
      setIsApplying(false);
    }
  };

  const selectedWidth = imageRef.current
    ? Math.max(1, Math.round((crop.width / previewSize.width) * imageRef.current.naturalWidth))
    : 0;
  const selectedHeight = imageRef.current
    ? Math.max(1, Math.round((crop.height / previewSize.height) * imageRef.current.naturalHeight))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={modalRef} tabIndex={-1} className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-xl font-bold text-[var(--arcane-ink-900)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--arcane-ink-soft)]">Drag a box across the image to choose the area to keep.</p>

        {error ? <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-5 flex justify-center overflow-hidden rounded-lg border border-[var(--arcane-border-light)] bg-gray-900">
          <canvas
            ref={previewCanvasRef}
            width={previewSize.width}
            height={previewSize.height}
            aria-label="Image crop preview. Drag a box to select the crop area."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            className="block max-h-[56vh] max-w-full touch-none cursor-crosshair object-contain"
          />
        </div>

        {imageUrl ? (
          <img
            ref={imageRef}
            src={imageUrl}
            alt=""
            className="hidden"
            onLoad={(event) => {
              const size = getPreviewSize(event.currentTarget);
              setPreviewSize(size);
              setCrop({ x: 0, y: 0, width: size.width, height: size.height });
              setImageLoaded(true);
            }}
            onError={() => setError('Could not load the selected image.')}
          />
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-[var(--arcane-ink-900)]">Selected image: {selectedWidth} x {selectedHeight} px</span>
          <span className="text-[var(--arcane-ink-soft)]">Drag again to replace the selection.</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-[var(--arcane-ink-900)]">
            Brightness: {brightness}%
            <input
              type="range"
              min="50"
              max="180"
              step="1"
              value={brightness}
              onChange={(event) => setBrightness(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--arcane-ink-900)]">
            Contrast: {contrast}%
            <input
              type="range"
              min="50"
              max="180"
              step="1"
              value={contrast}
              onChange={(event) => setContrast(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={resetCrop} className="bg-[#e2d5bd99] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-border-light)]">
            Reset
          </Button>
          <Button type="button" onClick={onCancel} className="bg-[#e2d5bd99] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-border-light)]">
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} disabled={!imageLoaded || isApplying}>
            {isApplying ? 'Applying...' : 'Apply Crop'}
          </Button>
        </div>
      </div>
    </div>
  );
}
