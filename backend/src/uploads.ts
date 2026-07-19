import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export const uploadsRoot = path.resolve(process.env.UPLOADS_ROOT || path.join(process.cwd(), 'uploads'));
const imageUploadDirectories: Record<string, string> = {
  Collection: path.join(uploadsRoot, 'collections'),
  Publisher: path.join(uploadsRoot, 'publishers'),
};

function ensureImageUploadDirectory(tableName: string): string {
  const directory = imageUploadDirectories[tableName];
  if (!directory) {
    throw new Error('Image uploads are not supported for this table.');
  }

  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function getSafeWebpFileName(originalName: string, tableName: string): string {
  const baseName = path.parse(originalName).name;
  const defaultBaseName = `${tableName.toLowerCase()}-image`;
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || defaultBaseName;
  return `${safeBaseName}-${Date.now()}-${crypto.randomUUID()}.webp`;
}

const imageUploadStorage = multer.diskStorage({
  destination(req, _file, callback) {
    try {
      callback(null, ensureImageUploadDirectory(req.params.tableName));
    } catch (error) {
      callback(error as Error, '');
    }
  },
  filename(req, file, callback) {
    callback(null, getSafeWebpFileName(file.originalname, req.params.tableName));
  },
});

const imageUpload = multer({
  storage: imageUploadStorage,
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

export function supportsImageUpload(tableName: string): boolean {
  return Object.prototype.hasOwnProperty.call(imageUploadDirectories, tableName);
}

export function uploadCollectionImageIfNeeded(req: Request, res: Response, next: NextFunction): void {
  if (!supportsImageUpload(req.params.tableName)) {
    next();
    return;
  }

  imageUpload(req, res, (error: unknown) => {
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