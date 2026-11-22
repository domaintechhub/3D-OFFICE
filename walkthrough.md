# Security Summary

**Reviewed Files**: 28
**Issues Resolved**: 8

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| IPv6 & Mapped-Address Filtering | `server.ts` | 43 | The remote webpage proxy only recognized dotted IPv4-mapped addresses, allowing bracketed or hex-normalized IPv6 forms (such as `[::ffff:7f00:1]` or `[::ffff:a9fe:a9fe]`), tunnel prefixes, and scoped addresses to bypass internal network checks. | High | Fixed | Replaced naive string matching with full 8-group IPv6 parsing (`parseIpv6Groups`) that extracts embedded IPv4 addresses and blocks loopback, unspecified, link-local, metadata, NAT64, Teredo, 6to4, ULA, and multicast ranges. |
| Hostname Normalization & Port Control | `server.ts` | 139 | URLs with trailing dots (`localhost.`) or non-standard ports (`:22`, `:6379`) could reach local services or probe non-web TCP ports. | High | Fixed | Stripped trailing dots and IPv6 brackets before hostname checks and restricted outbound proxy requests strictly to ports `80` and `443`. |
| DNS Rebinding Protection | `server.ts` | 187 | After validating a hostname's IP via DNS lookup, the proxy called `fetch()`, which performed a second unpinned DNS lookup that could switch to a private IP between check and connect. | High | Fixed | Replaced `fetch()` with `requestPinnedPublic` using Node `http`/`https` and a custom lookup callback pinned to the already-validated IP address while keeping TLS certificate and hostname checks intact. |
| Response Type & Error Sanitization | `server.ts` | 489 | The browse proxy accepted non-text response types and returned raw network error details. | Medium | Fixed | Added `isAllowedTextContentType` to reject non-HTML/JSON/XML/text responses with HTTP `415` and sanitized DNS/network error messages. |
| API Rate Limiting & HTTP Headers | `server.ts` | 463 | `/api/browse`, `/api/search`, and `/api/nairobi-live` had no request rate limits, and Express sent `X-Powered-By` without baseline security headers. | Medium | Fixed | Added bounded sliding-window rate limiters (`30/min` on proxy/search, `60/min` on live weather), disabled `x-powered-by`, enabled `trust proxy`, and set `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. |
| Global Engine Exposure | `src/scene/AtriumEngine.ts` | 414 | The 3D engine instance was attached to `window.__atrium`, exposing internal scene graph and simulation state to page scripts and browser DevTools. | Low | Fixed | Removed the `window.__atrium` global assignment. |
| Local 3D Model Upload Validation | `src/scene/characterAssets.ts` | 230 | Dragged-and-dropped `.glb`/`.gltf` files were read directly into memory and parsed without size or file-header checks, risking browser tab freezes on oversized or malformed files. | Medium | Fixed | Enforced `.glb`/`.gltf` extension checks, a 50 MB file size cap, and binary `glTF` magic / JSON `{` header checks before parsing. |
| Client URL, Search & Social Input Bounds | `src/components/WorkstationInspector.tsx` | 313 | Browser URL navigation, fallback search queries, and social feed task/post inputs lacked client-side scheme and length bounds. | Low | Fixed | Restricted `browseLiveUrl` to valid `http:`/`https:` URLs up to 2048 chars, capped search queries at 180 chars with safe entity decoding (`decodeTextEntities`), and bounded task/post field lengths in `src/scene/socialNetwork.ts`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Dependency Vulnerability Scan | `package.json` | Audited 228 installed packages with `bun audit`; zero known vulnerabilities reported. |
| HTML & Script Injection Defense | `src/components/WorkstationInspector.tsx` | All parsed webpage titles, descriptions, headings, paragraphs, and search snippets are rendered through React text nodes without raw HTML injection, and external navigation uses `<button>` actions rather than unvalidated anchor `href` attributes. |
| Redirect Hop Validation | `server.ts` | Every HTTP redirect (`301`/`302`/`307`/`308`, max 4 hops) re-runs full URL, port, hostname, and pinned IP checks before following the destination. |
| Secrets & API Key Hygiene | `server.ts` | No hardcoded credentials, database passwords, or private API tokens appear in client or server code. |
| Body Size & Prototype Safety | `server.ts` | JSON request parsing is capped at `64kb`, and remote proxy downloads stop at `1.5 MB` with an `8s` timeout. |

## PoC Verification

### Bypass of Internal Address Filtering via IPv6-Mapped IPv4 & Localhost Trailing Dot

#### Summary
| Field | Value |
|---|---|
| Issue Type | Remote URL & Network Address Filtering Bypass |
| Impact | High |
| Affected File | `server.ts:43-185` |
| Test Scenario | `GET /api/browse?url=http://[::ffff:127.0.0.1]/`, `GET /api/browse?url=http://[::ffff:a9fe:a9fe]/latest/meta-data/`, and `GET /api/browse?url=http://localhost./` |

#### How It Was Fixed
The URL validator now strips brackets and trailing dots from hostnames, enforces ports `80`/`443` only, parses IPv6 addresses into 8 numeric 16-bit groups to inspect embedded IPv4 addresses (covering both dotted and hex-normalized `::ffff:0:0/96` forms), and pins the validated IP address inside `requestPinnedPublic` so DNS cannot change mid-request.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Requests arrive at `/api/browse` in `server.ts:521` with `http://[::ffff:127.0.0.1]/`, `http://[::ffff:a9fe:a9fe]/latest/meta-data/`, `http://localhost./`, and `http://example.com:22/`. | Request enters `fetchPublicWithRedirects` (`server.ts:282`) |
| 2 | `assertSafePublicUrl` (`server.ts:125`) checks port `80`/`443` at line 139, trims trailing dots and brackets at lines 143–144, and catches `localhost.` at line 147. | `localhost.` and `:22` rejected with HTTP `400` |
| 3 | `net.isIP(host)` detects IPv6 for `::ffff:7f00:1` and `::ffff:a9fe:a9fe` at line 157 and calls `isPrivateOrUnsafeIp` (`server.ts:79`). `parseIpv6Groups` converts the groups and line 97 routes `::ffff:0:0/96` to `isPrivateIpv4`, matching `127.0.0.1` and `169.254.169.254`. | **Handled Safely** — HTTP `400` (`Direct private or loopback IP access is blocked.`) |

#### Conclusion
**Fix Verified** - IPv4-mapped IPv6 forms, trailing-dot local hostnames, non-web ports, and mid-flight DNS rebinding can no longer reach private network or cloud metadata addresses through `/api/browse`.

---

### Oversized or Spoofed Character Model File Upload

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unvalidated Local File Parsing |
| Impact | Medium |
| Affected File | `src/scene/characterAssets.ts:230-266` |
| Test Scenario | Dropping a renamed `.txt` file (`avatar.glb`) or an oversized `>50 MB` file into Character Studio's local model importer. |

#### How It Was Fixed
Added extension validation (`.glb` or `.gltf`), a 50 MB size ceiling, and header byte inspection (`glTF` binary magic `0x67 0x6C 0x54 0x46` for `.glb`, JSON `{` prefix for `.gltf`) before allocating/parsing the Three.js scene graph.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | A user drops or selects a file in Character Studio (`src/components/CharacterStudioModal.tsx:605`), calling `loadRiggedGlbFromFile`. | File enters `loadRiggedGlbFromFile` (`src/scene/characterAssets.ts:231`) |
| 2 | Lines 234–242 verify the `.glb`/`.gltf` extension and reject files outside `1 byte .. 50 MB`. | Oversized or wrong-extension files rejected |
| 3 | Lines 246–261 inspect the first 12 bytes for the binary `glTF` magic header or JSON `{` start before `GLTFLoader.parseAsync` runs at line 265. | **Handled Safely** — spoofed files throw a clean validation error before 3D parsing |

#### Conclusion
**Fix Verified** - Oversized or non-glTF files are rejected immediately before WebGL geometry and texture allocation begins.
