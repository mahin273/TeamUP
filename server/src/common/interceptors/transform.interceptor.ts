import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Avoid double wrapping if already wrapped
        if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
          return data as ApiResponse<T>;
        }
        return {
          success: true,
          data: data ?? null,
        };
      }),
    );
  }
}
