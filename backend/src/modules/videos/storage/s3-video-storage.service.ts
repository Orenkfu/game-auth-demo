import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { VideoStorageService } from './video-storage.interface';
import type { PartUrl } from '../types';

@Injectable()
export class S3VideoStorageService implements VideoStorageService, OnModuleInit {
  private readonly logger = new Logger(S3VideoStorageService.name);
  private client!: S3Client;
  private presignClient!: S3Client;
  private bucket!: string;
  private urlExpiry!: number;
  private cdnDomain: string | undefined;

  constructor(private readonly config: ConfigService) { }

  onModuleInit() {
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT');
    const publicEndpoint = this.config.get<string>('STORAGE_PUBLIC_ENDPOINT') ?? endpoint;
    this.bucket = this.config.getOrThrow<string>('STORAGE_BUCKET');
    this.urlExpiry = Number(this.config.get('STORAGE_URL_EXPIRY_SECS')) || 3600;
    this.cdnDomain = this.config.get<string>('STORAGE_CDN_DOMAIN');

    const region = this.config.get<string>('STORAGE_REGION') ?? 'us-east-1';
    const credentials = {
      accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
    };

    this.client = new S3Client({
      region,
      ...(endpoint && { endpoint, forcePathStyle: true }),
      credentials,
    });

    // Pre-signed URLs must use the publicly-reachable endpoint (e.g. localhost:9000
    // instead of the Docker-internal minio:9000) so browsers can reach them.
    this.presignClient = publicEndpoint !== endpoint
      ? new S3Client({ region, endpoint: publicEndpoint, forcePathStyle: true, credentials })
      : this.client;

    this.logger.log(`Storage initialised — bucket: ${this.bucket}${endpoint ? ` (internal: ${endpoint}, public: ${publicEndpoint})` : ''}`);
  }

  async getSingleUploadUrl(key: string, mimeType: string): Promise<{ url: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    const url = await getSignedUrl(this.presignClient, command, { expiresIn: this.urlExpiry });
    return { url };
  }

  async initiateMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }> {
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
    );
    return { uploadId: response.UploadId! };
  }

  async getPartUploadUrls(key: string, uploadId: string, partNumbers: number[]): Promise<PartUrl[]> {
    const urls = await Promise.all(
      partNumbers.map(async (partNumber) => {
        const command = new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        });
        const url = await getSignedUrl(this.presignClient, command, { expiresIn: this.urlExpiry });
        return { partNumber, url };
      }),
    );
    return urls;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err: any) {
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async getDownloadUrl(key: string, expiresInSecs?: number): Promise<string> {
    if (this.cdnDomain) {
      return `${this.cdnDomain}/${key}`;
    }
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.presignClient, command, { expiresIn: expiresInSecs ?? this.urlExpiry });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
