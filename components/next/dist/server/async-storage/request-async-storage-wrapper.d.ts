/// <reference types="node" />
import type { BaseNextRequest, BaseNextResponse } from '../base-http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { RequestStore } from '../../client/components/request-async-storage';
import type { RenderOpts } from '../app-render/types';
import type { AsyncStorageWrapper } from './async-storage-wrapper';
import type { NextRequest } from '../web/spec-extension/request';
export declare type RequestContext = {
    req: IncomingMessage | BaseNextRequest | NextRequest;
    res?: ServerResponse | BaseNextResponse;
    renderOpts?: RenderOpts;
};
export declare const RequestAsyncStorageWrapper: AsyncStorageWrapper<RequestStore, RequestContext>;