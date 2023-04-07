import { NEXT_TS_ERRORS } from "../constant";
import { getInfo, getSource, getTs, getTypeChecker, isPositionInsideNode } from "../utils";
const TYPE_ANOTATION = ": Metadata";
const TYPE_ANOTATION_ASYNC = ": Promise<Metadata>";
const TYPE_IMPORT = `\n\nimport type { Metadata } from 'next'`;
// Find the `export const metadata = ...` node.
function getMetadataExport(fileName, position) {
    const source = getSource(fileName);
    let metadataExport;
    if (source) {
        const ts = getTs();
        ts.forEachChild(source, function visit(node) {
            if (metadataExport) return;
            // Covered by this node
            if (isPositionInsideNode(position, node)) {
                var ref;
                // Export variable
                if (ts.isVariableStatement(node) && ((ref = node.modifiers) == null ? void 0 : ref.some((m)=>m.kind === ts.SyntaxKind.ExportKeyword))) {
                    if (ts.isVariableDeclarationList(node.declarationList)) {
                        for (const declaration of node.declarationList.declarations){
                            if (isPositionInsideNode(position, declaration) && declaration.name.getText() === "metadata") {
                                // `export const metadata = ...`
                                metadataExport = declaration;
                                return;
                            }
                        }
                    }
                }
            }
        });
    }
    return metadataExport;
}
let cachedProxiedLanguageService;
let cachedProxiedLanguageServiceHost;
function getProxiedLanguageService() {
    if (cachedProxiedLanguageService) return {
        languageService: cachedProxiedLanguageService,
        languageServiceHost: cachedProxiedLanguageServiceHost
    };
    const languageServiceHost = getInfo().languageServiceHost;
    const ts = getTs();
    class ProxiedLanguageServiceHost {
        files = {};
        log = ()=>{};
        trace = ()=>{};
        error = ()=>{};
        getCompilationSettings = ()=>languageServiceHost.getCompilationSettings();
        getScriptIsOpen = ()=>true;
        getCurrentDirectory = ()=>languageServiceHost.getCurrentDirectory();
        getDefaultLibFileName = (o)=>languageServiceHost.getDefaultLibFileName(o);
        getScriptVersion = (fileName)=>{
            const file = this.files[fileName];
            if (!file) return languageServiceHost.getScriptVersion(fileName);
            return file.ver.toString();
        };
        getScriptSnapshot = (fileName)=>{
            const file = this.files[fileName];
            if (!file) return languageServiceHost.getScriptSnapshot(fileName);
            return file.file;
        };
        getScriptFileNames() {
            const names = new Set();
            for(var name in this.files){
                if (this.files.hasOwnProperty(name)) {
                    names.add(name);
                }
            }
            const files = languageServiceHost.getScriptFileNames();
            for (const file of files){
                names.add(file);
            }
            return [
                ...names
            ];
        }
        addFile(fileName, body) {
            const snap = ts.ScriptSnapshot.fromString(body);
            snap.getChangeRange = (_)=>undefined;
            const existing = this.files[fileName];
            if (existing) {
                this.files[fileName].ver++;
                this.files[fileName].file = snap;
            } else {
                this.files[fileName] = {
                    ver: 1,
                    file: snap
                };
            }
        }
        readFile(fileName) {
            const file = this.files[fileName];
            return file ? file.file.getText(0, file.file.getLength()) : languageServiceHost.readFile(fileName);
        }
        fileExists(fileName) {
            return this.files[fileName] !== undefined || languageServiceHost.fileExists(fileName);
        }
    }
    cachedProxiedLanguageServiceHost = new ProxiedLanguageServiceHost();
    cachedProxiedLanguageService = ts.createLanguageService(cachedProxiedLanguageServiceHost, ts.createDocumentRegistry());
    return {
        languageService: cachedProxiedLanguageService,
        languageServiceHost: cachedProxiedLanguageServiceHost
    };
}
function updateVirtualFileWithType(fileName, node, isGenerateMetadata) {
    const source = getSource(fileName);
    if (!source) return;
    // We annotate with the type in a vritual language service
    const sourceText = source.getFullText();
    let nodeEnd;
    let annotation;
    const ts = getTs();
    if (ts.isFunctionDeclaration(node)) {
        if (isGenerateMetadata) {
            var ref;
            nodeEnd = node.body.getFullStart();
            const isAsync = (ref = node.modifiers) == null ? void 0 : ref.some((m)=>m.kind === ts.SyntaxKind.AsyncKeyword);
            annotation = isAsync ? TYPE_ANOTATION_ASYNC : TYPE_ANOTATION;
        } else {
            return;
        }
    } else {
        nodeEnd = node.name.getFullStart() + node.name.getFullWidth();
        annotation = TYPE_ANOTATION;
    }
    const newSource = sourceText.slice(0, nodeEnd) + annotation + sourceText.slice(nodeEnd) + TYPE_IMPORT;
    const { languageServiceHost  } = getProxiedLanguageService();
    languageServiceHost.addFile(fileName, newSource);
    return [
        nodeEnd,
        annotation.length
    ];
}
function isTyped(node) {
    return node.type !== undefined;
}
function proxyDiagnostics(fileName, pos, n) {
    // Get diagnostics
    const { languageService  } = getProxiedLanguageService();
    const diagnostics = languageService.getSemanticDiagnostics(fileName);
    const source = getSource(fileName);
    // Filter and map the results
    return diagnostics.filter((d)=>{
        if (d.start === undefined || d.length === undefined) return false;
        if (d.start < n.getFullStart()) return false;
        if (d.start + d.length >= n.getFullStart() + n.getFullWidth() + pos[1]) return false;
        return true;
    }).map((d)=>{
        return {
            file: source,
            category: d.category,
            code: d.code,
            messageText: d.messageText,
            start: d.start < pos[0] ? d.start : d.start - pos[1],
            length: d.length
        };
    });
}
const metadata = {
    filterCompletionsAtPosition (fileName, position, _options, prior) {
        const node = getMetadataExport(fileName, position);
        if (!node) return prior;
        if (isTyped(node)) return prior;
        const ts = getTs();
        // We annotate with the type in a vritual language service
        const pos = updateVirtualFileWithType(fileName, node);
        if (pos === undefined) return prior;
        // Get completions
        const { languageService  } = getProxiedLanguageService();
        const newPos = position <= pos[0] ? position : position + pos[1];
        const completions = languageService.getCompletionsAtPosition(fileName, newPos, undefined);
        if (completions) {
            completions.isIncomplete = true;
            completions.entries = completions.entries.filter((e)=>{
                return [
                    ts.ScriptElementKind.memberVariableElement,
                    ts.ScriptElementKind.typeElement,
                    ts.ScriptElementKind.string, 
                ].includes(e.kind);
            }).map((e)=>{
                const insertText = e.kind === ts.ScriptElementKind.memberVariableElement && /^[a-zA-Z0-9_]+$/.test(e.name) ? e.name + ": " : e.name;
                return {
                    name: e.name,
                    insertText,
                    kind: e.kind,
                    kindModifiers: e.kindModifiers,
                    sortText: "!" + e.name,
                    labelDetails: {
                        description: `Next.js metadata`
                    },
                    data: e.data
                };
            });
            return completions;
        }
        return prior;
    },
    getSemanticDiagnosticsForExportVariableStatementInClientEntry (fileName, node) {
        const source = getSource(fileName);
        const ts = getTs();
        // It is not allowed to export `metadata` or `generateMetadata` in client entry
        if (ts.isFunctionDeclaration(node)) {
            var ref;
            if (((ref = node.name) == null ? void 0 : ref.getText()) === "generateMetadata") {
                return [
                    {
                        file: source,
                        category: ts.DiagnosticCategory.Error,
                        code: NEXT_TS_ERRORS.INVALID_METADATA_EXPORT,
                        messageText: `The Next.js 'generateMetadata' API is not allowed in a client component.`,
                        start: node.name.getStart(),
                        length: node.name.getWidth()
                    }, 
                ];
            }
        } else {
            for (const declaration of node.declarationList.declarations){
                const name = declaration.name.getText();
                if (name === "metadata") {
                    return [
                        {
                            file: source,
                            category: ts.DiagnosticCategory.Error,
                            code: NEXT_TS_ERRORS.INVALID_METADATA_EXPORT,
                            messageText: `The Next.js 'metadata' API is not allowed in a client component.`,
                            start: declaration.name.getStart(),
                            length: declaration.name.getWidth()
                        }, 
                    ];
                }
            }
        }
        return [];
    },
    getSemanticDiagnosticsForExportVariableStatement (fileName, node) {
        const ts = getTs();
        if (ts.isFunctionDeclaration(node)) {
            var ref;
            if (((ref = node.name) == null ? void 0 : ref.getText()) === "generateMetadata") {
                if (isTyped(node)) return [];
                // We annotate with the type in a vritual language service
                const pos = updateVirtualFileWithType(fileName, node, true);
                if (!pos) return [];
                return proxyDiagnostics(fileName, pos, node);
            }
        } else {
            for (const declaration of node.declarationList.declarations){
                if (declaration.name.getText() === "metadata") {
                    if (isTyped(declaration)) break;
                    // We annotate with the type in a vritual language service
                    const pos = updateVirtualFileWithType(fileName, declaration);
                    if (!pos) break;
                    return proxyDiagnostics(fileName, pos, declaration);
                }
            }
        }
        return [];
    },
    getSemanticDiagnosticsForExportDeclarationInClientEntry (fileName, node) {
        const ts = getTs();
        const source = getSource(fileName);
        const diagnostics = [];
        const exportClause = node.exportClause;
        if (exportClause && ts.isNamedExports(exportClause)) {
            for (const e of exportClause.elements){
                if ([
                    "generateMetadata",
                    "metadata"
                ].includes(e.name.getText())) {
                    diagnostics.push({
                        file: source,
                        category: ts.DiagnosticCategory.Error,
                        code: NEXT_TS_ERRORS.INVALID_METADATA_EXPORT,
                        messageText: `The Next.js '${e.name.getText()}' API is not allowed in a client component.`,
                        start: e.name.getStart(),
                        length: e.name.getWidth()
                    });
                }
            }
        }
        return diagnostics;
    },
    getSemanticDiagnosticsForExportDeclaration (fileName, node) {
        const ts = getTs();
        const exportClause = node.exportClause;
        if (exportClause && ts.isNamedExports(exportClause)) {
            for (const e of exportClause.elements){
                if (e.name.getText() === "metadata") {
                    // Get the original declaration node of element
                    const typeChecker = getTypeChecker();
                    if (typeChecker) {
                        const symbol = typeChecker.getSymbolAtLocation(e.name);
                        if (symbol) {
                            const metadataSymbol = typeChecker.getAliasedSymbol(symbol);
                            if (metadataSymbol && metadataSymbol.declarations) {
                                const declaration = metadataSymbol.declarations[0];
                                if (declaration && ts.isVariableDeclaration(declaration)) {
                                    if (isTyped(declaration)) break;
                                    const declarationFileName = declaration.getSourceFile().fileName;
                                    const isSameFile = declarationFileName === fileName;
                                    // We annotate with the type in a vritual language service
                                    const pos = updateVirtualFileWithType(declarationFileName, declaration);
                                    if (!pos) break;
                                    const diagnostics = proxyDiagnostics(declarationFileName, pos, declaration);
                                    if (diagnostics.length) {
                                        if (isSameFile) {
                                            return diagnostics;
                                        } else {
                                            return [
                                                {
                                                    file: getSource(fileName),
                                                    category: ts.DiagnosticCategory.Error,
                                                    code: NEXT_TS_ERRORS.INVALID_METADATA_EXPORT,
                                                    messageText: `The 'metadata' export value is not typed correctly, please make sure it is typed as 'Metadata':\nhttps://beta.nextjs.org/docs/guides/seo#static-metadata`,
                                                    start: e.name.getStart(),
                                                    length: e.name.getWidth()
                                                }, 
                                            ];
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return [];
    },
    getCompletionEntryDetails (fileName, position, entryName, formatOptions, source, preferences, data) {
        const node = getMetadataExport(fileName, position);
        if (!node) return;
        if (isTyped(node)) return;
        // We annotate with the type in a vritual language service
        const pos = updateVirtualFileWithType(fileName, node);
        if (pos === undefined) return;
        const { languageService  } = getProxiedLanguageService();
        const newPos = position <= pos[0] ? position : position + pos[1];
        const details = languageService.getCompletionEntryDetails(fileName, newPos, entryName, formatOptions, source, preferences, data);
        return details;
    },
    getQuickInfoAtPosition (fileName, position) {
        const node = getMetadataExport(fileName, position);
        if (!node) return;
        if (isTyped(node)) return;
        // We annotate with the type in a vritual language service
        const pos = updateVirtualFileWithType(fileName, node);
        if (pos === undefined) return;
        const { languageService  } = getProxiedLanguageService();
        const newPos = position <= pos[0] ? position : position + pos[1];
        const insight = languageService.getQuickInfoAtPosition(fileName, newPos);
        return insight;
    },
    getDefinitionAndBoundSpan (fileName, position) {
        const node = getMetadataExport(fileName, position);
        if (!node) return;
        if (isTyped(node)) return;
        if (!isPositionInsideNode(position, node)) return;
        // We annotate with the type in a vritual language service
        const pos = updateVirtualFileWithType(fileName, node);
        if (pos === undefined) return;
        const { languageService  } = getProxiedLanguageService();
        const newPos = position <= pos[0] ? position : position + pos[1];
        const definitionInfoAndBoundSpan = languageService.getDefinitionAndBoundSpan(fileName, newPos);
        if (definitionInfoAndBoundSpan) {
            // Adjust the start position of the text span
            if (definitionInfoAndBoundSpan.textSpan.start > pos[0]) {
                definitionInfoAndBoundSpan.textSpan.start -= pos[1];
            }
        }
        return definitionInfoAndBoundSpan;
    }
};
export default metadata;

//# sourceMappingURL=metadata.js.map