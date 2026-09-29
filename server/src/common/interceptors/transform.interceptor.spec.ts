import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap raw response data into standard envelope { success: true, data }', (done) => {
    const mockContext = {} as ExecutionContext;
    const mockCallHandler: CallHandler = {
      handle: () => of({ id: '123', name: 'Alice' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: { id: '123', name: 'Alice' },
          id: '123',
        });
        done();
      },
      error: done,
    });
  });

  it('should wrap null or undefined data into { success: true, data: null }', (done) => {
    const mockContext = {} as ExecutionContext;
    const mockCallHandler: CallHandler = {
      handle: () => of(null),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          data: null,
        });
        done();
      },
    });
  });

  it('should avoid double-wrapping if response is already an envelope', (done) => {
    const mockContext = {} as ExecutionContext;
    const alreadyWrapped = {
      success: true,
      data: { message: 'Already wrapped' },
    };
    const mockCallHandler: CallHandler = {
      handle: () => of(alreadyWrapped),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual(alreadyWrapped);
        done();
      },
    });
  });
});
