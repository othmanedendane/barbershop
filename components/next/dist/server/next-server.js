"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = void 0;
require("./initialize-require-hook");
require("./node-polyfill-fetch");
require("./node-polyfill-web-streams");
var _utils = require("../shared/lib/utils");
var _routeMatcher = require("../shared/lib/router/utils/route-matcher");
var _fs = _interopRequireDefault(require("fs"));
var _path = require("path");
var _http = require("http");
var _requestMeta = require("./request-meta");
var _constants = require("../shared/lib/constants");
var _recursiveReaddirSync = require("./lib/recursive-readdir-sync");
var _findPagesDir = require("../lib/find-pages-dir");
var _url = require("url");
var _pathMatch = require("../shared/lib/router/utils/path-match");
var _serverRouteUtils = require("./server-route-utils");
var _getRouteFromAssetPath = _interopRequireDefault(require("../shared/lib/router/utils/get-route-from-asset-path"));
var _node = require("./base-http/node");
var _sendPayload = require("./send-payload");
var _serveStatic = require("./serve-static");
var _node1 = require("./api-utils/node");
var _render = require("./render");
var _parseUrl = require("../shared/lib/router/utils/parse-url");
var Log = _interopRequireWildcard(require("../build/output/log"));
var _baseServer = _interopRequireWildcard(require("./base-server"));
Object.keys(_baseServer).forEach(function(key) {
    if (key === "default" || key === "__esModule") return;
    if (key in exports && exports[key] === _baseServer[key]) return;
    Object.defineProperty(exports, key, {
        enumerable: true,
        get: function() {
            return _baseServer[key];
        }
    });
});
var _require = require("./require");
var _denormalizePagePath = require("../shared/lib/page-path/denormalize-page-path");
var _normalizePagePath = require("../shared/lib/page-path/normalize-page-path");
var _loadComponents = require("./load-components");
var _isError = _interopRequireWildcard(require("../lib/is-error"));
var _utils1 = require("./web/utils");
var _relativizeUrl = require("../shared/lib/router/utils/relativize-url");
var _prepareDestination = require("../shared/lib/router/utils/prepare-destination");
var _middlewareRouteMatcher = require("../shared/lib/router/utils/middleware-route-matcher");
var _env = require("@next/env");
var _querystring = require("../shared/lib/router/utils/querystring");
var _removeTrailingSlash = require("../shared/lib/router/utils/remove-trailing-slash");
var _getNextPathnameInfo = require("../shared/lib/router/utils/get-next-pathname-info");
var _bodyStreams = require("./body-streams");
var _apiUtils = require("./api-utils");
var _responseCache = _interopRequireDefault(require("./response-cache"));
var _incrementalCache = require("./lib/incremental-cache");
var _appPaths = require("../shared/lib/router/utils/app-paths");
var _appRender = require("./app-render/app-render");
var _config = require("./config");
var _routeKind = require("./future/route-kind");
var _constants1 = require("../lib/constants");
var _tracer = require("./lib/trace/tracer");
var _constants2 = require("./lib/trace/constants");
var _nodeFsMethods = require("./lib/node-fs-methods");
var _routeRegex = require("../shared/lib/router/utils/route-regex");
var _removePathPrefix = require("../shared/lib/router/utils/remove-path-prefix");
var _addPathPrefix = require("../shared/lib/router/utils/add-path-prefix");
var _pathHasPrefix = require("../shared/lib/router/utils/path-has-prefix");
var _serverIpc = require("./lib/server-ipc");
class NextNodeServer extends _baseServer.default {
    constructor(options){
        // Initialize super class
        super(options);
        /**
     * This sets environment variable to be used at the time of SSR by head.tsx.
     * Using this from process.env allows targeting SSR by calling
     * `process.env.__NEXT_OPTIMIZE_CSS`.
     */ if (this.renderOpts.optimizeFonts) {
            process.env.__NEXT_OPTIMIZE_FONTS = JSON.stringify(this.renderOpts.optimizeFonts);
        }
        if (this.renderOpts.optimizeCss) {
            process.env.__NEXT_OPTIMIZE_CSS = JSON.stringify(true);
        }
        if (this.renderOpts.nextScriptWorkers) {
            process.env.__NEXT_SCRIPT_WORKERS = JSON.stringify(true);
        }
        if (this.nextConfig.compress) {
            this.compression = require("next/dist/compiled/compression")();
        }
        if (!this.minimalMode) {
            this.imageResponseCache = new _responseCache.default(this.minimalMode);
        }
        if (!options.dev) {
            // pre-warm _document and _app as these will be
            // needed for most requests
            (0, _loadComponents).loadComponents({
                distDir: this.distDir,
                pathname: "/_document",
                hasServerComponents: false,
                isAppPath: false
            }).catch(()=>{});
            (0, _loadComponents).loadComponents({
                distDir: this.distDir,
                pathname: "/_app",
                hasServerComponents: false,
                isAppPath: false
            }).catch(()=>{});
        }
        if (this.isRouterWorker) {
            this.renderWorkers = {};
            this.renderWorkerOpts = {
                port: this.port || 0,
                dir: this.dir,
                workerType: "render",
                hostname: this.hostname,
                dev: !!options.dev
            };
            const { createWorker , createIpcServer  } = require("./lib/server-ipc");
            this.renderWorkersPromises = new Promise(async (resolveWorkers)=>{
                try {
                    this.renderWorkers = {};
                    const { ipcPort  } = await createIpcServer(this);
                    if (this.hasAppDir) {
                        this.renderWorkers.app = createWorker(this.port || 0, ipcPort, options.isNodeDebugging, "app");
                    }
                    this.renderWorkers.pages = createWorker(this.port || 0, ipcPort, options.isNodeDebugging, "pages");
                    this.renderWorkers.middleware = this.renderWorkers.pages || this.renderWorkers.app;
                    resolveWorkers();
                } catch (err) {
                    Log.error(`Invariant failed to initialize render workers`);
                    console.error(err);
                    process.exit(1);
                }
            });
            global._nextDeleteCache = (filePath)=>{
                try {
                    var ref, ref1, ref2, ref3;
                    (ref = this.renderWorkers) == null ? void 0 : (ref1 = ref.pages) == null ? void 0 : ref1.deleteCache(filePath);
                    (ref2 = this.renderWorkers) == null ? void 0 : (ref3 = ref2.app) == null ? void 0 : ref3.deleteCache(filePath);
                } catch (err) {
                    console.error(err);
                }
            };
            global._nextDeleteAppClientCache = ()=>{
                try {
                    var ref, ref4, ref5, ref6;
                    (ref = this.renderWorkers) == null ? void 0 : (ref4 = ref.pages) == null ? void 0 : ref4.deleteAppClientCache();
                    (ref5 = this.renderWorkers) == null ? void 0 : (ref6 = ref5.app) == null ? void 0 : ref6.deleteAppClientCache();
                } catch (err) {
                    console.error(err);
                }
            };
            global._nextClearModuleContext = (targetPath, content)=>{
                try {
                    var ref, ref7, ref8, ref9;
                    (ref = this.renderWorkers) == null ? void 0 : (ref7 = ref.pages) == null ? void 0 : ref7.clearModuleContext(targetPath, content);
                    (ref8 = this.renderWorkers) == null ? void 0 : (ref9 = ref8.app) == null ? void 0 : ref9.clearModuleContext(targetPath, content);
                } catch (err) {
                    console.error(err);
                }
            };
        }
        // expose AsyncLocalStorage on global for react usage
        const { AsyncLocalStorage  } = require("async_hooks");
        globalThis.AsyncLocalStorage = AsyncLocalStorage;
        // ensure options are set when loadConfig isn't called
        (0, _config).setHttpClientAndAgentOptions(this.nextConfig);
    }
    async prepareImpl() {
        await super.prepareImpl();
        if (!this.serverOptions.dev && this.nextConfig.experimental.instrumentationHook) {
            try {
                const instrumentationHook = await require((0, _path).join(this.serverOptions.dir || ".", this.serverOptions.conf.distDir, "server", _constants1.INSTRUMENTATION_HOOK_FILENAME));
                instrumentationHook.register == null ? void 0 : instrumentationHook.register();
            } catch (err) {
                if (err.code !== "MODULE_NOT_FOUND") {
                    err.message = `An error occurred while loading instrumentation hook: ${err.message}`;
                    throw err;
                }
            }
        }
    }
    loadEnvConfig({ dev , forceReload , silent  }) {
        (0, _env).loadEnvConfig(this.dir, dev, silent ? {
            info: ()=>{},
            error: ()=>{}
        } : Log, forceReload);
    }
    getIncrementalCache({ requestHeaders  }) {
        const dev = !!this.renderOpts.dev;
        let CacheHandler;
        const { incrementalCacheHandlerPath  } = this.nextConfig.experimental;
        if (incrementalCacheHandlerPath) {
            CacheHandler = require(this.minimalMode ? (0, _path).join(this.distDir, incrementalCacheHandlerPath) : incrementalCacheHandlerPath);
            CacheHandler = CacheHandler.default || CacheHandler;
        }
        // incremental-cache is request specific with a shared
        // although can have shared caches in module scope
        // per-cache handler
        return new _incrementalCache.IncrementalCache({
            fs: this.getCacheFilesystem(),
            dev,
            requestHeaders,
            appDir: this.hasAppDir,
            minimalMode: this.minimalMode,
            serverDistDir: this.serverDistDir,
            fetchCache: this.nextConfig.experimental.appDir,
            fetchCacheKeyPrefix: this.nextConfig.experimental.fetchCacheKeyPrefix,
            maxMemoryCacheSize: this.nextConfig.experimental.isrMemoryCacheSize,
            flushToDisk: !this.minimalMode && this.nextConfig.experimental.isrFlushToDisk,
            getPrerenderManifest: ()=>{
                if (dev) {
                    return {
                        version: -1,
                        routes: {},
                        dynamicRoutes: {},
                        notFoundRoutes: [],
                        preview: null
                    };
                } else {
                    return this.getPrerenderManifest();
                }
            },
            CurCacheHandler: CacheHandler
        });
    }
    getResponseCache() {
        return new _responseCache.default(this.minimalMode);
    }
    getPublicDir() {
        return (0, _path).join(this.dir, _constants.CLIENT_PUBLIC_FILES_PATH);
    }
    getHasStaticDir() {
        return _fs.default.existsSync((0, _path).join(this.dir, "static"));
    }
    getPagesManifest() {
        return require((0, _path).join(this.serverDistDir, _constants.PAGES_MANIFEST));
    }
    getAppPathsManifest() {
        if (!this.hasAppDir) return undefined;
        const appPathsManifestPath = (0, _path).join(this.serverDistDir, _constants.APP_PATHS_MANIFEST);
        return require(appPathsManifestPath);
    }
    async hasPage(pathname) {
        var ref;
        return !!(0, _require).getMaybePagePath(pathname, this.distDir, (ref = this.nextConfig.i18n) == null ? void 0 : ref.locales, this.hasAppDir);
    }
    getBuildId() {
        const buildIdFile = (0, _path).join(this.distDir, _constants.BUILD_ID_FILE);
        try {
            return _fs.default.readFileSync(buildIdFile, "utf8").trim();
        } catch (err) {
            if (!_fs.default.existsSync(buildIdFile)) {
                throw new Error(`Could not find a production build in the '${this.distDir}' directory. Try building your app with 'next build' before starting the production server. https://nextjs.org/docs/messages/production-start-no-build-id`);
            }
            throw err;
        }
    }
    getCustomRoutes() {
        const customRoutes = this.getRoutesManifest();
        let rewrites;
        // rewrites can be stored as an array when an array is
        // returned in next.config.js so massage them into
        // the expected object format
        if (Array.isArray(customRoutes.rewrites)) {
            rewrites = {
                beforeFiles: [],
                afterFiles: customRoutes.rewrites,
                fallback: []
            };
        } else {
            rewrites = customRoutes.rewrites;
        }
        return Object.assign(customRoutes, {
            rewrites
        });
    }
    generateImageRoutes() {
        return [
            {
                match: (0, _pathMatch).getPathMatch("/_next/image"),
                type: "route",
                name: "_next/image catchall",
                fn: async (req, res, _params, parsedUrl)=>{
                    if (this.minimalMode || this.nextConfig.output === "export") {
                        res.statusCode = 400;
                        res.body("Bad Request").send();
                        return {
                            finished: true
                        };
                    }
                    const { ImageOptimizerCache  } = require("./image-optimizer");
                    const imageOptimizerCache = new ImageOptimizerCache({
                        distDir: this.distDir,
                        nextConfig: this.nextConfig
                    });
                    const { getHash , sendResponse , ImageError  } = require("./image-optimizer");
                    if (!this.imageResponseCache) {
                        throw new Error("invariant image optimizer cache was not initialized");
                    }
                    const imagesConfig = this.nextConfig.images;
                    if (imagesConfig.loader !== "default" || imagesConfig.unoptimized) {
                        await this.render404(req, res);
                        return {
                            finished: true
                        };
                    }
                    const paramsResult = ImageOptimizerCache.validateParams(req.originalRequest, parsedUrl.query, this.nextConfig, !!this.renderOpts.dev);
                    if ("errorMessage" in paramsResult) {
                        res.statusCode = 400;
                        res.body(paramsResult.errorMessage).send();
                        return {
                            finished: true
                        };
                    }
                    const cacheKey = ImageOptimizerCache.getCacheKey(paramsResult);
                    try {
                        var ref;
                        const cacheEntry = await this.imageResponseCache.get(cacheKey, async ()=>{
                            const { buffer , contentType , maxAge  } = await this.imageOptimizer(req, res, paramsResult);
                            const etag = getHash([
                                buffer
                            ]);
                            return {
                                value: {
                                    kind: "IMAGE",
                                    buffer,
                                    etag,
                                    extension: (0, _serveStatic).getExtension(contentType)
                                },
                                revalidate: maxAge
                            };
                        }, {
                            incrementalCache: imageOptimizerCache
                        });
                        if ((cacheEntry == null ? void 0 : (ref = cacheEntry.value) == null ? void 0 : ref.kind) !== "IMAGE") {
                            throw new Error("invariant did not get entry from image response cache");
                        }
                        sendResponse(req.originalRequest, res.originalResponse, paramsResult.href, cacheEntry.value.extension, cacheEntry.value.buffer, paramsResult.isStatic, cacheEntry.isMiss ? "MISS" : cacheEntry.isStale ? "STALE" : "HIT", imagesConfig, cacheEntry.revalidate || 0, Boolean(this.renderOpts.dev));
                    } catch (err) {
                        if (err instanceof ImageError) {
                            res.statusCode = err.statusCode;
                            res.body(err.message).send();
                            return {
                                finished: true
                            };
                        }
                        throw err;
                    }
                    return {
                        finished: true
                    };
                }
            }, 
        ];
    }
    getHasAppDir(dev) {
        return Boolean((0, _findPagesDir).findDir(dev ? this.dir : this.serverDistDir, "app"));
    }
    generateStaticRoutes() {
        return this.hasStaticDir ? [
            {
                // It's very important to keep this route's param optional.
                // (but it should support as many params as needed, separated by '/')
                // Otherwise this will lead to a pretty simple DOS attack.
                // See more: https://github.com/vercel/next.js/issues/2617
                match: (0, _pathMatch).getPathMatch("/static/:path*"),
                name: "static catchall",
                fn: async (req, res, params, parsedUrl)=>{
                    const p = (0, _path).join(this.dir, "static", ...params.path);
                    await this.serveStatic(req, res, p, parsedUrl);
                    return {
                        finished: true
                    };
                }
            }, 
        ] : [];
    }
    setImmutableAssetCacheControl(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    generateFsStaticRoutes() {
        return [
            {
                match: (0, _pathMatch).getPathMatch("/_next/static/:path*"),
                type: "route",
                name: "_next/static catchall",
                fn: async (req, res, params, parsedUrl)=>{
                    // make sure to 404 for /_next/static itself
                    if (!params.path) {
                        await this.render404(req, res, parsedUrl);
                        return {
                            finished: true
                        };
                    }
                    if (params.path[0] === _constants.CLIENT_STATIC_FILES_RUNTIME || params.path[0] === "chunks" || params.path[0] === "css" || params.path[0] === "image" || params.path[0] === "media" || params.path[0] === this.buildId || params.path[0] === "pages" || params.path[1] === "pages") {
                        this.setImmutableAssetCacheControl(res);
                    }
                    const p = (0, _path).join(this.distDir, _constants.CLIENT_STATIC_FILES_PATH, ...params.path || []);
                    await this.serveStatic(req, res, p, parsedUrl);
                    return {
                        finished: true
                    };
                }
            }, 
        ];
    }
    generatePublicRoutes() {
        if (!_fs.default.existsSync(this.publicDir)) return [];
        const publicFiles = new Set((0, _recursiveReaddirSync).recursiveReadDirSync(this.publicDir).map((p)=>encodeURI(p.replace(/\\/g, "/"))));
        return [
            {
                match: (0, _pathMatch).getPathMatch("/:path*"),
                matchesBasePath: true,
                name: "public folder catchall",
                fn: async (req, res, params, parsedUrl)=>{
                    const pathParts = params.path || [];
                    const { basePath  } = this.nextConfig;
                    // if basePath is defined require it be present
                    if (basePath) {
                        const basePathParts = basePath.split("/");
                        // remove first empty value
                        basePathParts.shift();
                        if (!basePathParts.every((part, idx)=>{
                            return part === pathParts[idx];
                        })) {
                            return {
                                finished: false
                            };
                        }
                        pathParts.splice(0, basePathParts.length);
                    }
                    let path = `/${pathParts.join("/")}`;
                    if (!publicFiles.has(path)) {
                        // In `next-dev-server.ts`, we ensure encoded paths match
                        // decoded paths on the filesystem. So we need do the
                        // opposite here: make sure decoded paths match encoded.
                        path = encodeURI(path);
                    }
                    if (publicFiles.has(path)) {
                        await this.serveStatic(req, res, (0, _path).join(this.publicDir, ...pathParts), parsedUrl);
                        return {
                            finished: true
                        };
                    }
                    return {
                        finished: false
                    };
                }
            }, 
        ];
    }
    _validFilesystemPathSet = null;
    getFilesystemPaths() {
        if (this._validFilesystemPathSet) {
            return this._validFilesystemPathSet;
        }
        const pathUserFilesStatic = (0, _path).join(this.dir, "static");
        let userFilesStatic = [];
        if (this.hasStaticDir && _fs.default.existsSync(pathUserFilesStatic)) {
            userFilesStatic = (0, _recursiveReaddirSync).recursiveReadDirSync(pathUserFilesStatic).map((f)=>(0, _path).join(".", "static", f));
        }
        let userFilesPublic = [];
        if (this.publicDir && _fs.default.existsSync(this.publicDir)) {
            userFilesPublic = (0, _recursiveReaddirSync).recursiveReadDirSync(this.publicDir).map((f)=>(0, _path).join(".", "public", f));
        }
        let nextFilesStatic = [];
        nextFilesStatic = !this.minimalMode && _fs.default.existsSync((0, _path).join(this.distDir, "static")) ? (0, _recursiveReaddirSync).recursiveReadDirSync((0, _path).join(this.distDir, "static")).map((f)=>(0, _path).join(".", (0, _path).relative(this.dir, this.distDir), "static", f)) : [];
        return this._validFilesystemPathSet = new Set([
            ...nextFilesStatic,
            ...userFilesPublic,
            ...userFilesStatic, 
        ]);
    }
    sendRenderResult(req, res, options) {
        return (0, _sendPayload).sendRenderResult({
            req: req.originalRequest,
            res: res.originalResponse,
            ...options
        });
    }
    sendStatic(req, res, path) {
        return (0, _serveStatic).serveStatic(req.originalRequest, res.originalResponse, path);
    }
    handleCompression(req, res) {
        if (this.compression) {
            this.compression(req.originalRequest, res.originalResponse, ()=>{});
        }
    }
    async handleUpgrade(req, socket, head) {
        await this.router.execute(req, socket, (0, _url).parse(req.url, true), head);
    }
    async proxyRequest(req, res, parsedUrl, upgradeHead) {
        const { query  } = parsedUrl;
        delete parsedUrl.query;
        parsedUrl.search = (0, _serverRouteUtils).stringifyQuery(req, query);
        const target = (0, _url).format(parsedUrl);
        const HttpProxy = require("next/dist/compiled/http-proxy");
        const proxy = new HttpProxy({
            target,
            changeOrigin: true,
            ignorePath: true,
            xfwd: true,
            ws: true,
            // we limit proxy requests to 30s by default, in development
            // we don't time out WebSocket requests to allow proxying
            proxyTimeout: upgradeHead && this.renderOpts.dev ? undefined : this.nextConfig.experimental.proxyTimeout || 30000
        });
        await new Promise((proxyResolve, proxyReject)=>{
            let finished = false;
            proxy.on("error", (err)=>{
                console.error(`Failed to proxy ${target}`, err);
                if (!finished) {
                    finished = true;
                    proxyReject(err);
                }
            });
            // if upgrade head is present treat as WebSocket request
            if (upgradeHead) {
                proxy.on("proxyReqWs", (proxyReq)=>{
                    proxyReq.on("close", ()=>{
                        if (!finished) {
                            finished = true;
                            proxyResolve(true);
                        }
                    });
                });
                proxy.ws(req, res, upgradeHead);
                proxyResolve(true);
            } else {
                proxy.on("proxyReq", (proxyReq)=>{
                    proxyReq.on("close", ()=>{
                        if (!finished) {
                            finished = true;
                            proxyResolve(true);
                        }
                    });
                });
                proxy.web(req.originalRequest, res.originalResponse);
            }
        });
        return {
            finished: true
        };
    }
    async runApi(req, res, query, params, page, builtPagePath) {
        const edgeFunctionsPages = this.getEdgeFunctionsPages();
        for (const edgeFunctionsPage of edgeFunctionsPages){
            if (edgeFunctionsPage === page) {
                const handledAsEdgeFunction = await this.runEdgeFunction({
                    req,
                    res,
                    query,
                    params,
                    page,
                    appPaths: null
                });
                if (handledAsEdgeFunction) {
                    return true;
                }
            }
        }
        const pageModule = await require(builtPagePath);
        query = {
            ...query,
            ...params
        };
        delete query.__nextLocale;
        delete query.__nextDefaultLocale;
        delete query.__nextInferredLocaleFromDefault;
        await (0, _node1).apiResolver(req.originalRequest, res.originalResponse, query, pageModule, {
            ...this.renderOpts.previewProps,
            revalidate: (newReq, newRes)=>this.getRequestHandler()(new _node.NodeNextRequest(newReq), new _node.NodeNextResponse(newRes)),
            // internal config so is not typed
            trustHostHeader: this.nextConfig.experimental.trustHostHeader,
            allowedRevalidateHeaderKeys: this.nextConfig.experimental.allowedRevalidateHeaderKeys
        }, this.minimalMode, this.renderOpts.dev, page);
        return true;
    }
    async renderHTML(req, res, pathname, query, renderOpts) {
        return (0, _tracer).getTracer().trace(_constants2.NextNodeServerSpan.renderHTML, async ()=>this.renderHTMLImpl(req, res, pathname, query, renderOpts));
    }
    async renderHTMLImpl(req, res, pathname, query, renderOpts) {
        // Due to the way we pass data by mutating `renderOpts`, we can't extend the
        // object here but only updating its `clientReferenceManifest` field.
        // https://github.com/vercel/next.js/blob/df7cbd904c3bd85f399d1ce90680c0ecf92d2752/packages/next/server/render.tsx#L947-L952
        renderOpts.clientReferenceManifest = this.clientReferenceManifest;
        renderOpts.serverCSSManifest = this.serverCSSManifest;
        renderOpts.nextFontManifest = this.nextFontManifest;
        if (this.hasAppDir && renderOpts.isAppPath) {
            return (0, _appRender).renderToHTMLOrFlight(req.originalRequest, res.originalResponse, pathname, query, renderOpts);
        }
        return (0, _render).renderToHTML(req.originalRequest, res.originalResponse, pathname, query, renderOpts);
    }
    streamResponseChunk(res, chunk) {
        res.originalResponse.write(chunk);
        // When both compression and streaming are enabled, we need to explicitly
        // flush the response to avoid it being buffered by gzip.
        if (this.compression && "flush" in res.originalResponse) {
            res.originalResponse.flush();
        }
    }
    async imageOptimizer(req, res, paramsResult) {
        const { imageOptimizer  } = require("./image-optimizer");
        return imageOptimizer(req.originalRequest, res.originalResponse, paramsResult, this.nextConfig, this.renderOpts.dev, (newReq, newRes, newParsedUrl)=>this.getRequestHandler()(new _node.NodeNextRequest(newReq), new _node.NodeNextResponse(newRes), newParsedUrl));
    }
    getPagePath(pathname, locales) {
        return (0, _require).getPagePath(pathname, this.distDir, locales, this.hasAppDir);
    }
    async renderPageComponent(ctx, bubbleNoFallback) {
        const edgeFunctionsPages = this.getEdgeFunctionsPages() || [];
        if (edgeFunctionsPages.length) {
            const appPaths = this.getOriginalAppPaths(ctx.pathname);
            const isAppPath = Array.isArray(appPaths);
            let page = ctx.pathname;
            if (isAppPath) {
                // When it's an array, we need to pass all parallel routes to the loader.
                page = appPaths[0];
            }
            for (const edgeFunctionsPage of edgeFunctionsPages){
                if (edgeFunctionsPage === page) {
                    await this.runEdgeFunction({
                        req: ctx.req,
                        res: ctx.res,
                        query: ctx.query,
                        params: ctx.renderOpts.params,
                        page,
                        appPaths
                    });
                    return null;
                }
            }
        }
        return super.renderPageComponent(ctx, bubbleNoFallback);
    }
    async findPageComponents({ pathname , query , params , isAppPath  }) {
        let route = pathname;
        if (isAppPath) {
            // When in App we get page instead of route
            route = pathname.replace(/\/[^/]*$/, "");
        }
        return (0, _tracer).getTracer().trace(_constants2.NextNodeServerSpan.findPageComponents, {
            spanName: `resolving page into components`,
            attributes: {
                "next.route": route
            }
        }, ()=>this.findPageComponentsImpl({
                pathname,
                query,
                params,
                isAppPath
            }));
    }
    async findPageComponentsImpl({ pathname , query , params , isAppPath  }) {
        const paths = [
            pathname
        ];
        if (query.amp) {
            // try serving a static AMP version first
            paths.unshift((isAppPath ? (0, _appPaths).normalizeAppPath(pathname) : (0, _normalizePagePath).normalizePagePath(pathname)) + ".amp");
        }
        if (query.__nextLocale) {
            paths.unshift(...paths.map((path)=>`/${query.__nextLocale}${path === "/" ? "" : path}`));
        }
        for (const pagePath of paths){
            try {
                const components = await (0, _loadComponents).loadComponents({
                    distDir: this.distDir,
                    pathname: pagePath,
                    hasServerComponents: !!this.renderOpts.serverComponents,
                    isAppPath
                });
                if (query.__nextLocale && typeof components.Component === "string" && !pagePath.startsWith(`/${query.__nextLocale}`)) {
                    continue;
                }
                return {
                    components,
                    query: {
                        ...components.getStaticProps ? {
                            amp: query.amp,
                            __nextDataReq: query.__nextDataReq,
                            __nextLocale: query.__nextLocale,
                            __nextDefaultLocale: query.__nextDefaultLocale
                        } : query,
                        // For appDir params is excluded.
                        ...(isAppPath ? {} : params) || {}
                    }
                };
            } catch (err) {
                // we should only not throw if we failed to find the page
                // in the pages-manifest
                if (!(err instanceof _utils.PageNotFoundError)) {
                    throw err;
                }
            }
        }
        return null;
    }
    getFontManifest() {
        return (0, _require).requireFontManifest(this.distDir);
    }
    getServerComponentManifest() {
        if (!this.hasAppDir) return undefined;
        return require((0, _path).join(this.distDir, "server", _constants.CLIENT_REFERENCE_MANIFEST + ".json"));
    }
    getServerCSSManifest() {
        if (!this.hasAppDir) return undefined;
        return require((0, _path).join(this.distDir, "server", _constants.FLIGHT_SERVER_CSS_MANIFEST + ".json"));
    }
    getNextFontManifest() {
        return require((0, _path).join(this.distDir, "server", `${_constants.NEXT_FONT_MANIFEST}.json`));
    }
    getFallback(page) {
        page = (0, _normalizePagePath).normalizePagePath(page);
        const cacheFs = this.getCacheFilesystem();
        return cacheFs.readFile((0, _path).join(this.serverDistDir, "pages", `${page}.html`));
    }
    generateRoutes(dev) {
        const publicRoutes = this.generatePublicRoutes();
        const imageRoutes = this.generateImageRoutes();
        const staticFilesRoutes = this.generateStaticRoutes();
        if (!dev) {
            const routesManifest = this.getRoutesManifest();
            this.dynamicRoutes = routesManifest.dynamicRoutes.map((r)=>{
                const regex = (0, _routeRegex).getRouteRegex(r.page);
                const match = (0, _routeMatcher).getRouteMatcher(regex);
                return {
                    match,
                    page: r.page,
                    regex: regex.re
                };
            });
        }
        const fsRoutes = [
            ...this.generateFsStaticRoutes(),
            {
                match: (0, _pathMatch).getPathMatch("/_next/data/:path*"),
                type: "route",
                name: "_next/data catchall",
                check: true,
                fn: async (req, res, params, _parsedUrl)=>{
                    const isNextDataNormalizing = (0, _requestMeta).getRequestMeta(req, "_nextDataNormalizing");
                    // Make sure to 404 for /_next/data/ itself and
                    // we also want to 404 if the buildId isn't correct
                    if (!params.path || params.path[0] !== this.buildId) {
                        if (isNextDataNormalizing) {
                            return {
                                finished: false
                            };
                        }
                        await this.render404(req, res, _parsedUrl);
                        return {
                            finished: true
                        };
                    }
                    // remove buildId from URL
                    params.path.shift();
                    const lastParam = params.path[params.path.length - 1];
                    // show 404 if it doesn't end with .json
                    if (typeof lastParam !== "string" || !lastParam.endsWith(".json")) {
                        await this.render404(req, res, _parsedUrl);
                        return {
                            finished: true
                        };
                    }
                    // re-create page's pathname
                    let pathname = `/${params.path.join("/")}`;
                    pathname = (0, _getRouteFromAssetPath).default(pathname, ".json");
                    // ensure trailing slash is normalized per config
                    if (this.router.hasMiddleware) {
                        if (this.nextConfig.trailingSlash && !pathname.endsWith("/")) {
                            pathname += "/";
                        }
                        if (!this.nextConfig.trailingSlash && pathname.length > 1 && pathname.endsWith("/")) {
                            pathname = pathname.substring(0, pathname.length - 1);
                        }
                    }
                    if (this.i18nProvider) {
                        var ref;
                        // Remove the port from the hostname if present.
                        const hostname = (ref = req == null ? void 0 : req.headers.host) == null ? void 0 : ref.split(":")[0].toLowerCase();
                        const domainLocale = this.i18nProvider.detectDomainLocale(hostname);
                        const defaultLocale = (domainLocale == null ? void 0 : domainLocale.defaultLocale) ?? this.i18nProvider.config.defaultLocale;
                        const localePathResult = this.i18nProvider.analyze(pathname);
                        // If the locale is detected from the path, we need to remove it
                        // from the pathname.
                        if (localePathResult.detectedLocale) {
                            pathname = localePathResult.pathname;
                        }
                        // Update the query with the detected locale and default locale.
                        _parsedUrl.query.__nextLocale = localePathResult.detectedLocale;
                        _parsedUrl.query.__nextDefaultLocale = defaultLocale;
                        // If the locale is not detected from the path, we need to mark that
                        // it was not inferred from default.
                        if (!_parsedUrl.query.__nextLocale) {
                            delete _parsedUrl.query.__nextInferredLocaleFromDefault;
                        }
                        // If no locale was detected and we don't have middleware, we need
                        // to render a 404 page.
                        // NOTE: (wyattjoh) we may need to change this for app/
                        if (!localePathResult.detectedLocale && !this.router.hasMiddleware) {
                            _parsedUrl.query.__nextLocale = defaultLocale;
                            await this.render404(req, res, _parsedUrl);
                            return {
                                finished: true
                            };
                        }
                    }
                    return {
                        pathname,
                        query: {
                            ..._parsedUrl.query,
                            __nextDataReq: "1"
                        },
                        finished: false
                    };
                }
            },
            ...imageRoutes,
            {
                match: (0, _pathMatch).getPathMatch("/_next/:path*"),
                type: "route",
                name: "_next catchall",
                // This path is needed because `render()` does a check for `/_next` and the calls the routing again
                fn: async (req, res, _params, parsedUrl)=>{
                    await this.render404(req, res, parsedUrl);
                    return {
                        finished: true
                    };
                }
            },
            ...publicRoutes,
            ...staticFilesRoutes, 
        ];
        const restrictedRedirectPaths = this.nextConfig.basePath ? [
            `${this.nextConfig.basePath}/_next`
        ] : [
            "/_next"
        ];
        // Headers come very first
        const headers = this.minimalMode || this.isRenderWorker ? [] : this.customRoutes.headers.map((rule)=>(0, _serverRouteUtils).createHeaderRoute({
                rule,
                restrictedRedirectPaths
            }));
        const redirects = this.minimalMode || this.isRenderWorker ? [] : this.customRoutes.redirects.map((rule)=>(0, _serverRouteUtils).createRedirectRoute({
                rule,
                restrictedRedirectPaths
            }));
        const rewrites = this.generateRewrites({
            restrictedRedirectPaths
        });
        const catchAllMiddleware = this.generateCatchAllMiddlewareRoute();
        const catchAllRoute = {
            match: (0, _pathMatch).getPathMatch("/:path*"),
            type: "route",
            matchesLocale: true,
            name: "Catchall render",
            fn: async (req, res, _params, parsedUrl)=>{
                var ref;
                let { pathname , query  } = parsedUrl;
                if (!pathname) {
                    throw new Error("pathname is undefined");
                }
                const bubbleNoFallback = Boolean(query._nextBubbleNoFallback);
                // next.js core assumes page path without trailing slash
                pathname = (0, _removeTrailingSlash).removeTrailingSlash(pathname);
                const options = {
                    i18n: (ref = this.i18nProvider) == null ? void 0 : ref.fromQuery(pathname, query)
                };
                const match = await this.matchers.match(pathname, options);
                if (this.isRouterWorker) {
                    var ref10, ref11;
                    let page = pathname;
                    if (!await this.hasPage(page)) {
                        for (const route of this.dynamicRoutes || []){
                            if (route.match(pathname)) {
                                page = route.page;
                                break;
                            }
                        }
                    }
                    const renderKind = ((ref10 = this.appPathRoutes) == null ? void 0 : ref10[page]) ? "app" : "pages";
                    if (this.renderWorkersPromises) {
                        await this.renderWorkersPromises;
                        this.renderWorkersPromises = undefined;
                    }
                    const renderWorker = (ref11 = this.renderWorkers) == null ? void 0 : ref11[renderKind];
                    if (renderWorker) {
                        var ref12, ref13;
                        const initUrl = (0, _requestMeta).getRequestMeta(req, "__NEXT_INIT_URL");
                        const { port , hostname  } = await renderWorker.initialize(this.renderWorkerOpts);
                        const renderUrl = new URL(initUrl);
                        renderUrl.hostname = hostname;
                        renderUrl.port = port + "";
                        let invokePathname = pathname;
                        const normalizedInvokePathname = (ref12 = this.localeNormalizer) == null ? void 0 : ref12.normalize(pathname);
                        if (normalizedInvokePathname == null ? void 0 : normalizedInvokePathname.startsWith("/api")) {
                            invokePathname = normalizedInvokePathname;
                        } else if (query.__nextLocale && !(0, _pathHasPrefix).pathHasPrefix(invokePathname, `/${query.__nextLocale}`)) {
                            invokePathname = `/${query.__nextLocale}${invokePathname === "/" ? "" : invokePathname}`;
                        }
                        if (query.__nextDataReq) {
                            invokePathname = `/_next/data/${this.buildId}${invokePathname}.json`;
                        }
                        invokePathname = (0, _addPathPrefix).addPathPrefix(invokePathname, this.nextConfig.basePath);
                        const keptQuery = {};
                        for (const key of Object.keys(query)){
                            if (key.startsWith("__next") || key.startsWith("_next")) {
                                continue;
                            }
                            keptQuery[key] = query[key];
                        }
                        if (query._nextBubbleNoFallback) {
                            keptQuery._nextBubbleNoFallback = "1";
                        }
                        const invokeQuery = JSON.stringify(keptQuery);
                        const invokeHeaders = {
                            "cache-control": "",
                            ...req.headers,
                            "x-invoke-path": invokePathname,
                            "x-invoke-query": encodeURIComponent(invokeQuery)
                        };
                        const invokeRes = await (0, _serverIpc).invokeRequest(renderUrl.toString(), {
                            headers: invokeHeaders,
                            method: req.method
                        }, (ref13 = (0, _requestMeta).getRequestMeta(req, "__NEXT_CLONABLE_BODY")) == null ? void 0 : ref13.cloneBodyStream());
                        const noFallback = invokeRes.headers["x-no-fallback"];
                        if (noFallback) {
                            if (bubbleNoFallback) {
                                return {
                                    finished: false
                                };
                            } else {
                                await this.render404(req, res, parsedUrl);
                                return {
                                    finished: true
                                };
                            }
                        }
                        for (const [key1, value] of Object.entries((0, _serverIpc).filterReqHeaders({
                            ...invokeRes.headers
                        }))){
                            if (value !== undefined) {
                                if (key1 === "set-cookie") {
                                    const curValue = res.getHeader(key1);
                                    const newValue = [];
                                    for (const cookie of (0, _utils1).splitCookiesString(curValue || "")){
                                        newValue.push(cookie);
                                    }
                                    for (const val of Array.isArray(value) ? value : value ? [
                                        value
                                    ] : []){
                                        newValue.push(val);
                                    }
                                    res.setHeader(key1, newValue);
                                } else {
                                    res.setHeader(key1, value);
                                }
                            }
                        }
                        res.statusCode = invokeRes.statusCode;
                        res.statusMessage = invokeRes.statusMessage;
                        for await (const chunk of invokeRes){
                            this.streamResponseChunk(res, chunk);
                        }
                        res.originalResponse.end();
                        return {
                            finished: true
                        };
                    }
                }
                if (match) {
                    (0, _requestMeta).addRequestMeta(req, "_nextMatch", match);
                }
                // Try to handle the given route with the configured handlers.
                if (match) {
                    // Add the match to the request so we don't have to re-run the matcher
                    // for the same request.
                    (0, _requestMeta).addRequestMeta(req, "_nextMatch", match);
                    // TODO-APP: move this to a route handler
                    const edgeFunctionsPages = this.getEdgeFunctionsPages();
                    for (const edgeFunctionsPage of edgeFunctionsPages){
                        if (edgeFunctionsPage === match.definition.page) {
                            if (this.nextConfig.output === "export") {
                                await this.render404(req, res, parsedUrl);
                                return {
                                    finished: true
                                };
                            }
                            delete query._nextBubbleNoFallback;
                            const handledAsEdgeFunction = await this.runEdgeFunction({
                                req,
                                res,
                                query,
                                params: match.params,
                                page: match.definition.page,
                                appPaths: null
                            });
                            if (handledAsEdgeFunction) {
                                return {
                                    finished: true
                                };
                            }
                        }
                    }
                    let handled = false;
                    // If the route was detected as being a Pages API route, then handle
                    // it.
                    // TODO: move this behavior into a route handler.
                    if (match.definition.kind === _routeKind.RouteKind.PAGES_API) {
                        if (this.nextConfig.output === "export") {
                            await this.render404(req, res, parsedUrl);
                            return {
                                finished: true
                            };
                        }
                        delete query._nextBubbleNoFallback;
                        handled = await this.handleApiRequest(req, res, query, // TODO: see if we can add a runtime check for this
                        match);
                        if (handled) return {
                            finished: true
                        };
                    }
                // else if (match.definition.kind === RouteKind.METADATA_ROUTE) {
                //   handled = await this.handlers.handle(match, req, res)
                //   if (handled) return { finished: true }
                // }
                }
                try {
                    await this.render(req, res, pathname, query, parsedUrl, true);
                    return {
                        finished: true
                    };
                } catch (err) {
                    if (err instanceof _baseServer.NoFallbackError && bubbleNoFallback) {
                        if (this.isRenderWorker) {
                            res.setHeader("x-no-fallback", "1");
                            res.send();
                            return {
                                finished: true
                            };
                        }
                        return {
                            finished: false
                        };
                    }
                    throw err;
                }
            }
        };
        const { useFileSystemPublicRoutes  } = this.nextConfig;
        if (useFileSystemPublicRoutes) {
            this.appPathRoutes = this.getAppPathRoutes();
        }
        return {
            headers,
            fsRoutes,
            rewrites,
            redirects,
            catchAllRoute,
            catchAllMiddleware,
            useFileSystemPublicRoutes,
            matchers: this.matchers,
            nextConfig: this.nextConfig,
            i18nProvider: this.i18nProvider
        };
    }
    /**
   * Resolves `API` request, in development builds on demand
   * @param req http request
   * @param res http response
   * @param pathname path of request
   */ async handleApiRequest(req, res, query, match) {
        const { definition: { pathname , filename  } , params ,  } = match;
        return this.runApi(req, res, query, params, pathname, filename);
    }
    getCacheFilesystem() {
        return _nodeFsMethods.nodeFs;
    }
    normalizeReq(req) {
        return req instanceof _http.IncomingMessage ? new _node.NodeNextRequest(req) : req;
    }
    normalizeRes(res) {
        return res instanceof _http.ServerResponse ? new _node.NodeNextResponse(res) : res;
    }
    getRequestHandler() {
        // This is just optimization to fire prepare as soon as possible
        // It will be properly awaited later
        void this.prepare();
        const handler = super.getRequestHandler();
        return async (req, res, parsedUrl)=>{
            return handler(this.normalizeReq(req), this.normalizeRes(res), parsedUrl);
        };
    }
    async render(req, res, pathname, query, parsedUrl, internal = false) {
        return super.render(this.normalizeReq(req), this.normalizeRes(res), pathname, query, parsedUrl, internal);
    }
    async renderToHTML(req, res, pathname, query) {
        return super.renderToHTML(this.normalizeReq(req), this.normalizeRes(res), pathname, query);
    }
    async renderError(err, req, res, pathname, query, setHeaders) {
        return super.renderError(err, this.normalizeReq(req), this.normalizeRes(res), pathname, query, setHeaders);
    }
    async renderErrorToHTML(err, req, res, pathname, query) {
        return super.renderErrorToHTML(err, this.normalizeReq(req), this.normalizeRes(res), pathname, query);
    }
    async render404(req, res, parsedUrl, setHeaders) {
        return super.render404(this.normalizeReq(req), this.normalizeRes(res), parsedUrl, setHeaders);
    }
    async serveStatic(req, res, path, parsedUrl) {
        if (!this.isServableUrl(path)) {
            return this.render404(req, res, parsedUrl);
        }
        if (!(req.method === "GET" || req.method === "HEAD")) {
            res.statusCode = 405;
            res.setHeader("Allow", [
                "GET",
                "HEAD"
            ]);
            return this.renderError(null, req, res, path);
        }
        try {
            await this.sendStatic(req, res, path);
        } catch (error) {
            if (!(0, _isError).default(error)) throw error;
            const err = error;
            if (err.code === "ENOENT" || err.statusCode === 404) {
                this.render404(req, res, parsedUrl);
            } else if (typeof err.statusCode === "number" && POSSIBLE_ERROR_CODE_FROM_SERVE_STATIC.has(err.statusCode)) {
                res.statusCode = err.statusCode;
                return this.renderError(err, req, res, path);
            } else if (err.expose === false) {
                res.statusCode = 400;
                return this.renderError(null, req, res, path);
            } else {
                throw err;
            }
        }
    }
    getStaticRoutes() {
        return this.hasStaticDir ? [
            {
                // It's very important to keep this route's param optional.
                // (but it should support as many params as needed, separated by '/')
                // Otherwise this will lead to a pretty simple DOS attack.
                // See more: https://github.com/vercel/next.js/issues/2617
                match: (0, _pathMatch).getPathMatch("/static/:path*"),
                name: "static catchall",
                fn: async (req, res, params, parsedUrl)=>{
                    const p = (0, _path).join(this.dir, "static", ...params.path);
                    await this.serveStatic(req, res, p, parsedUrl);
                    return {
                        finished: true
                    };
                }
            }, 
        ] : [];
    }
    isServableUrl(untrustedFileUrl) {
        // This method mimics what the version of `send` we use does:
        // 1. decodeURIComponent:
        //    https://github.com/pillarjs/send/blob/0.17.1/index.js#L989
        //    https://github.com/pillarjs/send/blob/0.17.1/index.js#L518-L522
        // 2. resolve:
        //    https://github.com/pillarjs/send/blob/de073ed3237ade9ff71c61673a34474b30e5d45b/index.js#L561
        let decodedUntrustedFilePath;
        try {
            // (1) Decode the URL so we have the proper file name
            decodedUntrustedFilePath = decodeURIComponent(untrustedFileUrl);
        } catch  {
            return false;
        }
        // (2) Resolve "up paths" to determine real request
        const untrustedFilePath = (0, _path).resolve(decodedUntrustedFilePath);
        // don't allow null bytes anywhere in the file path
        if (untrustedFilePath.indexOf("\0") !== -1) {
            return false;
        }
        // Check if .next/static, static and public are in the path.
        // If not the path is not available.
        if ((untrustedFilePath.startsWith((0, _path).join(this.distDir, "static") + _path.sep) || untrustedFilePath.startsWith((0, _path).join(this.dir, "static") + _path.sep) || untrustedFilePath.startsWith((0, _path).join(this.dir, "public") + _path.sep)) === false) {
            return false;
        }
        // Check against the real filesystem paths
        const filesystemUrls = this.getFilesystemPaths();
        const resolved = (0, _path).relative(this.dir, untrustedFilePath);
        return filesystemUrls.has(resolved);
    }
    generateRewrites({ restrictedRedirectPaths  }) {
        let beforeFiles = [];
        let afterFiles = [];
        let fallback = [];
        if (!this.minimalMode && !this.isRenderWorker) {
            const buildRewrite = (rewrite, check = true)=>{
                const rewriteRoute = (0, _serverRouteUtils).getCustomRoute({
                    type: "rewrite",
                    rule: rewrite,
                    restrictedRedirectPaths
                });
                return {
                    ...rewriteRoute,
                    check,
                    type: rewriteRoute.type,
                    name: `Rewrite route ${rewriteRoute.source}`,
                    match: rewriteRoute.match,
                    matchesBasePath: true,
                    matchesLocale: true,
                    matchesLocaleAPIRoutes: true,
                    matchesTrailingSlash: true,
                    fn: async (req, res, params, parsedUrl, upgradeHead)=>{
                        const { newUrl , parsedDestination  } = (0, _prepareDestination).prepareDestination({
                            appendParamsToQuery: true,
                            destination: rewriteRoute.destination,
                            params: params,
                            query: parsedUrl.query
                        });
                        // external rewrite, proxy it
                        if (parsedDestination.protocol) {
                            return this.proxyRequest(req, res, parsedDestination, upgradeHead);
                        }
                        (0, _requestMeta).addRequestMeta(req, "_nextRewroteUrl", newUrl);
                        (0, _requestMeta).addRequestMeta(req, "_nextDidRewrite", newUrl !== req.url);
                        // Analyze the destination url to update the locale in the query if
                        // it is enabled.
                        if (this.i18nProvider) {
                            // Base path should be stripped before we analyze the destination
                            // url for locales if it is enabled.
                            let pathname = newUrl;
                            if (this.nextConfig.basePath) {
                                pathname = (0, _removePathPrefix).removePathPrefix(pathname, this.nextConfig.basePath);
                            }
                            // Assume the default locale from the query. We do this to ensure
                            // that if the rewrite is specified without a locale we can
                            // fallback to the correct locale. The domain didn't change, so
                            // we can use the same default as before.
                            const defaultLocale = parsedUrl.query.__nextDefaultLocale;
                            // Analyze the pathname to see if it detects a locale.
                            const { detectedLocale , inferredFromDefault  } = this.i18nProvider.analyze(pathname, {
                                defaultLocale
                            });
                            // We update the locale in the query if it is detected. If it
                            // wasn't detected it will fallback to the default locale.
                            parsedUrl.query.__nextLocale = detectedLocale;
                            // Mark if the locale was inferred from the default locale.
                            if (inferredFromDefault) {
                                parsedUrl.query.__nextInferredLocaleFromDefault = "1";
                            } else {
                                delete parsedUrl.query.__nextInferredLocaleFromDefault;
                            }
                        }
                        return {
                            finished: false,
                            pathname: newUrl,
                            query: parsedDestination.query
                        };
                    }
                };
            };
            if (Array.isArray(this.customRoutes.rewrites)) {
                afterFiles = this.customRoutes.rewrites.map((r)=>buildRewrite(r));
            } else {
                beforeFiles = this.customRoutes.rewrites.beforeFiles.map((r)=>buildRewrite(r, false));
                afterFiles = this.customRoutes.rewrites.afterFiles.map((r)=>buildRewrite(r));
                fallback = this.customRoutes.rewrites.fallback.map((r)=>buildRewrite(r));
            }
        }
        return {
            beforeFiles,
            afterFiles,
            fallback
        };
    }
    getMiddlewareManifest() {
        if (this.minimalMode) return null;
        const manifest = require((0, _path).join(this.serverDistDir, _constants.MIDDLEWARE_MANIFEST));
        return manifest;
    }
    /** Returns the middleware routing item if there is one. */ getMiddleware() {
        var ref;
        const manifest = this.getMiddlewareManifest();
        const middleware = manifest == null ? void 0 : (ref = manifest.middleware) == null ? void 0 : ref["/"];
        if (!middleware) {
            return;
        }
        return {
            match: getMiddlewareMatcher(middleware),
            page: "/"
        };
    }
    getEdgeFunctionsPages() {
        const manifest = this.getMiddlewareManifest();
        if (!manifest) {
            return [];
        }
        return Object.keys(manifest.functions);
    }
    /**
   * Get information for the edge function located in the provided page
   * folder. If the edge function info can't be found it will throw
   * an error.
   */ getEdgeFunctionInfo(params) {
        const manifest = this.getMiddlewareManifest();
        if (!manifest) {
            return null;
        }
        let foundPage;
        try {
            foundPage = (0, _denormalizePagePath).denormalizePagePath((0, _normalizePagePath).normalizePagePath(params.page));
        } catch (err) {
            return null;
        }
        let pageInfo = params.middleware ? manifest.middleware[foundPage] : manifest.functions[foundPage];
        if (!pageInfo) {
            if (!params.middleware) {
                throw new _utils.PageNotFoundError(foundPage);
            }
            return null;
        }
        return {
            name: pageInfo.name,
            paths: pageInfo.files.map((file)=>(0, _path).join(this.distDir, file)),
            env: pageInfo.env ?? [],
            wasm: (pageInfo.wasm ?? []).map((binding)=>({
                    ...binding,
                    filePath: (0, _path).join(this.distDir, binding.filePath)
                })),
            assets: (pageInfo.assets ?? []).map((binding)=>{
                return {
                    ...binding,
                    filePath: (0, _path).join(this.distDir, binding.filePath)
                };
            })
        };
    }
    /**
   * Checks if a middleware exists. This method is useful for the development
   * server where we need to check the filesystem. Here we just check the
   * middleware manifest.
   */ async hasMiddleware(pathname) {
        const info = this.getEdgeFunctionInfo({
            page: pathname,
            middleware: true
        });
        return Boolean(info && info.paths.length > 0);
    }
    /**
   * A placeholder for a function to be defined in the development server.
   * It will make sure that the root middleware or an edge function has been compiled
   * so that we can run it.
   */ async ensureMiddleware() {}
    async ensureEdgeFunction(_params) {}
    /**
   * This method gets all middleware matchers and execute them when the request
   * matches. It will make sure that each middleware exists and is compiled and
   * ready to be invoked. The development server will decorate it to add warns
   * and errors with rich traces.
   */ async runMiddleware(params) {
        var ref;
        // Middleware is skipped for on-demand revalidate requests
        if ((0, _apiUtils).checkIsOnDemandRevalidate(params.request, this.renderOpts.previewProps).isOnDemandRevalidate) {
            return {
                finished: false
            };
        }
        const normalizedPathname = (0, _removeTrailingSlash).removeTrailingSlash(params.parsed.pathname || "");
        let url;
        const options = {
            i18n: (ref = this.i18nProvider) == null ? void 0 : ref.analyze(normalizedPathname)
        };
        if (this.nextConfig.skipMiddlewareUrlNormalize) {
            url = (0, _requestMeta).getRequestMeta(params.request, "__NEXT_INIT_URL");
        } else {
            // For middleware to "fetch" we must always provide an absolute URL
            const query = (0, _querystring).urlQueryToSearchParams(params.parsed.query).toString();
            const locale = params.parsed.query.__nextLocale;
            url = `${(0, _requestMeta).getRequestMeta(params.request, "_protocol")}://${this.hostname}:${this.port}${locale ? `/${locale}` : ""}${params.parsed.pathname}${query ? `?${query}` : ""}`;
        }
        if (!url.startsWith("http")) {
            throw new Error("To use middleware you must provide a `hostname` and `port` to the Next.js Server");
        }
        const page = {};
        const match = await this.matchers.match(normalizedPathname, options);
        if (match) {
            page.name = match.params ? match.definition.pathname : params.parsedUrl.pathname;
            page.params = match.params;
        }
        const middleware = this.getMiddleware();
        if (!middleware) {
            return {
                finished: false
            };
        }
        if (!await this.hasMiddleware(middleware.page)) {
            return {
                finished: false
            };
        }
        await this.ensureMiddleware();
        const middlewareInfo = this.getEdgeFunctionInfo({
            page: middleware.page,
            middleware: true
        });
        if (!middlewareInfo) {
            throw new _utils.MiddlewareNotFoundError();
        }
        const method = (params.request.method || "GET").toUpperCase();
        const { run  } = require("./web/sandbox");
        const result = await run({
            distDir: this.distDir,
            name: middlewareInfo.name,
            paths: middlewareInfo.paths,
            env: middlewareInfo.env,
            edgeFunctionEntry: middlewareInfo,
            request: {
                headers: params.request.headers,
                method,
                nextConfig: {
                    basePath: this.nextConfig.basePath,
                    i18n: this.nextConfig.i18n,
                    trailingSlash: this.nextConfig.trailingSlash
                },
                url: url,
                page: page,
                body: (0, _requestMeta).getRequestMeta(params.request, "__NEXT_CLONABLE_BODY")
            },
            useCache: true,
            onWarning: params.onWarning
        });
        if (!this.renderOpts.dev) {
            result.waitUntil.catch((error)=>{
                console.error(`Uncaught: middleware waitUntil errored`, error);
            });
        }
        if (!result) {
            this.render404(params.request, params.response, params.parsed);
            return {
                finished: true
            };
        }
        for (let [key, value] of result.response.headers){
            if (key.toLowerCase() !== "set-cookie") continue;
            // Clear existing header.
            result.response.headers.delete(key);
            // Append each cookie individually.
            const cookies = (0, _utils1).splitCookiesString(value);
            for (const cookie of cookies){
                result.response.headers.append(key, cookie);
            }
            // Add cookies to request meta.
            (0, _requestMeta).addRequestMeta(params.request, "_nextMiddlewareCookie", cookies);
        }
        return result;
    }
    generateCatchAllMiddlewareRoute(devReady) {
        if (this.minimalMode) return [];
        const routes = [];
        if (!this.renderOpts.dev || devReady) {
            if (this.getMiddleware()) {
                const middlewareCatchAllRoute = {
                    match: (0, _pathMatch).getPathMatch("/:path*"),
                    matchesBasePath: true,
                    matchesLocale: true,
                    type: "route",
                    name: "middleware catchall",
                    fn: async (req, res, _params, parsed)=>{
                        const isMiddlewareInvoke = this.isRenderWorker && req.headers["x-middleware-invoke"];
                        const handleFinished = (finished = false)=>{
                            if (isMiddlewareInvoke && !finished) {
                                res.setHeader("x-middleware-invoke", "1");
                                res.body("").send();
                                return {
                                    finished: true
                                };
                            }
                            return {
                                finished
                            };
                        };
                        if (this.isRenderWorker && !isMiddlewareInvoke) {
                            return {
                                finished: false
                            };
                        }
                        const middleware = this.getMiddleware();
                        if (!middleware) {
                            return handleFinished();
                        }
                        const initUrl = (0, _requestMeta).getRequestMeta(req, "__NEXT_INIT_URL");
                        const parsedUrl = (0, _parseUrl).parseUrl(initUrl);
                        const pathnameInfo = (0, _getNextPathnameInfo).getNextPathnameInfo(parsedUrl.pathname, {
                            nextConfig: this.nextConfig,
                            i18nProvider: this.i18nProvider
                        });
                        parsedUrl.pathname = pathnameInfo.pathname;
                        const normalizedPathname = (0, _removeTrailingSlash).removeTrailingSlash(parsed.pathname || "");
                        if (!middleware.match(normalizedPathname, req, parsedUrl.query)) {
                            return handleFinished();
                        }
                        let result;
                        try {
                            var ref;
                            await this.ensureMiddleware();
                            if (this.isRouterWorker && ((ref = this.renderWorkers) == null ? void 0 : ref.middleware)) {
                                var ref14;
                                if (this.renderWorkersPromises) {
                                    await this.renderWorkersPromises;
                                    this.renderWorkersPromises = undefined;
                                }
                                const { port , hostname  } = await this.renderWorkers.middleware.initialize(this.renderWorkerOpts);
                                const renderUrl = new URL(initUrl);
                                renderUrl.hostname = hostname;
                                renderUrl.port = port + "";
                                const invokeHeaders = {
                                    ...req.headers,
                                    "x-middleware-invoke": "1"
                                };
                                const invokeRes = await (0, _serverIpc).invokeRequest(renderUrl.toString(), {
                                    headers: invokeHeaders,
                                    method: req.method
                                }, (ref14 = (0, _requestMeta).getRequestMeta(req, "__NEXT_CLONABLE_BODY")) == null ? void 0 : ref14.cloneBodyStream());
                                const webResponse = new Response(null, {
                                    status: invokeRes.statusCode,
                                    headers: new Headers(invokeRes.headers)
                                });
                                webResponse.invokeRes = invokeRes;
                                result = {
                                    response: webResponse,
                                    waitUntil: Promise.resolve()
                                };
                                for (const key of [
                                    ...result.response.headers.keys()
                                ]){
                                    if ([
                                        "content-encoding",
                                        "transfer-encoding",
                                        "keep-alive",
                                        "connection", 
                                    ].includes(key)) {
                                        result.response.headers.delete(key);
                                    } else {
                                        const value = result.response.headers.get(key);
                                        // propagate this to req headers so it's
                                        // passed to the render worker for the page
                                        req.headers[key] = value || undefined;
                                        if (key.toLowerCase() === "set-cookie" && value) {
                                            (0, _requestMeta).addRequestMeta(req, "_nextMiddlewareCookie", (0, _utils1).splitCookiesString(value));
                                        }
                                    }
                                }
                            } else {
                                result = await this.runMiddleware({
                                    request: req,
                                    response: res,
                                    parsedUrl: parsedUrl,
                                    parsed: parsed
                                });
                                if (isMiddlewareInvoke && "response" in result) {
                                    for (const [key, value] of Object.entries((0, _utils1).toNodeHeaders(result.response.headers))){
                                        if (key !== "content-encoding" && value !== undefined) {
                                            res.setHeader(key, value);
                                        }
                                    }
                                    res.statusCode = result.response.status;
                                    for await (const chunk of result.response.body || []){
                                        this.streamResponseChunk(res, chunk);
                                    }
                                    res.send();
                                    return {
                                        finished: true
                                    };
                                }
                            }
                        } catch (err) {
                            if ((0, _isError).default(err) && err.code === "ENOENT") {
                                await this.render404(req, res, parsed);
                                return {
                                    finished: true
                                };
                            }
                            if (err instanceof _utils.DecodeError) {
                                res.statusCode = 400;
                                this.renderError(err, req, res, parsed.pathname || "");
                                return {
                                    finished: true
                                };
                            }
                            const error = (0, _isError).getProperError(err);
                            console.error(error);
                            res.statusCode = 500;
                            this.renderError(error, req, res, parsed.pathname || "");
                            return {
                                finished: true
                            };
                        }
                        if ("finished" in result) {
                            return result;
                        }
                        if (result.response.headers.has("x-middleware-rewrite")) {
                            const value = result.response.headers.get("x-middleware-rewrite");
                            const rel = (0, _relativizeUrl).relativizeURL(value, initUrl);
                            result.response.headers.set("x-middleware-rewrite", rel);
                        }
                        if (result.response.headers.has("x-middleware-override-headers")) {
                            const overriddenHeaders = new Set();
                            for (const key of result.response.headers.get("x-middleware-override-headers").split(",")){
                                overriddenHeaders.add(key.trim());
                            }
                            result.response.headers.delete("x-middleware-override-headers");
                            // Delete headers.
                            for (const key2 of Object.keys(req.headers)){
                                if (!overriddenHeaders.has(key2)) {
                                    delete req.headers[key2];
                                }
                            }
                            // Update or add headers.
                            for (const key3 of overriddenHeaders.keys()){
                                const valueKey = "x-middleware-request-" + key3;
                                const newValue = result.response.headers.get(valueKey);
                                const oldValue = req.headers[key3];
                                if (oldValue !== newValue) {
                                    req.headers[key3] = newValue === null ? undefined : newValue;
                                }
                                result.response.headers.delete(valueKey);
                            }
                        }
                        if (result.response.headers.has("Location")) {
                            const value = result.response.headers.get("Location");
                            const rel = (0, _relativizeUrl).relativizeURL(value, initUrl);
                            result.response.headers.set("Location", rel);
                        }
                        if (!result.response.headers.has("x-middleware-rewrite") && !result.response.headers.has("x-middleware-next") && !result.response.headers.has("Location")) {
                            result.response.headers.set("x-middleware-refresh", "1");
                        }
                        result.response.headers.delete("x-middleware-next");
                        for (const [key, value] of Object.entries((0, _utils1).toNodeHeaders(result.response.headers))){
                            if ([
                                "x-middleware-rewrite",
                                "x-middleware-redirect",
                                "x-middleware-refresh", 
                            ].includes(key)) {
                                continue;
                            }
                            if (key !== "content-encoding" && value !== undefined) {
                                if (typeof value === "number") {
                                    res.setHeader(key, value.toString());
                                } else {
                                    res.setHeader(key, value);
                                }
                            }
                        }
                        res.statusCode = result.response.status;
                        res.statusMessage = result.response.statusText;
                        const location = result.response.headers.get("Location");
                        if (location) {
                            res.statusCode = result.response.status;
                            if (res.statusCode === 308) {
                                res.setHeader("Refresh", `0;url=${location}`);
                            }
                            res.body(location).send();
                            return {
                                finished: true
                            };
                        }
                        // If the middleware has set a `x-middleware-rewrite` header, we
                        // need to rewrite the URL to the new path and re-run the request.
                        if (result.response.headers.has("x-middleware-rewrite")) {
                            const rewritePath = result.response.headers.get("x-middleware-rewrite");
                            const parsedDestination = (0, _parseUrl).parseUrl(rewritePath);
                            const newUrl = parsedDestination.pathname;
                            // If the destination has a protocol and host that doesn't match
                            // the current request, we need to proxy the request to the
                            // correct host.
                            if (parsedDestination.protocol && (parsedDestination.port ? `${parsedDestination.hostname}:${parsedDestination.port}` : parsedDestination.hostname) !== req.headers.host) {
                                return this.proxyRequest(req, res, parsedDestination);
                            }
                            // If this server has i18n enabled, we need to make sure to parse
                            // the locale from the destination URL and add it to the query
                            // string so that the next request is properly localized.
                            if (this.i18nProvider) {
                                const { detectedLocale  } = this.i18nProvider.analyze(newUrl);
                                if (detectedLocale) {
                                    parsedDestination.query.__nextLocale = detectedLocale;
                                }
                            }
                            (0, _requestMeta).addRequestMeta(req, "_nextRewroteUrl", newUrl);
                            (0, _requestMeta).addRequestMeta(req, "_nextDidRewrite", newUrl !== req.url);
                            if (!isMiddlewareInvoke) {
                                return {
                                    finished: false,
                                    pathname: newUrl,
                                    query: parsedDestination.query
                                };
                            }
                        }
                        if (result.response.headers.has("x-middleware-refresh")) {
                            res.statusCode = result.response.status;
                            if (result.response.invokeRes) {
                                for await (const chunk of result.response.invokeRes){
                                    this.streamResponseChunk(res, chunk);
                                }
                                res.originalResponse.end();
                            } else {
                                for await (const chunk of result.response.body || []){
                                    this.streamResponseChunk(res, chunk);
                                }
                                res.send();
                            }
                            return {
                                finished: true
                            };
                        }
                        return {
                            finished: false
                        };
                    }
                };
                routes.push(middlewareCatchAllRoute);
            }
        }
        return routes;
    }
    getPrerenderManifest() {
        if (this._cachedPreviewManifest) {
            return this._cachedPreviewManifest;
        }
        const manifest = require((0, _path).join(this.distDir, _constants.PRERENDER_MANIFEST));
        return this._cachedPreviewManifest = manifest;
    }
    getRoutesManifest() {
        return (0, _tracer).getTracer().trace(_constants2.NextNodeServerSpan.getRoutesManifest, ()=>require((0, _path).join(this.distDir, _constants.ROUTES_MANIFEST)));
    }
    attachRequestMeta(req, parsedUrl) {
        var ref, ref15;
        const protocol = ((ref15 = (ref = req.originalRequest) == null ? void 0 : ref.socket) == null ? void 0 : ref15.encrypted) ? "https" : "http";
        // When there are hostname and port we build an absolute URL
        const initUrl = this.hostname && this.port ? `${protocol}://${this.hostname}:${this.port}${req.url}` : this.nextConfig.experimental.trustHostHeader ? `https://${req.headers.host || "localhost"}${req.url}` : req.url;
        (0, _requestMeta).addRequestMeta(req, "__NEXT_INIT_URL", initUrl);
        (0, _requestMeta).addRequestMeta(req, "__NEXT_INIT_QUERY", {
            ...parsedUrl.query
        });
        (0, _requestMeta).addRequestMeta(req, "_protocol", protocol);
        (0, _requestMeta).addRequestMeta(req, "__NEXT_CLONABLE_BODY", (0, _bodyStreams).getCloneableBody(req.body));
    }
    async runEdgeFunction(params) {
        let edgeInfo;
        const { query , page  } = params;
        await this.ensureEdgeFunction({
            page,
            appPaths: params.appPaths
        });
        edgeInfo = this.getEdgeFunctionInfo({
            page,
            middleware: false
        });
        if (!edgeInfo) {
            return null;
        }
        // For edge to "fetch" we must always provide an absolute URL
        const isDataReq = !!query.__nextDataReq;
        const initialUrl = new URL((0, _requestMeta).getRequestMeta(params.req, "__NEXT_INIT_URL") || "/", "http://n");
        const queryString = (0, _querystring).urlQueryToSearchParams({
            ...Object.fromEntries(initialUrl.searchParams),
            ...query,
            ...params.params
        }).toString();
        if (isDataReq) {
            params.req.headers["x-nextjs-data"] = "1";
        }
        initialUrl.search = queryString;
        const url = initialUrl.toString();
        if (!url.startsWith("http")) {
            throw new Error("To use middleware you must provide a `hostname` and `port` to the Next.js Server");
        }
        const { run  } = require("./web/sandbox");
        const result = await run({
            distDir: this.distDir,
            name: edgeInfo.name,
            paths: edgeInfo.paths,
            env: edgeInfo.env,
            edgeFunctionEntry: edgeInfo,
            request: {
                headers: params.req.headers,
                method: params.req.method,
                nextConfig: {
                    basePath: this.nextConfig.basePath,
                    i18n: this.nextConfig.i18n,
                    trailingSlash: this.nextConfig.trailingSlash
                },
                url,
                page: {
                    name: params.page,
                    ...params.params && {
                        params: params.params
                    }
                },
                body: (0, _requestMeta).getRequestMeta(params.req, "__NEXT_CLONABLE_BODY")
            },
            useCache: true,
            onWarning: params.onWarning,
            incrementalCache: (0, _requestMeta).getRequestMeta(params.req, "_nextIncrementalCache")
        });
        params.res.statusCode = result.response.status;
        params.res.statusMessage = result.response.statusText;
        // TODO: (wyattjoh) investigate improving this
        result.response.headers.forEach((value, key)=>{
            // The append handling is special cased for `set-cookie`.
            if (key.toLowerCase() === "set-cookie") {
                // TODO: (wyattjoh) replace with native response iteration when we can upgrade undici
                for (const cookie of (0, _utils1).splitCookiesString(value)){
                    params.res.appendHeader(key, cookie);
                }
            } else {
                params.res.appendHeader(key, value);
            }
        });
        if (result.response.body) {
            // TODO(gal): not sure that we always need to stream
            const nodeResStream = params.res.originalResponse;
            const { consumeUint8ArrayReadableStream  } = require("next/dist/compiled/edge-runtime");
            try {
                for await (const chunk of consumeUint8ArrayReadableStream(result.response.body)){
                    nodeResStream.write(chunk);
                }
            } finally{
                nodeResStream.end();
            }
        } else {
            params.res.originalResponse.end();
        }
        return result;
    }
    get serverDistDir() {
        return (0, _path).join(this.distDir, _constants.SERVER_DIRECTORY);
    }
}
exports.default = NextNodeServer;
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache() {
    if (typeof WeakMap !== "function") return null;
    var cache = new WeakMap();
    _getRequireWildcardCache = function() {
        return cache;
    };
    return cache;
}
function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache();
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const MiddlewareMatcherCache = new WeakMap();
function getMiddlewareMatcher(info) {
    const stored = MiddlewareMatcherCache.get(info);
    if (stored) {
        return stored;
    }
    if (!Array.isArray(info.matchers)) {
        throw new Error(`Invariant: invalid matchers for middleware ${JSON.stringify(info)}`);
    }
    const matcher = (0, _middlewareRouteMatcher).getMiddlewareRouteMatcher(info.matchers);
    MiddlewareMatcherCache.set(info, matcher);
    return matcher;
}
/**
 * Hardcoded every possible error status code that could be thrown by "serveStatic" method
 * This is done by searching "this.error" inside "send" module's source code:
 * https://github.com/pillarjs/send/blob/master/index.js
 * https://github.com/pillarjs/send/blob/develop/index.js
 */ const POSSIBLE_ERROR_CODE_FROM_SERVE_STATIC = new Set([
    // send module will throw 500 when header is already sent or fs.stat error happens
    // https://github.com/pillarjs/send/blob/53f0ab476145670a9bdd3dc722ab2fdc8d358fc6/index.js#L392
    // Note: we will use Next.js built-in 500 page to handle 500 errors
    // 500,
    // send module will throw 404 when file is missing
    // https://github.com/pillarjs/send/blob/53f0ab476145670a9bdd3dc722ab2fdc8d358fc6/index.js#L421
    // Note: we will use Next.js built-in 404 page to handle 404 errors
    // 404,
    // send module will throw 403 when redirecting to a directory without enabling directory listing
    // https://github.com/pillarjs/send/blob/53f0ab476145670a9bdd3dc722ab2fdc8d358fc6/index.js#L484
    // Note: Next.js throws a different error (without status code) for directory listing
    // 403,
    // send module will throw 400 when fails to normalize the path
    // https://github.com/pillarjs/send/blob/53f0ab476145670a9bdd3dc722ab2fdc8d358fc6/index.js#L520
    400,
    // send module will throw 412 with conditional GET request
    // https://github.com/pillarjs/send/blob/53f0ab476145670a9bdd3dc722ab2fdc8d358fc6/index.js#L632
    412,
    // send module will throw 416 when range is not satisfiable
    // https://github.com/pillarjs/send/blob/53f0ab476145670a9bdd3dc722ab2fdc8d358fc6/index.js#L669
    416, 
]);

//# sourceMappingURL=next-server.js.map