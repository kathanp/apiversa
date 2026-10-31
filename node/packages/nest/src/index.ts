import 'reflect-metadata';
import { HttpException, Module, SetMetadata, type DynamicModule, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ApiversaError, type Apiversa } from 'apiversa';
import { of, throwError, type Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export type RouteDecl = { body?: string; response?: string };

const ROUTE = 'apiversa:route';

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  method: string;
  url?: string;
  path?: string;
  originalUrl?: string;
};

type HttpReply = {
  statusCode?: number;
  status?: (code: number) => unknown;
  code?: (code: number) => unknown;
  setHeader?: (name: string, value: string) => void;
  header?: (name: string, value: string) => void;
};

/**
 * Marks one Nest route for conversion. Routes without this decorator are untouched.
 * Nest URI versioning stays in place. The API version still comes from `Api-Version`.
 */
export function ApiversaRoute(decl: RouteDecl): MethodDecorator {
  return SetMetadata(ROUTE, decl);
}

/** Reads {@link ApiversaRoute} and runs the up and down plans. A head request is not rewritten. */
export class ApiversaInterceptor implements NestInterceptor {
  private readonly reflector = new Reflector();

  constructor(private readonly av: Apiversa) {}

  intercept(context: ExecutionContext, next: { handle(): Observable<unknown> }): Observable<unknown> {
    const decl = this.reflector.get<RouteDecl | undefined>(ROUTE, context.getHandler());
    if (!decl) return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<HttpRequest>();
    const res = http.getResponse<HttpReply>();
    let version: string;
    try {
      version = this.av.resolveVersion({ headers: req.headers, request: req });
    } catch (error) {
      if (error instanceof ApiversaError) return of(fail(res, error));
      throw error;
    }
    const raw = req.originalUrl ?? req.url ?? req.path ?? '/';
    const path = raw.split('?')[0] || '/';
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : undefined;
    if (decl.body !== undefined && req.body !== undefined && !this.av.planIsEmpty(version, decl.body, 'up')) {
      req.body = this.av.prepare('up', { schema: decl.body, body: req.body, version, method: req.method, path, query }).body;
    }
    if (decl.response === undefined) return next.handle();
    const schema = decl.response;
    const emptyDown = this.av.planIsEmpty(version, schema, 'down');
    return next.handle().pipe(
      map((body) => (emptyDown ? body : downgrade(this.av, res, schema, version, req.method, path, body, res.statusCode ?? 200))),
      catchError((error: unknown) => {
        if (!(error instanceof HttpException)) return throwError(() => error as Error);
        const status = error.getStatus();
        writeStatus(res, status);
        const payload = error.getResponse();
        const body = typeof payload === 'string' ? { message: payload } : payload;
        return of(downgrade(this.av, res, schema, version, req.method, path, body, status));
      }),
    );
  }
}

/** Registers the interceptor. Only decorated routes are converted. */
export class ApiversaModule {
  static forRoot(av: Apiversa): DynamicModule {
    return {
      module: ApiversaModule,
      providers: [
        { provide: ApiversaInterceptor, useValue: new ApiversaInterceptor(av) },
        { provide: APP_INTERCEPTOR, useExisting: ApiversaInterceptor },
      ],
    };
  }
}

Module({})(ApiversaModule);

function downgrade(av: Apiversa, res: HttpReply, schema: string, version: string, method: string, path: string, body: unknown, status: number): unknown {
  if (body === null || typeof body !== 'object') return body;
  const prepared = av.prepare('down', {
    schema,
    body,
    version,
    method,
    path,
    status,
    isError: status >= 400,
    errorCode: codeOf(body),
  });
  if (prepared.trace) setHeader(res, 'Apiversa-Trace', prepared.trace);
  return prepared.body;
}

function fail(res: HttpReply, error: ApiversaError): unknown {
  writeStatus(res, error.status ?? 500);
  for (const header of error.headers) setHeader(res, header.name, header.value);
  return error.envelope();
}

function writeStatus(res: HttpReply, status: number): void {
  if (typeof res.code === 'function') res.code(status);
  else if (typeof res.status === 'function') res.status(status);
  else res.statusCode = status;
}

function setHeader(res: HttpReply, name: string, value: string): void {
  if (typeof res.setHeader === 'function') res.setHeader(name, value);
  else if (typeof res.header === 'function') res.header(name, value);
}

function codeOf(body: object): string | undefined {
  if (!('code' in body)) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
