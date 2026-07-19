import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export const uploadsRoot = path.resolve(process.env.UPLOADS_ROOT || path.join(process.cwd(), 'uploads'));
const collectionImagesDirectory = path.join(uploadsRoot, 'collections');

function ensureCollectionImagesDirectory(): void {
  fs.mkdirSync(collectionImagesDirectory, { recursive: true });
}

function getSafeWebpFileName(originalName: string): string {
  const baseName = path.parse(originalName).name;
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'collection-image';
  return `${safeBaseName}-${Date.now()}-${crypto.randomUUID()}.webp`;
}

const collectionImageStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    ensureCollectionImagesDirectory();
    callback(null, collectionImagesDirectory);
  },
  filename(_req, file, callback) {
    callback(null, getSafeWebpFileName(file.originalname));
  },
});

const collectionImageUpload = multer({
  storage: collectionImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const hasWebpType = !file.mimetype || file.mimetype === 'image/webp';

    if (extension === '.webp' && hasWebpType) {
      callback(null, true);
      return;
    }

    callback(new Error('Image File Name must be a .webp file.'));
  },
}).single('ImageFile');

export function uploadCollectionImageIfNeeded(req: Request, res: Response, next: NextFunction): void {
  if (req.params.tableName !== 'Collection') {
    next();
    return;
  }

  collectionImageUpload(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Image File Name must be a .webp file no larger than 10 MB.' });
      return;
    }

    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid image upload.' });
  });
}

export async function deleteUploadedFile(file?: Express.Multer.File): Promise<void> {
  if (!file?.path) {
    return;
  }

  try {
    await fs.promises.unlink(file.path);
  } catch {
    // Best-effort cleanup only.
  }
}