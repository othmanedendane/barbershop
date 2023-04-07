"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getEntryKey = getEntryKey;
exports.onDemandEntryHandler = onDemandEntryHandler;
exports.getInvalidator = exports.getEntries = exports.EntryTypes = exports.BUILT = exports.BUILDING = exports.ADDED = void 0;
var _debug = _interopRequireDefault(require("next/dist/compiled/debug"));
var _events = require("events");
var _findPageFile = require("../lib/find-page-file");
var _entries = require("../../build/entries");
var _path = require("path");
var _normalizePathSep = require("../../shared/lib/page-path/normalize-path-sep");
var _normalizePagePath = require("../../shared/lib/page-path/normalize-page-path");
var _ensureLeadingSlash = require("../../shared/lib/page-path/ensure-leading-slash");
var _removePagePathTail = require("../../shared/lib/page-path/remove-page-path-tail");
var _output = require("../../build/output");
var _getRouteFromEntrypoint = _interopRequireDefault(require("../get-route-from-entrypoint"));
var _getPageStaticInfo = require("../../build/analysis/get-page-static-info");
var _utils = require("../../build/utils");
var _utils1 = require("../../shared/lib/utils");
var _constants = require("../../shared/lib/constants");
var _routeKind = require("../future/route-kind");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const debug = (0, _debug).default("next:on-demand-entry-handler");
/**
 * Returns object keys with type inferred from the object key
 */ const keys = Object.keys;
