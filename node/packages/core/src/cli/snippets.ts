import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HOST = 'https://api.example.test/hotels';

/** The three DOC-08 files. Each ends with one newline. Nothing is sent. */
export function snippetBytes(version: string, header = 'Api-Version'): { curl: string; fetch: string; java: string } {
  return {
    curl: `curl -H "${header}: ${version}" ${HOST}\n`,
    fetch: `await fetch("${HOST}", { headers: { "${header}": "${version}" } });\n`,
    java: `java.net.http.HttpRequest.newBuilder(java.net.URI.create("${HOST}")).header("${header}", "${version}").GET().build();\n`,
  };
}

/** Writes `snippets/<date>/` and returns those three paths. */
export function writeSnippets(root: string, version: string, header = 'Api-Version'): string[] {
  const dir = join(root, 'snippets', version);
  mkdirSync(dir, { recursive: true });
  const bytes = snippetBytes(version, header);
  const curl = join(dir, 'curl.txt');
  const fetchFile = join(dir, 'fetch.ts');
  const java = join(dir, 'Example.java');
  writeFileSync(curl, bytes.curl);
  writeFileSync(fetchFile, bytes.fetch);
  writeFileSync(java, bytes.java);
  return [curl, fetchFile, java];
}
