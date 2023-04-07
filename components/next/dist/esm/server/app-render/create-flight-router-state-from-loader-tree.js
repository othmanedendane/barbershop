import { PAGE_SEGMENT_KEY } from "../../shared/lib/constants";
export function addSearchParamsIfPageSegment(segment, searchParams) {
    const isPageSegment = segment === PAGE_SEGMENT_KEY;
    if (isPageSegment) {
        const stringifiedQuery = JSON.stringify(searchParams);
        return stringifiedQuery !== "{}" ? segment + "?" + stringifiedQuery : segment;
    }
    return segment;
}
export function createFlightRouterStateFromLoaderTree([segment, parallelRoutes, { layout  }], getDynamicParamFromSegment, searchParams, rootLayoutIncluded = false) {
    const dynamicParam = getDynamicParamFromSegment(segment);
    const treeSegment = dynamicParam ? dynamicParam.treeSegment : segment;
    const segmentTree = [
        addSearchParamsIfPageSegment(treeSegment, searchParams),
        {}, 
    ];
    if (!rootLayoutIncluded && typeof layout !== "undefined") {
        rootLayoutIncluded = true;
        segmentTree[4] = true;
    }
    segmentTree[1] = Object.keys(parallelRoutes).reduce((existingValue, currentValue)=>{
        existingValue[currentValue] = createFlightRouterStateFromLoaderTree(parallelRoutes[currentValue], getDynamicParamFromSegment, searchParams, rootLayoutIncluded);
        return existingValue;
    }, {});
    return segmentTree;
}

//# sourceMappingURL=create-flight-router-state-from-loader-tree.js.map