const COMPILER_KEYS = keys(_constants.COMPILER_INDEXES);
function treePathToEntrypoint(segmentPath, parentPath) {
    const [parallelRouteKey, segment] = segmentPath;
    // TODO-APP: modify this path to cover parallelRouteKey convention
    const path = (parentPath ? parentPath + "/" : "") + (parallelRouteKey !== "children" && !segment.startsWith("@") ? `@${parallelRouteKey}/` : "") + (segment === "" ? "page" : segment);
    // Last segment
    if (segmentPath.length === 2) {
        return path;
    }
    const childSegmentPath = segmentPath.slice(2);
    return treePathToEntrypoint(childSegmentPath, path);
}
function convertDynamicParamTypeToSyntax(dynamicParamTypeShort, param) {
    switch(dynamicParamTypeShort){
        case "c":
            return `[...${param}]`;
        case "oc":
            return `[[...${param}]]`;
        case "d":
            return `[${param}]`;
        default:
            throw new Error("Unknown dynamic param type");
    }
}
function getEntryKey(compilerType, pageBundleType, page) {
    // TODO: handle the /@children slot better
    // this is a quick hack to handle when children is provided as @children/page instead of /page
    return `${compilerType}@${pageBundleType}@${page.replace(/\/@children/g, "")}`;
}
function getPageBundleType(pageBundlePath) {
    // Handle special case for /_error
    if (pageBundlePath === "/_error") return "pages";
    if ((0, _utils).isMiddlewareFilename(pageBundlePath)) return "root";
    return pageBundlePath.startsWith("pages/") ? "pages" : pageBundlePath.startsWith("app/") ? "app" : "root";
}
function getEntrypointsFromTree(tree, isFirst, parentPath = []) {
    const [segment, parallelRoutes] = tree;
    const currentSegment = Array.isArray(segment) ? convertDynamicParamTypeToSyntax(segment[2], segment[0]) : segment;
    const isPageSegment = currentSegment.startsWith("__PAGE__");
    const currentPath = [
        ...parentPath,
        isPageSegment ? "" : currentSegment
    ];
    if (!isFirst && isPageSegment) {
        // TODO get rid of '' at the start of tree
        return [
            treePathToEntrypoint(currentPath.slice(1))
        ];
    }
    return Object.keys(parallelRoutes).reduce((paths, key)=>{
        const childTree = parallelRoutes[key];
        const childPages = getEntrypointsFromTree(childTree, false, [
            ...currentPath,
            key, 
        ]);
        return [
            ...paths,
            ...childPages
        ];
    }, []);
}
const ADDED = Symbol("added");
exports.ADDED = ADDED;
const BUILDING = Symbol("building");
exports.BUILDING = BUILDING;
const BUILT = Symbol("built");
exports.BUILT = BUILT;
var EntryTypes;
exports.EntryTypes = EntryTypes;
(function(EntryTypes) {
    EntryTypes[EntryTypes["ENTRY"] = 0] = "ENTRY";
    EntryTypes[EntryTypes["CHILD_ENTRY"] = 1] = "CHILD_ENTRY";
})(EntryTypes || (exports.EntryTypes = EntryTypes = {}));
const entriesMap = new Map();
// remove /server from end of output for server compiler
const normalizeOutputPath = (dir)=>dir.replace(/[/\\]server$/, "");
const getEntries = (dir)=>{
    dir = normalizeOutputPath(dir);
    const entries = entriesMap.get(dir) || {};
    entriesMap.set(dir, entries);
    return entries;
};
exports.getEntries = getEntries;
const invalidators = new Map();
const getInvalidator = (dir)=>{
    dir = normalizeOutputPath(dir);
    return invalidators.get(dir);
};
exports.getInvalidator = getInvalidator;
const doneCallbacks = new _events.EventEmitter();
const lastClientAccessPages = [
    ""
];
const lastServerAccessPagesForAppDir = [
    ""
];
// Make sure only one invalidation happens at a time
// Otherwise, webpack hash gets changed and it'll force the client to reload.
class Invalidator {
    building = new Set();
    rebuildAgain = new Set();
    constructor(multiCompiler){
        this.multiCompiler = multiCompiler;
    }
    shouldRebuildAll() {
        return this.rebuildAgain.size > 0;
    }
    invalidate(compilerKeys = COMPILER_KEYS) {
        for (const key of compilerKeys){
            var ref;
            // If there's a current build is processing, we won't abort it by invalidating.
            // (If aborted, it'll cause a client side hard reload)
            // But let it to invalidate just after the completion.
            // So, it can re-build the queued pages at once.
            if (this.building.has(key)) {
                this.rebuildAgain.add(key);
                continue;
            }
            this.building.add(key);
            (ref = this.multiCompiler.compilers[_constants.COMPILER_INDEXES[key]].watching) == null ? void 0 : ref.invalidate();
        }
    }
    startBuilding(compilerKey) {
        this.building.add(compilerKey);
    }
    doneBuilding(compilerKeys = []) {
        const rebuild = [];
        for (const key of compilerKeys){
            this.building.delete(key);
            if (this.rebuildAgain.has(key)) {
                rebuild.push(key);
                this.rebuildAgain.delete(key);
            }
        }
        this.invalidate(rebuild);
    }
    willRebuild(compilerKey) {
        return this.rebuildAgain.has(compilerKey);
    }
}
function disposeInactiveEntries(entries, maxInactiveAge) {
    Object.keys(entries).forEach((entryKey)=>{
        const entryData = entries[entryKey];
        const { lastActiveTime , status , dispose  } = entryData;
        // TODO-APP: implement disposing of CHILD_ENTRY
        if (entryData.type === 1) {
            return;
        }
        if (dispose) // Skip pages already scheduled for disposing
        return;
        // This means this entry is currently building or just added
        // We don't need to dispose those entries.
        if (status !== BUILT) return;
        // We should not build the last accessed page even we didn't get any pings
        // Sometimes, it's possible our XHR ping to wait before completing other requests.
        // In that case, we should not dispose the current viewing page
        if (lastClientAccessPages.includes(entryKey) || lastServerAccessPagesForAppDir.includes(entryKey)) return;
        if (lastActiveTime && Date.now() - lastActiveTime > maxInactiveAge) {
            entries[entryKey].dispose = true;
        }
    });
}
// Normalize both app paths and page paths
function tryToNormalizePagePath(page) {
    try {
        return (0, _normalizePagePath).normalizePagePath(page);
    } catch (err) {
        console.error(err);
        throw new _utils1.PageNotFoundError(page);
    }
}
/**
 * Attempts to find a page file path from the given pages absolute directory,
 * a page and allowed extensions. If the page can't be found it will throw an
 * error. It defaults the `/_error` page to Next.js internal error page.
 *
 * @param rootDir Absolute path to the project root.
 * @param pagesDir Absolute path to the pages folder with trailing `/pages`.
 * @param normalizedPagePath The page normalized (it will be denormalized).
 * @param pageExtensions Array of page extensions.
 */ async function findPagePathData(rootDir, page, extensions, pagesDir, appDir) {
    const normalizedPagePath = tryToNormalizePagePath(page);
    let pagePath = null;
    const isInstrumentation = (0, _utils).isInstrumentationHookFile(normalizedPagePath);
    if ((0, _utils).isMiddlewareFile(normalizedPagePath) || isInstrumentation) {
        pagePath = await (0, _findPageFile).findPageFile(rootDir, normalizedPagePath, extensions, false);
        if (!pagePath) {
            throw new _utils1.PageNotFoundError(normalizedPagePath);
        }
        const pageUrl = (0, _ensureLeadingSlash).ensureLeadingSlash((0, _removePagePathTail).removePagePathTail((0, _normalizePathSep).normalizePathSep(pagePath), {
            extensions
        }));
        let bundlePath = normalizedPagePath;
        let pageKey = _path.posix.normalize(pageUrl);
        if (isInstrumentation) {
            bundlePath = bundlePath.replace("/src", "");
            pageKey = page.replace("/src", "");
        }
        return {
            absolutePagePath: (0, _path).join(rootDir, pagePath),
            bundlePath: bundlePath.slice(1),
            page: pageKey
        };
    }
    // Check appDir first falling back to pagesDir
    if (appDir) {
        pagePath = await (0, _findPageFile).findPageFile(appDir, normalizedPagePath, extensions, true);
        if (pagePath) {
            const pageUrl = (0, _ensureLeadingSlash).ensureLeadingSlash((0, _removePagePathTail).removePagePathTail((0, _normalizePathSep).normalizePathSep(pagePath), {
                keepIndex: true,
                extensions
            }));
            return {
                absolutePagePath: (0, _path).join(appDir, pagePath),
                bundlePath: _path.posix.join("app", pageUrl),
                page: _path.posix.normalize(pageUrl)
            };
        }
    }
    if (!pagePath && pagesDir) {
        pagePath = await (0, _findPageFile).findPageFile(pagesDir, normalizedPagePath, extensions, false);
    }
    if (pagePath !== null && pagesDir) {
        const pageUrl = (0, _ensureLeadingSlash).ensureLeadingSlash((0, _removePagePathTail).removePagePathTail((0, _normalizePathSep).normalizePathSep(pagePath), {
            extensions
        }));
        return {
            absolutePagePath: (0, _path).join(pagesDir, pagePath),
            bundlePath: _path.posix.join("pages", (0, _normalizePagePath).normalizePagePath(pageUrl)),
            page: _path.posix.normalize(pageUrl)
        };
    }
    if (page === "/_error") {
        return {
            absolutePagePath: require.resolve("next/dist/pages/_error"),
            bundlePath: page,
            page: (0, _normalizePathSep).normalizePathSep(page)
        };
    } else {
        throw new _utils1.PageNotFoundError(normalizedPagePath);
    }
}
async function findRoutePathData(rootDir, page, extensions, pagesDir, appDir, match) {
    if (match) {
        // If the match is available, we don't have to discover the data from the
        // filesystem.
        return {
            absolutePagePath: match.definition.filename,
            page: match.definition.page,
            bundlePath: match.definition.bundlePath
        };
    }
    return findPagePathData(rootDir, page, extensions, pagesDir, appDir);
}
function onDemandEntryHandler({ maxInactiveAge , multiCompiler , nextConfig , pagesBufferLength , pagesDir , rootDir , appDir  }) {
    let curInvalidator = getInvalidator(multiCompiler.outputPath);
    let curEntries = getEntries(multiCompiler.outputPath);
    if (!curInvalidator) {
        curInvalidator = new Invalidator(multiCompiler);
        invalidators.set(multiCompiler.outputPath, curInvalidator);
    }
    const startBuilding = (compilation)=>{
        const compilationName = compilation.name;
        curInvalidator.startBuilding(compilationName);
    };
    for (const compiler of multiCompiler.compilers){
        compiler.hooks.make.tap("NextJsOnDemandEntries", startBuilding);
    }
    function getPagePathsFromEntrypoints(type, entrypoints, root) {
        const pagePaths = [];
        for (const entrypoint of entrypoints.values()){
            const page = (0, _getRouteFromEntrypoint).default(entrypoint.name, root);
            if (page) {
                var ref;
                const pageBundleType = ((ref = entrypoint.name) == null ? void 0 : ref.startsWith("app/")) ? "app" : "pages";
                pagePaths.push(getEntryKey(type, pageBundleType, page));
            } else if (root && entrypoint.name === "root" || (0, _utils).isMiddlewareFilename(entrypoint.name) || (0, _utils).isInstrumentationHookFilename(entrypoint.name)) {
                pagePaths.push(getEntryKey(type, "root", `/${entrypoint.name}`));
            }
        }
        return pagePaths;
    }
    for (const compiler1 of multiCompiler.compilers){
        compiler1.hooks.done.tap("NextJsOnDemandEntries", ()=>{
            var ref;
            return (ref = getInvalidator(compiler1.outputPath)) == null ? void 0 : ref.doneBuilding([
                compiler1.name, 
            ]);
        });
    }
    multiCompiler.hooks.done.tap("NextJsOnDemandEntries", (multiStats)=>{
        var ref;
        const [clientStats, serverStats, edgeServerStats] = multiStats.stats;
        const root = !!appDir;
        const entryNames = [
            ...getPagePathsFromEntrypoints(_constants.COMPILER_NAMES.client, clientStats.compilation.entrypoints, root),
            ...getPagePathsFromEntrypoints(_constants.COMPILER_NAMES.server, serverStats.compilation.entrypoints, root),
            ...edgeServerStats ? getPagePathsFromEntrypoints(_constants.COMPILER_NAMES.edgeServer, edgeServerStats.compilation.entrypoints, root) : [], 
        ];
        for (const name of entryNames){
            const entry = curEntries[name];
            if (!entry) {
                continue;
            }
            if (entry.status !== BUILDING) {
                continue;
            }
            entry.status = BUILT;
            doneCallbacks.emit(name);
        }
        (ref = getInvalidator(multiCompiler.outputPath)) == null ? void 0 : ref.doneBuilding([
            ...COMPILER_KEYS
        ]);
    });
    const pingIntervalTime = Math.max(1000, Math.min(5000, maxInactiveAge));
    setInterval(function() {
        disposeInactiveEntries(curEntries, maxInactiveAge);
    }, pingIntervalTime + 1000).unref();
    function handleAppDirPing(tree) {
        const pages = getEntrypointsFromTree(tree, true);
        let toSend = {
            invalid: true
        };
        for (const page of pages){
            for (const compilerType of [
                _constants.COMPILER_NAMES.client,
                _constants.COMPILER_NAMES.server,
                _constants.COMPILER_NAMES.edgeServer, 
            ]){
                const entryKey = getEntryKey(compilerType, "app", `/${page}`);
                const entryInfo = curEntries[entryKey];
                // If there's no entry, it may have been invalidated and needs to be re-built.
                if (!entryInfo) {
                    continue;
                }
                // We don't need to maintain active state of anything other than BUILT entries
                if (entryInfo.status !== BUILT) continue;
                // If there's an entryInfo
                if (!lastServerAccessPagesForAppDir.includes(entryKey)) {
                    lastServerAccessPagesForAppDir.unshift(entryKey);
                    // Maintain the buffer max length
                    // TODO: verify that the current pageKey is not at the end of the array as multiple entrypoints can exist
                    if (lastServerAccessPagesForAppDir.length > pagesBufferLength) {
                        lastServerAccessPagesForAppDir.pop();
                    }
                }
                entryInfo.lastActiveTime = Date.now();
                entryInfo.dispose = false;
                toSend = {
                    success: true
                };
            }
        }
        return toSend;
    }
    function handlePing(pg) {
        const page = (0, _normalizePathSep).normalizePathSep(pg);
        let toSend = {
            invalid: true
        };
        for (const compilerType of [
            _constants.COMPILER_NAMES.client,
            _constants.COMPILER_NAMES.server,
            _constants.COMPILER_NAMES.edgeServer, 
        ]){
            const entryKey = getEntryKey(compilerType, "pages", page);
            const entryInfo = curEntries[entryKey];
            // If there's no entry, it may have been invalidated and needs to be re-built.
            if (!entryInfo) {
                // if (page !== lastEntry) client pings, but there's no entry for page
                if (compilerType === _constants.COMPILER_NAMES.client) {
                    return {
                        invalid: true
                    };
                }
                continue;
            }
            // 404 is an on demand entry but when a new page is added we have to refresh the page
            toSend = page === "/_error" ? {
                invalid: true
            } : {
                success: true
            };
            // We don't need to maintain active state of anything other than BUILT entries
            if (entryInfo.status !== BUILT) continue;
            // If there's an entryInfo
            if (!lastClientAccessPages.includes(entryKey)) {
                lastClientAccessPages.unshift(entryKey);
                // Maintain the buffer max length
                if (lastClientAccessPages.length > pagesBufferLength) {
                    lastClientAccessPages.pop();
                }
            }
            entryInfo.lastActiveTime = Date.now();
            entryInfo.dispose = false;
        }
        return toSend;
    }
    return {
        async ensurePage ({ page , clientOnly , appPaths =null , match  }) {
            const stalledTime = 60;
            const stalledEnsureTimeout = setTimeout(()=>{
                debug(`Ensuring ${page} has taken longer than ${stalledTime}s, if this continues to stall this may be a bug`);
            }, stalledTime * 1000);
            // If the route is actually an app page route, then we should have access
            // to the app route match, and therefore, the appPaths from it.
            if ((match == null ? void 0 : match.definition.kind) === _routeKind.RouteKind.APP_PAGE) {
                const { definition: route  } = match;
                appPaths = route.appPaths;
            }
            try {
                const pagePathData = await findRoutePathData(rootDir, page, nextConfig.pageExtensions, pagesDir, appDir, match);
                const isInsideAppDir = !!appDir && pagePathData.absolutePagePath.startsWith(appDir);
                const pageType = isInsideAppDir ? "app" : "pages";
                const pageBundleType = getPageBundleType(pagePathData.bundlePath);
                const addEntry = (compilerType)=>{
                    const entryKey = getEntryKey(compilerType, pageBundleType, pagePathData.page);
                    if (curEntries[entryKey] && // there can be an overlap in the entryKey for the instrumentation hook file and a page named the same
                    // this is a quick fix to support this scenario by overwriting the instrumentation hook entry, since we only use it one time
                    // any changes to the instrumentation hook file will require a restart of the dev server anyway
                    !(0, _utils).isInstrumentationHookFilename(curEntries[entryKey].bundlePath)) {
                        curEntries[entryKey].dispose = false;
                        curEntries[entryKey].lastActiveTime = Date.now();
                        if (curEntries[entryKey].status === BUILT) {
                            return {
                                entryKey,
                                newEntry: false,
                                shouldInvalidate: false
                            };
                        }
                        return {
                            entryKey,
                            newEntry: false,
                            shouldInvalidate: true
                        };
                    }
                    curEntries[entryKey] = {
                        type: 0,
                        appPaths,
                        absolutePagePath: pagePathData.absolutePagePath,
                        request: pagePathData.absolutePagePath,
                        bundlePath: pagePathData.bundlePath,
                        dispose: false,
                        lastActiveTime: Date.now(),
                        status: ADDED
                    };
                    return {
                        entryKey: entryKey,
                        newEntry: true,
                        shouldInvalidate: true
                    };
                };
                const staticInfo = await (0, _getPageStaticInfo).getPageStaticInfo({
                    pageFilePath: pagePathData.absolutePagePath,
                    nextConfig,
                    isDev: true,
                    pageType
                });
                const added = new Map();
                const isServerComponent = isInsideAppDir && staticInfo.rsc !== _constants.RSC_MODULE_TYPES.client;
                await (0, _entries).runDependingOnPageType({
                    page: pagePathData.page,
                    pageRuntime: staticInfo.runtime,
                    pageType: pageBundleType,
                    onClient: ()=>{
                        // Skip adding the client entry for app / Server Components.
                        if (isServerComponent || isInsideAppDir) {
                            return;
                        }
                        added.set(_constants.COMPILER_NAMES.client, addEntry(_constants.COMPILER_NAMES.client));
                    },
                    onServer: ()=>{
                        added.set(_constants.COMPILER_NAMES.server, addEntry(_constants.COMPILER_NAMES.server));
                        const edgeServerEntry = getEntryKey(_constants.COMPILER_NAMES.edgeServer, pageBundleType, pagePathData.page);
                        if (curEntries[edgeServerEntry] && !(0, _utils).isInstrumentationHookFile(pagePathData.page)) {
                            // Runtime switched from edge to server
                            delete curEntries[edgeServerEntry];
                        }
                    },
                    onEdgeServer: ()=>{
                        added.set(_constants.COMPILER_NAMES.edgeServer, addEntry(_constants.COMPILER_NAMES.edgeServer));
                        const serverEntry = getEntryKey(_constants.COMPILER_NAMES.server, pageBundleType, pagePathData.page);
                        if (curEntries[serverEntry] && !(0, _utils).isInstrumentationHookFile(pagePathData.page)) {
                            // Runtime switched from server to edge
                            delete curEntries[serverEntry];
                        }
                    }
                });
                const addedValues = [
                    ...added.values()
                ];
                const entriesThatShouldBeInvalidated = [
                    ...added.entries()
                ].filter(([, entry])=>entry.shouldInvalidate);
                const hasNewEntry = addedValues.some((entry)=>entry.newEntry);
                if (hasNewEntry) {
                    (0, _output).reportTrigger(!clientOnly && hasNewEntry ? `${pagePathData.page} (client and server)` : pagePathData.page);
                }
                if (entriesThatShouldBeInvalidated.length > 0) {
                    const invalidatePromise = Promise.all(entriesThatShouldBeInvalidated.map(([compilerKey, { entryKey  }])=>{
                        return new Promise((resolve, reject)=>{
                            doneCallbacks.once(entryKey, (err)=>{
                                if (err) {
                                    return reject(err);
                                }
                                // If the invalidation also triggers a rebuild, we need to
                                // wait for that additional build to prevent race conditions.
                                const needsRebuild = curInvalidator.willRebuild(compilerKey);
                                if (needsRebuild) {
                                    doneCallbacks.once(entryKey, (rebuildErr)=>{
                                        if (rebuildErr) {
                                            return reject(rebuildErr);
                                        }
                                        resolve();
                                    });
                                } else {
                                    resolve();
                                }
                            });
                        });
                    }));
                    curInvalidator.invalidate([
                        ...added.keys()
                    ]);
                    await invalidatePromise;
                }
            } finally{
                clearTimeout(stalledEnsureTimeout);
            }
        },
        onHMR (client) {
            client.addEventListener("message", ({ data  })=>{
                try {
                    const parsedData = JSON.parse(typeof data !== "string" ? data.toString() : data);
                    if (parsedData.event === "ping") {
                        const result = parsedData.appDirRoute ? handleAppDirPing(parsedData.tree) : handlePing(parsedData.page);
                        client.send(JSON.stringify({
                            ...result,
                            [parsedData.appDirRoute ? "action" : "event"]: "pong"
                        }));
                    }
                } catch (_) {}
            });
        }
    };
}

//# sourceMappingURL=on-demand-entry-handler.js.map