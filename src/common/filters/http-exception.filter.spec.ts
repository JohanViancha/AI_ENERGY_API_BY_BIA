import { ArgumentsHost, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function createHostMock() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);

  const request = { url: '/meters/M-001' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, response, request };
}

describe('HttpExceptionFilter', () => {
  it('formats a known HttpException preserving its status and message', () => {
    const filter = new HttpExceptionFilter();
    const { host, response, request } = createHostMock();

    filter.catch(new NotFoundException('Meter not found'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Meter not found',
        error: 'Not Found',
        path: request.url,
      }),
    );
  });

  it('never leaks the raw message of an uncontrolled error, returning a generic 500', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHostMock();

    filter.catch(new Error('leaked internal detail: password=1234'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
      }),
    );
    const [[body]] = response.json.mock.calls as unknown[][];
    expect(JSON.stringify(body)).not.toContain('leaked internal detail');
  });
});
