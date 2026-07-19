import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';
import useModalFocusTrap from '../hooks/useModalFocusTrap';

type ImageCropDialogProps = {
  file: File;
  title: string;
  onApply: (file: File) => void;
  onCancel: () => void;
  outputWidth?: number;
  outputHeight?: number;
};

type CropMode = 'fill' | 'fit';

type OutputSizeOption = {
  key: 'small' | 'medium' | 'large';
  label: string;
  width: number;
  height: number;
  quality: number;
};

const OUTPUT_SIZE_OPTIONS: OutputSizeOption[] = [
  { key: 'small', label: 'Small', width: 640, height: 360, quality: 0.8 },
  { key: 'medium', label: 'Medium', width: 960, height: 540, quality: 0.82 },
  { key: 'large', label: 'Large', width: 1200, height: 675, quality: 0.88 },
];

const DEFAULT_OUTPUT_WIDTH = 960;
const DEFAULT_OUTPUT_HEIGHT = 540;
const PREVIEW_WIDTH = 960;

function drawCroppedImage({
  canvas,
  image,
  zoom,
  offsetX,
  offsetY,
  mode,
  brightness,
  contrast,
}: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  zoom: number;
  offsetX: number;
  offsetY: number;
  mode: CropMode;
  brightness: number;
  contrast: number;
}) {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const baseScale = mode === 'fill'
    ? Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
    : Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const scale = baseScale * zoom;
  const scaledWidth = image.naturalWidth * scale;
  const scaledHeight = image.naturalHeight * scale;
  const maxOffsetX = Math.max(0, (scaledWidth - canvas.width) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - canvas.height) / 2);
  const drawX = (canvas.width - scaledWidth) / 2 + (offsetX / 100) * maxOffsetX;
  const drawY = (canvas.height - scaledHeight) / 2 + (offsetY / 100) * maxOffsetY;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111827';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);
  context.filter = 'none';
}

function createCroppedWebpFile({
  file,
  image,
  zoom,
  offsetX,
  offsetY,
  outputWidth,
  outputHeight,
  quality,
  mode,
  brightness,
  contrast,
}: {
  file: File;
  image: HTMLImageElement;
  zoom: number;
  offsetX: number;
  offsetY: number;
  outputWidth: number;
  outputHeight: number;
  quality: number;
  mode: CropMode;
  brightness: number;
  contrast: number;
}) {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  drawCroppedImage({ canvas, image, zoom, offsetX, offsetY, mode, brightness, contrast });

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not create cropped image.'));
          return;
        }

        resolve(new File([blob], file.name, { type: 'image/webp' }));
      },
      'image/webp',
      quality
    );
  });
}

function getInitialOutputSize(outputWidth: number, outputHeight: number): OutputSizeOption {
  return (
    OUTPUT_SIZE_OPTIONS.find((option) => option.width === outputWidth && option.height === outputHeight) ||
    OUTPUT_SIZE_OPTIONS[1]
  );
}

export default function ImageCropDialog({
  file,
  title,
  onApply,
  onCancel,
  outputWidth = DEFAULT_OUTPUT_WIDTH,
  outputHeight = DEFAULT_OUTPUT_HEIGHT,
}: ImageCropDialogProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalRef = useModalFocusTrap<HTMLDivElement>();
  const [imageUrl, setImageUrl] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [mode, setMode] = useState<CropMode>('fit');
  const [outputSize, setOutputSize] = useState<OutputSizeOption>(() => getInitialOutputSize(outputWidth, outputHeight));
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const nextImageUrl = URL.createObjectURL(file);
    setImageUrl(nextImageUrl);
    setImageLoaded(false);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setMode('fit');
    setOutputSize(getInitialOutputSize(outputWidth, outputHeight));
    setBrightness(100);
    setContrast(100);
    setError('');

    return () => URL.revokeObjectURL(nextImageUrl);
  }, [file, outputHeight, outputWidth]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = previewCanvasRef.current;
    if (!imageLoaded || !image || !canvas) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      drawCroppedImage({ canvas, image, zoom, offsetX, offsetY, mode, brightness, contrast });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [imageLoaded, zoom, offsetX, offsetY, mode, brightness, contrast]);

  const previewHeight = Math.round((PREVIEW_WIDTH * outputSize.height) / outputSize.width);
  const zoomMin = mode === 'fill' ? 1 : 0.4;

  const handleApply = async () => {
    const image = imageRef.current;
    if (!imageLoaded || !image) {
      setError('Image is still loading.');
      return;
    }

    setIsApplying(true);
    setError('');
    try {
      const croppedFile = await createCroppedWebpFile({
        file,
        image,
        zoom,
        offsetX,
        offsetY,
        outputWidth: outputSize.width,
        outputHeight: outputSize.height,
        quality: outputSize.quality,
        mode,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={modalRef} tabIndex={-1} className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-600">Fit or crop this image to match the Coverage Dashboard card shape.</p>
          </div>
        </div>

        {error ? <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-5 overflow-hidden rounded-lg border border-gray-300 bg-gray-900">
          <canvas
            ref={previewCanvasRef}
            width={PREVIEW_WIDTH}
            height={previewHeight}
            className="block h-auto w-full"
          />
        </div>

        {imageUrl ? (
          <img
            ref={imageRef}
            src={imageUrl}
            alt=""
            className="hidden"
            onLoad={() => setImageLoaded(true)}
            onError={() => setError('Could not load the selected image.')}
          />
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Display Mode</p>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
              {(['fit', 'fill'] as CropMode[]).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => {
                    setMode(nextMode);
                    setZoom(1);
                    setOffsetX(0);
                    setOffsetY(0);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    mode === nextMode ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {nextMode === 'fit' ? 'Fit' : 'Fill'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Export Size</p>
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-gray-100 p-1">
              {OUTPUT_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setOutputSize(option)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    outputSize.key === option.key ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {outputSize.width} x {outputSize.height}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-gray-700">
            Zoom
            <input
              type="range"
              min={zoomMin}
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Horizontal Position
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={offsetX}
              onChange={(event) => setOffsetX(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Vertical Position
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={offsetY}
              onChange={(event) => setOffsetY(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
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
          <label className="block text-sm font-medium text-gray-700">
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
          <Button type="button" onClick={() => { setMode('fit'); setOutputSize(OUTPUT_SIZE_OPTIONS[1]); setZoom(1); setOffsetX(0); setOffsetY(0); setBrightness(100); setContrast(100); }} className="bg-gray-200 text-gray-800 hover:bg-gray-300">
            Reset
          </Button>
          <Button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 hover:bg-gray-300">
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