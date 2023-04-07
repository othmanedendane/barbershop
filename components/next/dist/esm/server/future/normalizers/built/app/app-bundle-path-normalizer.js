import { Normalizers } from "../../normalizers";
import { PrefixingNormalizer } from "../../prefixing-normalizer";
export class AppBundlePathNormalizer extends PrefixingNormalizer {
    constructor(){
        super("app");
    }
    normalize(page) {
        return super.normalize(page);
    }
}
export class DevAppBundlePathNormalizer extends Normalizers {
    constructor(pageNormalizer){
        super([
            // This should normalize the filename to a page.
            pageNormalizer,
            // Normalize the app page to a pathname.
            new AppBundlePathNormalizer(), 
        ]);
    }
    normalize(filename) {
        return super.normalize(filename);
    }
}

//# sourceMappingURL=app-bundle-path-normalizer.js.map