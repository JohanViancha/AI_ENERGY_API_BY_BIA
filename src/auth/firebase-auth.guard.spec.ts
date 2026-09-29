import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { FirebaseService } from '../firebase/firebase.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

function createContextMock(authorizationHeader?: string) {
  const request: {
    headers: Record<string, string | undefined>;
    user?: unknown;
  } = {
    headers: { authorization: authorizationHeader },
  };

  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext,
    request,
  };
}

describe('FirebaseAuthGuard', () => {
  it('allows the request and attaches the decoded token when the id token is valid', async () => {
    const decodedToken = { uid: 'user-1' };
    const verifyIdToken = jest.fn().mockResolvedValue(decodedToken);
    const firebaseService = {
      getAuth: () => ({ verifyIdToken }),
    } as unknown as FirebaseService;
    const guard = new FirebaseAuthGuard(firebaseService);
    const { context, request } = createContextMock('Bearer valid-token');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual(decodedToken);
  });

  it('throws 401 when the Authorization header is missing', async () => {
    const getAuth = jest.fn();
    const firebaseService = { getAuth } as unknown as FirebaseService;
    const guard = new FirebaseAuthGuard(firebaseService);
    const { context } = createContextMock(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(getAuth).not.toHaveBeenCalled();
  });

  it('throws 401 when the token is invalid or expired', async () => {
    const verifyIdToken = jest
      .fn()
      .mockRejectedValue(new Error('decoding error'));
    const firebaseService = {
      getAuth: () => ({ verifyIdToken }),
    } as unknown as FirebaseService;
    const guard = new FirebaseAuthGuard(firebaseService);
    const { context } = createContextMock('Bearer expired-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
