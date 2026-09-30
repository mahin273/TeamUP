import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

const ctx = (role?: string): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  }) as any;

describe('RolesGuard', () => {
  const make = (required?: string[]) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('AUTH-U1 allows when no roles are required', () => {
    expect(make(undefined).canActivate(ctx('STUDENT'))).toBe(true);
  });
  it('AUTH-U2 denies STUDENT on an ADMIN-only route', () => {
    expect(make(['ADMIN']).canActivate(ctx('STUDENT'))).toBe(false);
  });
  it('AUTH-U3 allows ADMIN on an ADMIN-only route', () => {
    expect(make(['ADMIN']).canActivate(ctx('ADMIN'))).toBe(true);
  });
  it('AUTH-U4 denies when there is no user', () => {
    expect(make(['ADMIN']).canActivate(ctx(undefined))).toBe(false);
  });
});
