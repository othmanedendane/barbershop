import { normalizeLocalePath } from '../../i18n/normalize-locale-path';
import { removePathPrefix } from './remove-path-prefix';
import { pathHasPrefix } from './path-has-prefix';
export function getNextPathnameInfo(pathname, options) {
    var _nextConfig;
    const { basePath , i18n , trailingSlash  } = (_nextConfig = options.nextConfig) != null ? _nextConfig : {};
    const info = {
        pathname: pathname,
        trailingSlash: pathname !== '/' ? pathname.endsWith('/') : trailingSlash
    };
    if (basePath && pathHasPrefix(info.pathname, basePath)) {
        info.pathname = removePathPrefix(info.pathname, basePath);
        info.basePath = basePath;
    }
    if (options.parseData === true && info.pathname.startsWith('/_next/data/') && info.pathname.endsWith('.json')) {
        const paths = info.pathname.replace(/^\/_next\/data\//, '').replace(/\.json$/, '').split('/');
        const buildId = paths[0];
        info.pathname = paths[1] !== 'index' ? `/${paths.slice(1).join('/')}` : '/';
        info.buildId = buildId;
    }
    // If provided, use the locale route normalizer to detect the locale instead
    // of the function below.
    if (options.i18nProvider) {
        const result = options.i18nProvider.analyze(info.pathname);
        info.locale = result.detectedLocale;
        var _pathname;
        info.pathname = (_pathname = result.pathname) != null ? _pathname : info.pathname;
    } else if (i18n) {
        const pathLocale = normalizeLocalePath(info.pathname, i18n.locales);
        info.locale = pathLocale.detectedLocale;
        var _pathname1;
        info.pathname = (_pathname1 = pathLocale.pathname) != null ? _pathname1 : info.pathname;
    }
    return info;
}

//# sourceMappingURL=get-next-pathname-info.js.map