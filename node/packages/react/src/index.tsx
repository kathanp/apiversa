import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { createClient, type ApiClient } from '@apiversa/client';

const VersionContext = createContext<ApiClient | null>(null);

/** Provides the pinned client. This package does not send a request by itself. */
export function ApiVersionProvider(props: { client: ApiClient; children?: ReactNode }) {
  const value = useMemo(() => props.client, [props.client]);
  return createElement(VersionContext.Provider, { value }, props.children);
}

/** The client from {@link ApiVersionProvider}. Throws when the provider is missing. */
export function useApiVersion(): ApiClient {
  const client = useContext(VersionContext);
  if (!client) throw new Error('useApiVersion needs ApiVersionProvider.');
  return client;
}

/** A provider whose client sends `version` on every request. `fetch` is the host's. */
export function createApiVersion(options: { baseUrl: string; version: string; header?: string; fetch?: Parameters<typeof createClient>[0]['fetch'] }) {
  return createClient(options);
}
