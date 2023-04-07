import { isAppRouteRoute } from "../../../lib/is-app-route-route";
import { APP_PATHS_MANIFEST } from "../../../shared/lib/constants";
import { RouteKind } from "../route-kind";
import { AppRouteRouteMatcher } from "../route-matchers/app-route-route-matcher";
import { ManifestRouteMatcherProvider } from "./manifest-route-matcher-provider";
import { AppNormalizers } from "../normalizers/built/app";
export class AppRouteRouteMatcherProvider extends ManifestRouteMatcherProvider {
    constructor(distDir, manifestLoader){
        super(APP_PATHS_MANIFEST, manifestLoader);
        this.normalizers = new AppNormalizers(distDir);
    }
    async transform(manifest) {
        // This matcher only matches app routes.
        const pages = Object.keys(manifest).filter((page)=>isAppRouteRoute(page));
        // Format the routes.
        const matchers = [];
        for (const page1 of pages){
            const filename = this.normalizers.filename.normalize(manifest[page1]);
            const pathname = this.normalizers.pathname.normalize(page1);
            const bundlePath = this.normalizers.bundlePath.normalize(page1);
            matchers.push(new AppRouteRouteMatcher({
                kind: RouteKind.APP_ROUTE,
                pathname,
                page: page1,
                bundlePath,
                filename
            }));
        }
        return matchers;
    }
}

//# sourceMappingURL=app-route-route-matcher-provider.js.map