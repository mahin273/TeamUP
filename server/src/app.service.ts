import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'TeamUp API',
      timestamp: new Date().toISOString(),
    };
  }
}
