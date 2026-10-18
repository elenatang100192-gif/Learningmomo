// 七牛云上传：客户端直传 token（前端拿 token 后直传七牛，不走服务器流量）
// 配置：QINIU_URL / QINIU_BUCKET / QINIU_ACCESS_KEY / QINIU_SECRET_KEY
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as qiniu from 'qiniu';

@Injectable()
export class QiniuService {
  private readonly logger = new Logger(QiniuService.name);
  private readonly bucket: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly publicUrl: string;
  private readonly uploadHost: string;

  constructor(private readonly cfg: ConfigService) {
    this.bucket = this.cfg.get<string>('QINIU_BUCKET') || '';
    this.accessKey = this.cfg.get<string>('QINIU_ACCESS_KEY') || '';
    this.secretKey = this.cfg.get<string>('QINIU_SECRET_KEY') || '';
    this.publicUrl = (this.cfg.get<string>('QINIU_URL') || '').replace(/\/+$/, '');
    this.uploadHost = this.cfg.get<string>('QINIU_UPLOAD_HOST') || 'https://upload.qiniup.com';
    if (!this.bucket || !this.accessKey || !this.secretKey) {
      this.logger.warn(`Qiniu env incomplete: bucket=${!!this.bucket} ak=${!!this.accessKey} sk=${!!this.secretKey}`);
    } else {
      this.logger.log(`Qiniu ready: bucket=${this.bucket} host=${this.uploadHost}`);
    }
  }

  /**
   * 生成上传 token + 公开访问 URL
   * @param dir  存放在 bucket 下的目录前缀（不含文件名），如 'hongen/lesson-icon'
   * @param ext  扩展名，如 'png' / 'jpg' / 'webp'
   */
  issueUploadToken(dir: string, ext: string): {
    token: string;
    key: string;
    publicUrl: string;
    host: string;
  } {
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'png';
    const date = new Date();
    const ymd = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).slice(2, 10);
    const key = `${dir}/${ymd}/${Date.now()}_${rand}.${safeExt}`;

    const mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
    const options = {
      scope: this.bucket,
      expires: 60 * 10, // 10 分钟过期
      insertOnly: 1,
    };
    const putPolicy = new qiniu.rs.PutPolicy(options);
    const token = putPolicy.uploadToken(mac);

    const publicUrl = `${this.publicUrl}/${key}`;
    return { token, key, publicUrl, host: this.uploadHost };
  }
}
